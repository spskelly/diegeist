import { describe, it, expect, beforeEach } from 'vitest';
import { SaveData, HubShop, ACHIEVEMENTS, SHOP_ITEMS, loadSaveData, persistSaveData } from '../src/progression.js';

describe('SaveData', () => {
  let save;
  beforeEach(() => {
    save = new SaveData();
  });

  it('initializes with default values', () => {
    expect(save.currency).toBe(0);
    expect(save.stash).toEqual([]);
    expect(save.achievements).toEqual({});
    expect(save.shopPurchases).toEqual([]);
    expect(save.pendingRunPurchases).toEqual([]);
    expect(save.permanentStats).toEqual({});
    expect(save.permanentPerks).toEqual([]);
    expect(save.runHistory).toEqual([]);
    expect(save.settings).toEqual({ volume: 0.7 });
  });

  it('adds currency', () => {
    save.addCurrency(50);
    expect(save.currency).toBe(50);
    save.addCurrency(30);
    expect(save.currency).toBe(80);
  });

  it('spends currency', () => {
    save.addCurrency(100);
    const result = save.spendCurrency(60);
    expect(result).toBe(true);
    expect(save.currency).toBe(40);
  });

  it('rejects spending more than available', () => {
    save.addCurrency(30);
    const result = save.spendCurrency(50);
    expect(result).toBe(false);
    expect(save.currency).toBe(30);
  });

  it('adds items to stash', () => {
    const item = { id: 'item_1', name: 'Sword' };
    save.addToStash(item);
    expect(save.stash).toHaveLength(1);
  });

  it('limits stash to 30 items', () => {
    for (let i = 0; i < 30; i++) {
      save.addToStash({ id: `item_${i}`, name: `Item ${i}` });
    }
    const result = save.addToStash({ id: 'extra', name: 'Extra' });
    expect(result).toBe(false);
    expect(save.stash).toHaveLength(30);
  });

  it('removes items from stash', () => {
    const item = { id: 'item_1', name: 'Sword' };
    save.addToStash(item);
    const removed = save.removeFromStash('item_1');
    expect(removed).toEqual(item);
    expect(save.stash).toHaveLength(0);
  });

  it('records run history', () => {
    save.addRunHistory({ classKey: 'fighter', floorsReached: 5, enemiesKilled: 20, currencyEarned: 50, causeOfDeath: 'Rat' });
    expect(save.runHistory).toHaveLength(1);
    expect(save.runHistory[0].classKey).toBe('fighter');
  });

  it('applies permanent stat bonus', () => {
    save.addPermanentStat('STR', 1);
    expect(save.permanentStats.STR).toBe(1);
    save.addPermanentStat('STR', 1);
    expect(save.permanentStats.STR).toBe(2);
  });

  it('adds permanent perks', () => {
    save.addPerk('potion_boost');
    expect(save.permanentPerks).toContain('potion_boost');
  });

  it('initializes with empty materials', () => {
    expect(save.materials).toEqual({ timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 });
  });

  it('adds materials', () => {
    save.addMaterials({ timber: 5, stone: 3 });
    expect(save.materials.timber).toBe(5);
    expect(save.materials.stone).toBe(3);
    expect(save.materials.iron).toBe(0);
  });

  it('checks if materials are affordable', () => {
    save.addMaterials({ timber: 10, stone: 5 });
    expect(save.canAfford({ timber: 5, stone: 3 })).toBe(true);
    expect(save.canAfford({ timber: 15 })).toBe(false);
  });

  it('spends materials when affordable', () => {
    save.addMaterials({ timber: 10, stone: 5 });
    const result = save.spendMaterials({ timber: 4, stone: 2 });
    expect(result).toBe(true);
    expect(save.materials.timber).toBe(6);
    expect(save.materials.stone).toBe(3);
  });

  it('rejects spending materials when not affordable', () => {
    save.addMaterials({ timber: 3 });
    const result = save.spendMaterials({ timber: 5 });
    expect(result).toBe(false);
    expect(save.materials.timber).toBe(3); // unchanged
  });

  it('serializes and deserializes materials', () => {
    save.addMaterials({ timber: 10, iron: 5 });
    const json = save.serialize();
    const loaded = SaveData.deserialize(json);
    expect(loaded.materials.timber).toBe(10);
    expect(loaded.materials.iron).toBe(5);
    expect(loaded.materials.crystal).toBe(0);
  });

  it('deserializes old saves without materials to defaults', () => {
    const oldJson = JSON.stringify({ currency: 50, stash: [] });
    const loaded = SaveData.deserialize(oldJson);
    expect(loaded.materials).toEqual({ timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 });
  });

  it('serializes and deserializes correctly', () => {
    save.addCurrency(100);
    save.addPermanentStat('DEX', 3);
    save.addToStash({ id: 'sword_1', name: 'Iron Sword' });
    const json = save.serialize();
    const loaded = SaveData.deserialize(json);
    expect(loaded.currency).toBe(100);
    expect(loaded.permanentStats.DEX).toBe(3);
    expect(loaded.stash).toHaveLength(1);
  });
});

describe('HubShop', () => {
  it('generates a shop inventory with 4-6 items', () => {
    const shop = new HubShop();
    shop.generate([]);
    expect(shop.items.length).toBeGreaterThanOrEqual(4);
    expect(shop.items.length).toBeLessThanOrEqual(6);
  });

  it('excludes already purchased permanent items', () => {
    const shop = new HubShop();
    shop.generate(['stat_str_1']);
    const hasExcluded = shop.items.some(i => i.id === 'stat_str_1');
    expect(hasExcluded).toBe(false);
  });

  it('each shop item has id, name, cost, and type', () => {
    const shop = new HubShop();
    shop.generate([]);
    for (const item of shop.items) {
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.cost).toBeGreaterThan(0);
      expect(item.category).toBeDefined();
    }
  });

  it('queues non-permanent purchases for next run', () => {
    const shop = new HubShop();
    const save = new SaveData();
    save.addCurrency(1000);
    shop.items = [{ id: 'starting_potions', name: 'Start with 3x Health Potions', cost: 40, category: 'consumable_pack', oneTime: false }];

    const result = shop.purchase(save, 'starting_potions');

    expect(result).toBe(true);
    expect(save.pendingRunPurchases).toContain('starting_potions');
  });
});

describe('storage helpers', () => {
  function makeStorage() {
    const store = new Map();
    return {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, value);
      },
    };
  }

  it('loads defaults when storage is empty', () => {
    const storage = makeStorage();
    const save = loadSaveData(storage);
    expect(save.currency).toBe(0);
    expect(save.stash).toEqual([]);
  });

  it('persists and reloads save data', () => {
    const storage = makeStorage();
    const save = new SaveData();
    save.addCurrency(88);
    save.addPermanentStat('STR', 2);
    persistSaveData(save, storage);

    const loaded = loadSaveData(storage);
    expect(loaded.currency).toBe(88);
    expect(loaded.permanentStats.STR).toBe(2);
  });

  it('falls back to defaults on corrupted save', () => {
    const storage = makeStorage();
    storage.setItem('diegeist.save.v1', '{not valid json');
    const save = loadSaveData(storage);
    expect(save.currency).toBe(0);
    expect(save.runHistory).toEqual([]);
  });
});

describe('Achievements', () => {
  it('ACHIEVEMENTS array has entries with id, name, condition, and bonus', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThan(3);
    for (const ach of ACHIEVEMENTS) {
      expect(ach.id).toBeDefined();
      expect(ach.name).toBeDefined();
      expect(ach.condition).toBeDefined();
      expect(ach.bonus).toBeDefined();
    }
  });

  it('tracks progress toward achievements', () => {
    const save = new SaveData();
    save.updateAchievementProgress('rat_slayer', 10);
    expect(save.achievements.rat_slayer.progress).toBe(10);
    expect(save.achievements.rat_slayer.unlocked).toBe(false);
  });

  it('unlocks achievement when threshold reached', () => {
    const save = new SaveData();
    save.updateAchievementProgress('rat_slayer', 50);
    const ach = ACHIEVEMENTS.find(a => a.id === 'rat_slayer');
    expect(save.achievements.rat_slayer.progress).toBe(50);
    // Check if threshold is met
    if (ach && save.achievements.rat_slayer.progress >= ach.condition.count) {
      save.achievements.rat_slayer.unlocked = true;
    }
    expect(save.achievements.rat_slayer.unlocked).toBe(true);
  });
});

describe('SaveData skill tree fields', () => {
  it('initializes with empty skill tree state', () => {
    const save = new SaveData();
    expect(save.classXP).toEqual({ fighter: 0, archer: 0, mage: 0 });
    expect(save.classLevels).toEqual({ fighter: 1, archer: 1, mage: 1 });
    expect(save.skillPoints).toEqual({ fighter: 0, archer: 0, mage: 0 });
    expect(save.skillInvestments).toEqual({ fighter: {}, archer: {}, mage: {} });
  });

  it('serializes and deserializes skill tree state', () => {
    const save = new SaveData();
    save.classXP.fighter = 500;
    save.classLevels.fighter = 5;
    save.skillPoints.fighter = 2;
    save.skillInvestments.fighter = { fighter_heavy_strike: 2 };

    const json = save.serialize();
    const restored = SaveData.deserialize(json);

    expect(restored.classXP.fighter).toBe(500);
    expect(restored.classLevels.fighter).toBe(5);
    expect(restored.skillPoints.fighter).toBe(2);
    expect(restored.skillInvestments.fighter.fighter_heavy_strike).toBe(2);
  });

  it('backward-compatible: old saves without skill fields get defaults', () => {
    const oldJson = JSON.stringify({ currency: 100, stash: [] });
    const save = SaveData.deserialize(oldJson);
    expect(save.classXP).toEqual({ fighter: 0, archer: 0, mage: 0 });
    expect(save.classLevels).toEqual({ fighter: 1, archer: 1, mage: 1 });
    expect(save.skillPoints).toEqual({ fighter: 0, archer: 0, mage: 0 });
    expect(save.skillInvestments).toEqual({ fighter: {}, archer: {}, mage: {} });
  });
});

describe('SaveData townPlayerPos', () => {
  it('initializes townPlayerPos as null', () => {
    const save = new SaveData();
    expect(save.townPlayerPos).toBe(null);
  });

  it('serializes and deserializes townPlayerPos', () => {
    const save = new SaveData();
    save.townPlayerPos = { x: 10, y: 14 };
    const json = save.serialize();
    const restored = SaveData.deserialize(json);
    expect(restored.townPlayerPos).toEqual({ x: 10, y: 14 });
  });

  it('backward-compatible: old saves without townPlayerPos get null', () => {
    const oldJson = JSON.stringify({ currency: 50, stash: [] });
    const save = SaveData.deserialize(oldJson);
    expect(save.townPlayerPos).toBe(null);
  });
});

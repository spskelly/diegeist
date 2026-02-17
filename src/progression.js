// src/progression.js

export const ACHIEVEMENTS = [
  { id: 'rat_slayer', name: 'Rat Slayer', description: 'Kill 50 rats across all runs', condition: { type: 'kill', target: 'Rat', count: 50 }, bonus: { type: 'damage_mult', value: 1.05, scope: 'floor_1_2' } },
  { id: 'sharpshooter', name: 'Sharpshooter', description: 'Land 100 critical hits as Archer', condition: { type: 'crits', class: 'archer', count: 100 }, bonus: { type: 'crit_chance', value: 0.02, scope: 'archer' } },
  { id: 'arcane_mastery', name: 'Arcane Mastery', description: 'Deal 1000 total magic damage', condition: { type: 'magic_damage', count: 1000 }, bonus: { type: 'stat', stat: 'INT', value: 1, scope: 'mage' } },
  { id: 'ironclad', name: 'Ironclad', description: 'Complete a run taking less than 50 damage as Fighter', condition: { type: 'low_damage_run', class: 'fighter', count: 50 }, bonus: { type: 'stat', stat: 'CON', value: 1, scope: 'fighter' } },
  { id: 'descent', name: 'Descent', description: 'Reach floor 5 for the first time', condition: { type: 'reach_floor', count: 5 }, bonus: { type: 'unlock', item: 'scroll_mapping' } },
  { id: 'deep_dweller', name: 'Deep Dweller', description: 'Reach floor 10 for the first time', condition: { type: 'reach_floor', count: 10 }, bonus: { type: 'unlock', item: 'rare_starting_gear' } },
  { id: 'vanquisher', name: 'Vanquisher', description: 'Defeat the floor 10 boss', condition: { type: 'beat_boss', floor: 10, count: 1 }, bonus: { type: 'unlock', item: 'shop_tier_2' } },
  { id: 'collector', name: 'Collector', description: 'Have 15 items in stash simultaneously', condition: { type: 'stash_count', count: 15 }, bonus: { type: 'stash_slot', value: 1 } },
];

export const SHOP_ITEMS = [
  { id: 'stat_str_1', name: '+1 STR', cost: 50, category: 'permanent_stat', stat: 'STR', value: 1 },
  { id: 'stat_str_2', name: '+1 STR (II)', cost: 100, category: 'permanent_stat', stat: 'STR', value: 1 },
  { id: 'stat_dex_1', name: '+1 DEX', cost: 50, category: 'permanent_stat', stat: 'DEX', value: 1 },
  { id: 'stat_dex_2', name: '+1 DEX (II)', cost: 100, category: 'permanent_stat', stat: 'DEX', value: 1 },
  { id: 'stat_con_1', name: '+1 CON', cost: 50, category: 'permanent_stat', stat: 'CON', value: 1 },
  { id: 'stat_int_1', name: '+1 INT', cost: 50, category: 'permanent_stat', stat: 'INT', value: 1 },
  { id: 'stat_wis_1', name: '+1 WIS', cost: 50, category: 'permanent_stat', stat: 'WIS', value: 1 },
  { id: 'stat_lck_1', name: '+1 LCK', cost: 50, category: 'permanent_stat', stat: 'LCK', value: 1 },
  { id: 'perk_potion_boost', name: 'Potions heal 20% more', cost: 150, category: 'permanent_perk', perkId: 'potion_boost' },
  { id: 'perk_show_traps', name: 'Show traps on minimap', cost: 120, category: 'permanent_perk', perkId: 'show_traps' },
  { id: 'perk_extra_belt', name: '+1 Belt slot', cost: 200, category: 'permanent_perk', perkId: 'extra_belt' },
  { id: 'starting_sword', name: 'Start with Common Sword', cost: 30, category: 'starting_gear', oneTime: false },
  { id: 'starting_potions', name: 'Start with 3x Health Potions', cost: 40, category: 'consumable_pack', oneTime: false },
];

export class SaveData {
  constructor() {
    this.currency = 0;
    this.stash = [];
    this.achievements = {};
    this.shopPurchases = [];
    this.pendingRunPurchases = [];
    this.permanentStats = {};
    this.permanentPerks = [];
    this.runHistory = [];
    this.settings = { volume: 0.7 };
    this.pendingLoadoutItem = null;
    this.materials = { timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 };
    this.classXP = { fighter: 0, archer: 0, mage: 0 };
    this.classLevels = { fighter: 1, archer: 1, mage: 1 };
    this.skillPoints = { fighter: 0, archer: 0, mage: 0 };
    this.skillInvestments = { fighter: {}, archer: {}, mage: {} };
    this.townPlayerPos = null;
  }

  addCurrency(amount) {
    this.currency += amount;
  }

  spendCurrency(amount) {
    if (this.currency < amount) return false;
    this.currency -= amount;
    return true;
  }

  addToStash(item) {
    if (this.stash.length >= 30) return false;
    this.stash.push(item);
    return true;
  }

  removeFromStash(itemId) {
    const idx = this.stash.findIndex(i => i.id === itemId);
    if (idx === -1) return null;
    return this.stash.splice(idx, 1)[0];
  }

  addRunHistory(summary) {
    this.runHistory.push({ ...summary, timestamp: Date.now() });
  }

  addPermanentStat(stat, value) {
    this.permanentStats[stat] = (this.permanentStats[stat] || 0) + value;
  }

  addPerk(perkId) {
    if (!this.permanentPerks.includes(perkId)) {
      this.permanentPerks.push(perkId);
    }
  }

  addMaterials(mats) {
    for (const [key, val] of Object.entries(mats)) {
      if (key in this.materials && val > 0) {
        this.materials[key] += val;
      }
    }
  }

  canAfford(cost) {
    for (const [key, val] of Object.entries(cost)) {
      if ((this.materials[key] || 0) < val) return false;
    }
    return true;
  }

  spendMaterials(cost) {
    if (!this.canAfford(cost)) return false;
    for (const [key, val] of Object.entries(cost)) {
      this.materials[key] -= val;
    }
    return true;
  }

  updateAchievementProgress(achievementId, newProgress) {
    if (!this.achievements[achievementId]) {
      this.achievements[achievementId] = { progress: 0, unlocked: false };
    }
    this.achievements[achievementId].progress = newProgress;
  }

  serialize() {
    return JSON.stringify({
      currency: this.currency,
      stash: this.stash,
      achievements: this.achievements,
      shopPurchases: this.shopPurchases,
      pendingRunPurchases: this.pendingRunPurchases,
      permanentStats: this.permanentStats,
      permanentPerks: this.permanentPerks,
      runHistory: this.runHistory,
      settings: this.settings,
      pendingLoadoutItem: this.pendingLoadoutItem,
      materials: this.materials,
      classXP: this.classXP,
      classLevels: this.classLevels,
      skillPoints: this.skillPoints,
      skillInvestments: this.skillInvestments,
      townPlayerPos: this.townPlayerPos,
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const save = new SaveData();
    Object.assign(save, data);
    if (!save.materials) {
      save.materials = { timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 };
    }
    if (!save.classXP) save.classXP = { fighter: 0, archer: 0, mage: 0 };
    if (!save.classLevels) save.classLevels = { fighter: 1, archer: 1, mage: 1 };
    if (!save.skillPoints) save.skillPoints = { fighter: 0, archer: 0, mage: 0 };
    if (!save.skillInvestments) save.skillInvestments = { fighter: {}, archer: {}, mage: {} };
    if (!save.townPlayerPos) save.townPlayerPos = null;
    return save;
  }
}

export class HubShop {
  constructor() {
    this.items = [];
  }

  generate(purchasedIds) {
    const available = SHOP_ITEMS.filter(item => {
      if (item.category === 'permanent_stat' || item.category === 'permanent_perk') {
        return !purchasedIds.includes(item.id);
      }
      return true;
    });

    const count = 4 + Math.floor(Math.random() * 3); // 4-6
    const shuffled = available.sort(() => Math.random() - 0.5);
    this.items = shuffled.slice(0, Math.min(count, shuffled.length));
  }

  purchase(save, itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return false;
    if (!save.spendCurrency(item.cost)) return false;

    if (item.category === 'permanent_stat') {
      save.addPermanentStat(item.stat, item.value);
      save.shopPurchases.push(item.id);
    } else if (item.category === 'permanent_perk') {
      save.addPerk(item.perkId);
      save.shopPurchases.push(item.id);
    } else if (item.category === 'starting_gear' || item.category === 'consumable_pack') {
      if (!Array.isArray(save.pendingRunPurchases)) save.pendingRunPurchases = [];
      save.pendingRunPurchases.push(item.id);
    }

    this.items = this.items.filter(i => i.id !== itemId);
    return true;
  }
}

const SAVE_KEY = 'diegeist.save.v1';

function getStorage(storage) {
  if (storage) return storage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

export function loadSaveData(storage = null) {
  const store = getStorage(storage);
  if (!store) return new SaveData();

  const raw = store.getItem(SAVE_KEY);
  if (!raw) return new SaveData();

  try {
    return SaveData.deserialize(raw);
  } catch (_err) {
    return new SaveData();
  }
}

export function persistSaveData(saveData, storage = null) {
  const store = getStorage(storage);
  if (!store) return false;
  store.setItem(SAVE_KEY, saveData.serialize());
  return true;
}

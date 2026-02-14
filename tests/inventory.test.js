import { describe, it, expect } from 'vitest';
import {
  equipItem,
  unequipItem,
  addToInventory,
  removeFromInventory,
  assignToBelt,
  useBeltSlot,
  getEquippedStats,
  autoEquipIfSlotEmpty,
} from '../src/inventory.js';
import { Entity } from '../src/entity.js';
import { generateItem, generateConsumable } from '../src/items.js';

function makePlayer() {
  return new Entity({
    id: 'player', type: 'player', x: 0, y: 0,
    stats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 },
    maxHp: 15, speed: 100,
  });
}

describe('addToInventory', () => {
  it('adds an item to the inventory', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    const result = addToInventory(p, item);
    expect(result).toBe(true);
    expect(p.inventory).toContain(item);
  });

  it('rejects when inventory is full (12 slots)', () => {
    const p = makePlayer();
    for (let i = 0; i < 12; i++) {
      addToInventory(p, generateItem({ floorLevel: 1 }));
    }
    expect(p.inventory).toHaveLength(12);
    const result = addToInventory(p, generateItem({ floorLevel: 1 }));
    expect(result).toBe(false);
    expect(p.inventory).toHaveLength(12);
  });
});

describe('removeFromInventory', () => {
  it('removes an item by id', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    addToInventory(p, item);
    const removed = removeFromInventory(p, item.id);
    expect(removed).toEqual(item);
    expect(p.inventory).not.toContain(item);
  });

  it('returns null for non-existent item', () => {
    const p = makePlayer();
    const removed = removeFromInventory(p, 'nonexistent');
    expect(removed).toBeNull();
  });
});

describe('equipItem', () => {
  it('equips an item to the correct slot', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    addToInventory(p, item);
    equipItem(p, item.id);
    expect(p.equipment[item.slot]).toEqual(item);
    expect(p.inventory).not.toContain(item);
  });

  it('swaps with currently equipped item', () => {
    const p = makePlayer();
    const item1 = generateItem({ floorLevel: 1 });
    const item2 = generateItem({ floorLevel: 1 });
    // Force same slot
    item2.slot = item1.slot;
    addToInventory(p, item1);
    addToInventory(p, item2);
    equipItem(p, item1.id);
    expect(p.equipment[item1.slot]).toEqual(item1);
    equipItem(p, item2.id);
    expect(p.equipment[item1.slot]).toEqual(item2);
    expect(p.inventory).toContain(item1); // old item goes back to inventory
  });
});

describe('autoEquipIfSlotEmpty', () => {
  it('equips the item when its slot is empty', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    addToInventory(p, item);

    const result = autoEquipIfSlotEmpty(p, item.id);

    expect(result).toBe(true);
    expect(p.equipment[item.slot]).toEqual(item);
    expect(p.inventory).not.toContain(item);
  });

  it('does not equip when the slot is already occupied', () => {
    const p = makePlayer();
    const item1 = generateItem({ floorLevel: 1 });
    const item2 = generateItem({ floorLevel: 1 });
    item2.slot = item1.slot;
    addToInventory(p, item1);
    addToInventory(p, item2);
    equipItem(p, item1.id);

    const result = autoEquipIfSlotEmpty(p, item2.id);

    expect(result).toBe(false);
    expect(p.equipment[item1.slot]).toEqual(item1);
    expect(p.inventory).toContain(item2);
  });
});

describe('unequipItem', () => {
  it('moves equipped item back to inventory', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    addToInventory(p, item);
    equipItem(p, item.id);
    const result = unequipItem(p, item.slot);
    expect(result).toBe(true);
    expect(p.equipment[item.slot]).toBeNull();
    expect(p.inventory).toContain(item);
  });

  it('fails if inventory is full', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    addToInventory(p, item);
    equipItem(p, item.id);
    // Fill inventory
    for (let i = 0; i < 12; i++) addToInventory(p, generateItem({ floorLevel: 1 }));
    const result = unequipItem(p, item.slot);
    expect(result).toBe(false);
  });
});

describe('getEquippedStats', () => {
  it('sums stat bonuses from all equipped gear', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    addToInventory(p, item);
    equipItem(p, item.id);
    const bonuses = getEquippedStats(p);
    // Should have at least one stat bonus from the equipped item
    const total = Object.values(bonuses).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('belt', () => {
  it('assigns consumable to belt slot', () => {
    const p = makePlayer();
    const potion = generateConsumable(1);
    addToInventory(p, potion);
    const result = assignToBelt(p, potion.id, 0);
    expect(result).toBe(true);
    expect(p.belt[0]).toEqual(potion);
    expect(p.inventory).not.toContain(potion);
  });

  it('rejects non-consumable to belt', () => {
    const p = makePlayer();
    const item = generateItem({ floorLevel: 1 });
    addToInventory(p, item);
    const result = assignToBelt(p, item.id, 0);
    expect(result).toBe(false);
  });

  it('uses belt consumable', () => {
    const p = makePlayer();
    const potion = generateConsumable(1);
    addToInventory(p, potion);
    assignToBelt(p, potion.id, 1);
    const used = useBeltSlot(p, 1);
    expect(used).toEqual(potion);
    expect(p.belt[1]).toBeNull();
  });

  it('replaces occupied belt slot and returns previous item to inventory', () => {
    const p = makePlayer();
    const first = generateConsumable(1);
    const second = generateConsumable(1);
    addToInventory(p, first);
    addToInventory(p, second);

    assignToBelt(p, first.id, 2);
    const result = assignToBelt(p, second.id, 2);

    expect(result).toBe(true);
    expect(p.belt[2]).toEqual(second);
    expect(p.inventory).toContain(first);
    expect(p.inventory).not.toContain(second);
  });

  it('returns null for empty belt slot', () => {
    const p = makePlayer();
    const used = useBeltSlot(p, 0);
    expect(used).toBeNull();
  });
});

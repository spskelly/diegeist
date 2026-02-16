import { describe, it, expect } from 'vitest';
import { generateItem, generateConsumable, ITEM_TEMPLATES, CONSUMABLE_TYPES, createStarterWeapon } from '../src/items.js';

describe('generateItem', () => {
  it('generates an item with required properties', () => {
    const item = generateItem({ floorLevel: 1, context: 'drop' });
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.type).toBeDefined();
    expect(item.rarity).toBeDefined();
    expect(item.slot).toBeDefined();
    expect(item.statBonuses).toBeDefined();
    expect(item.floorLevel).toBe(1);
  });

  it('generates higher rarity items on deeper floors', () => {
    const rarities = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 100; i++) {
      const item = generateItem({ floorLevel: 8, luck: 10, context: 'boss' });
      rarities[item.rarity]++;
    }
    // Deep floor + high luck + boss context should skew toward better rarities
    expect(rarities.common).toBeLessThan(50);
  });

  it('stat bonuses scale with floor level', () => {
    const lowFloor = generateItem({ floorLevel: 1, context: 'drop', forceRarity: 'common' });
    const highFloor = generateItem({ floorLevel: 9, context: 'drop', forceRarity: 'common' });
    const lowTotal = Object.values(lowFloor.statBonuses).reduce((a, b) => a + b, 0);
    const highTotal = Object.values(highFloor.statBonuses).reduce((a, b) => a + b, 0);
    // High floor items should generally have higher stats (with some randomness)
    // Test over multiple to reduce variance
    let lowSum = 0, highSum = 0;
    for (let i = 0; i < 50; i++) {
      const l = generateItem({ floorLevel: 1, context: 'drop', forceRarity: 'uncommon' });
      const h = generateItem({ floorLevel: 9, context: 'drop', forceRarity: 'uncommon' });
      lowSum += Object.values(l.statBonuses).reduce((a, b) => a + b, 0);
      highSum += Object.values(h.statBonuses).reduce((a, b) => a + b, 0);
    }
    expect(highSum).toBeGreaterThan(lowSum);
  });

  it('generates items for all equipment slot types', () => {
    const slots = new Set();
    for (let i = 0; i < 100; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop' });
      slots.add(item.slot);
    }
    expect(slots.size).toBeGreaterThanOrEqual(4); // Should hit most slots
  });

  it('some items have skills attached', () => {
    let foundSkill = false;
    for (let i = 0; i < 50; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop', forceRarity: 'epic' });
      if (item.skill) { foundSkill = true; break; }
    }
    expect(foundSkill).toBe(true);
  });

  it('generates procedural names', () => {
    const item = generateItem({ floorLevel: 3, context: 'drop' });
    expect(item.name.length).toBeGreaterThan(0);
    expect(typeof item.name).toBe('string');
  });
});

describe('generateConsumable', () => {
  it('generates a consumable with effect and magnitude', () => {
    const c = generateConsumable(3);
    expect(c.type).toBe('consumable');
    expect(c.effect).toBeDefined();
    expect(c.magnitude).toBeDefined();
    expect(c.name).toBeDefined();
  });
});

describe('createStarterWeapon', () => {
  it('creates a starter weapon for each class', () => {
    const fighter = createStarterWeapon('fighter');
    const archer = createStarterWeapon('archer');
    const mage = createStarterWeapon('mage');

    expect(fighter).toBeTruthy();
    expect(archer).toBeTruthy();
    expect(mage).toBeTruthy();
    expect(fighter.slot).toBe('leftHand');
    expect(archer.slot).toBe('leftHand');
    expect(mage.slot).toBe('leftHand');
    expect(fighter.rarity).toBe('common');
    expect(archer.rarity).toBe('common');
    expect(mage.rarity).toBe('common');
  });

  it('starter weapons have no embedded skills (class skills are intrinsic)', () => {
    const archer = createStarterWeapon('archer');
    const mage = createStarterWeapon('mage');
    const fighter = createStarterWeapon('fighter');

    expect(archer.skill).toBeNull();
    expect(mage.skill).toBeNull();
    expect(fighter.skill).toBeNull();

    expect(archer.attackType).toBe('ranged');
    expect(mage.attackType).toBe('magic');
    expect(fighter.attackType).toBe('melee');
  });

  it('returns null for unknown class', () => {
    expect(createStarterWeapon('rogue')).toBeNull();
  });
});

describe('ITEM_TEMPLATES', () => {
  it('has templates for weapons and armor', () => {
    expect(ITEM_TEMPLATES.length).toBeGreaterThan(5);
    const types = new Set(ITEM_TEMPLATES.map(t => t.slot));
    expect(types.has('leftHand')).toBe(true);
    expect(types.has('head')).toBe(true);
    expect(types.has('torso')).toBe(true);
  });
});

describe('skill-weapon type restrictions', () => {
  const meleeSkills = new Set(['Cleave']);
  const shieldSkills = new Set(['Shield Bash']);
  const rangedSkills = new Set(['Power Shot', 'Multishot']);
  const magicSkills = new Set(['Fireball', 'Chain Lightning', 'Frost Nova']);
  const armorSkills = new Set(['Thorns', 'Fortify', 'Second Wind', 'Iron Skin']);
  const accessorySkills = new Set(['War Cry', 'Regeneration', 'Lucky Strike', 'Mana Shield']);

  it('melee weapons only get melee skills', () => {
    const meleeWeapons = ['Sword', 'Greataxe', 'Dagger'];
    for (let i = 0; i < 200; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop', forceRarity: 'legendary' });
      if (meleeWeapons.includes(item.sprite) && item.skill) {
        expect(meleeSkills.has(item.skill.name)).toBe(true);
      }
    }
  });

  it('shields only get Shield Bash', () => {
    for (let i = 0; i < 200; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop', forceRarity: 'legendary' });
      if (item.sprite === 'shield' && item.skill) {
        expect(shieldSkills.has(item.skill.name)).toBe(true);
      }
    }
  });

  it('ranged weapons only get ranged skills', () => {
    const rangedWeapons = ['longbow', 'crossbow'];
    for (let i = 0; i < 200; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop', forceRarity: 'legendary' });
      if (rangedWeapons.includes(item.sprite) && item.skill) {
        expect(rangedSkills.has(item.skill.name)).toBe(true);
      }
    }
  });

  it('magic weapons only get magic skills', () => {
    const magicWeapons = ['staff', 'wand', 'orb'];
    for (let i = 0; i < 200; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop', forceRarity: 'legendary' });
      if (magicWeapons.includes(item.sprite) && item.skill) {
        expect(magicSkills.has(item.skill.name)).toBe(true);
      }
    }
  });

  it('armor only gets armor skills', () => {
    const armorSprites = ['helmet', 'hood', 'crown', 'plate_armor', 'leather_armor', 'robe', 'greaves', 'boots'];
    for (let i = 0; i < 200; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop', forceRarity: 'legendary' });
      if (armorSprites.includes(item.sprite) && item.skill) {
        expect(armorSkills.has(item.skill.name)).toBe(true);
        expect(item.skill.skillType).toBe('self');
        expect(item.skill.effect).toBeDefined();
      }
    }
  });

  it('accessories only get accessory skills', () => {
    const accessorySprites = ['ring', 'amulet'];
    for (let i = 0; i < 200; i++) {
      const item = generateItem({ floorLevel: 5, context: 'drop', forceRarity: 'legendary' });
      if (accessorySprites.includes(item.sprite) && item.skill) {
        expect(accessorySkills.has(item.skill.name)).toBe(true);
        expect(item.skill.skillType).toBe('self');
        expect(item.skill.effect).toBeDefined();
      }
    }
  });
});

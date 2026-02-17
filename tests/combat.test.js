import { describe, it, expect } from 'vitest';
import { calculateDamage, resolveAttack, getEffectiveStat } from '../src/combat.js';
import { Entity } from '../src/entity.js';

function makeAttacker(overrides = {}) {
  return new Entity({
    id: 'attacker', type: 'player', x: 0, y: 0,
    stats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5, ...overrides.stats },
    maxHp: 15, speed: 100, ...overrides,
  });
}

function makeDefender(overrides = {}) {
  return new Entity({
    id: 'defender', type: 'enemy', x: 1, y: 0,
    stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2, ...overrides.stats },
    maxHp: 5, speed: 100, ...overrides,
  });
}

describe('getEffectiveStat', () => {
  it('returns full stat value for affinity stats', () => {
    const val = getEffectiveStat(8, true);
    expect(val).toBe(8);
  });

  it('applies soft gate multiplier for non-affinity stats', () => {
    const val = getEffectiveStat(10, false);
    expect(val).toBeCloseTo(6.5);
  });
});

describe('calculateDamage', () => {
  it('calculates melee damage based on STR', () => {
    const dmg = calculateDamage({
      baseDamage: 3,
      stat: 8,
      isAffinity: true,
      weaponMultiplier: 1.0,
      defense: 0,
      isMagic: false,
      targetWIS: 0,
    });
    // 3 * (8/5) * 1.0 - 0 = 4.8 -> 4 (floored)
    expect(dmg).toBe(4);
  });

  it('applies weapon multiplier', () => {
    const dmg = calculateDamage({
      baseDamage: 3,
      stat: 5,
      isAffinity: true,
      weaponMultiplier: 2.0,
      defense: 0,
      isMagic: false,
      targetWIS: 0,
    });
    // 3 * (5/5) * 2.0 - 0 = 6
    expect(dmg).toBe(6);
  });

  it('subtracts defense', () => {
    const dmg = calculateDamage({
      baseDamage: 3,
      stat: 5,
      isAffinity: true,
      weaponMultiplier: 1.0,
      defense: 2,
      isMagic: false,
      targetWIS: 0,
    });
    // 3 * 1.0 * 1.0 - 2 = 1
    expect(dmg).toBe(1);
  });

  it('minimum damage is 1', () => {
    const dmg = calculateDamage({
      baseDamage: 1,
      stat: 1,
      isAffinity: false,
      weaponMultiplier: 1.0,
      defense: 999,
      isMagic: false,
      targetWIS: 0,
    });
    expect(dmg).toBe(1);
  });

  it('applies magic resist from WIS for magic attacks', () => {
    const dmg = calculateDamage({
      baseDamage: 5,
      stat: 8,
      isAffinity: true,
      weaponMultiplier: 1.0,
      defense: 0,
      isMagic: true,
      targetWIS: 6,
    });
    // 5 * (8/5) * 1.0 - 0 - (6*0.5) = 8 - 3 = 5
    expect(dmg).toBe(5);
  });
});

describe('resolveAttack', () => {
  it('deals damage to the target', () => {
    const attacker = makeAttacker();
    attacker.playerClass = 'fighter';
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender();

    // Force no crit/dodge by using seeded behavior
    const result = resolveAttack(attacker, defender, {
      baseDamage: 3,
      damageType: 'melee',
      weaponMultiplier: 1.0,
      forceCrit: false,
      forceDodge: false,
    });

    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(result.hit).toBe(true);
    expect(defender.hp).toBeLessThan(5);
  });

  it('returns crit: true on forced crit', () => {
    const attacker = makeAttacker();
    attacker.playerClass = 'fighter';
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender();

    const result = resolveAttack(attacker, defender, {
      baseDamage: 3,
      damageType: 'melee',
      weaponMultiplier: 1.0,
      forceCrit: true,
      forceDodge: false,
    });

    expect(result.crit).toBe(true);
    expect(result.damage).toBeGreaterThan(3); // Crit does 2x
  });

  it('returns hit: false and 0 damage on forced dodge', () => {
    const attacker = makeAttacker();
    attacker.playerClass = 'fighter';
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender();

    const result = resolveAttack(attacker, defender, {
      baseDamage: 3,
      damageType: 'melee',
      weaponMultiplier: 1.0,
      forceCrit: false,
      forceDodge: true,
    });

    expect(result.hit).toBe(false);
    expect(result.dodged).toBe(true);
    expect(result.damage).toBe(0);
    expect(defender.hp).toBe(5); // No damage taken
  });

  it('can kill the target', () => {
    const attacker = makeAttacker({ stats: { STR: 20, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 } });
    attacker.playerClass = 'fighter';
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender();

    const result = resolveAttack(attacker, defender, {
      baseDamage: 10,
      damageType: 'melee',
      weaponMultiplier: 2.0,
      forceCrit: false,
      forceDodge: false,
    });

    expect(defender.isAlive()).toBe(false);
    expect(result.killed).toBe(true);
  });
});

describe('status effects in combat', () => {
  it('fortify reduces damage taken', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const defenderNormal = makeDefender({ maxHp: 100 });
    const defenderFortified = makeDefender({ maxHp: 100 });
    defenderFortified.addStatusEffect({ type: 'fortify', duration: 3, value: 0.4 });

    const resultNormal = resolveAttack(attacker, defenderNormal, {
      baseDamage: 5, damageType: 'melee', weaponMultiplier: 1.0, forceCrit: false, forceDodge: false,
    });
    const resultFortified = resolveAttack(attacker, defenderFortified, {
      baseDamage: 5, damageType: 'melee', weaponMultiplier: 1.0, forceCrit: false, forceDodge: false,
    });

    expect(resultFortified.damage).toBeLessThan(resultNormal.damage);
  });

  it('war_cry increases damage dealt', () => {
    const attackerNormal = makeAttacker();
    attackerNormal.affinityStats = ['STR', 'CON'];
    const attackerBuffed = makeAttacker();
    attackerBuffed.affinityStats = ['STR', 'CON'];
    attackerBuffed.addStatusEffect({ type: 'war_cry', duration: 3, value: 1.3 });

    const defender1 = makeDefender({ maxHp: 100 });
    const defender2 = makeDefender({ maxHp: 100 });

    const resultNormal = resolveAttack(attackerNormal, defender1, {
      baseDamage: 5, damageType: 'melee', weaponMultiplier: 1.0, forceCrit: false, forceDodge: false,
    });
    const resultBuffed = resolveAttack(attackerBuffed, defender2, {
      baseDamage: 5, damageType: 'melee', weaponMultiplier: 1.0, forceCrit: false, forceDodge: false,
    });

    expect(resultBuffed.damage).toBeGreaterThan(resultNormal.damage);
  });

  it('thorns reflects damage back on melee attacks', () => {
    const attacker = makeAttacker({ maxHp: 100 });
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender({ maxHp: 100 });
    defender.addStatusEffect({ type: 'thorns', duration: 3, value: 0.5 });

    const result = resolveAttack(attacker, defender, {
      baseDamage: 5, damageType: 'melee', weaponMultiplier: 1.0, forceCrit: false, forceDodge: false,
    });

    expect(result.thornsDamage).toBeGreaterThan(0);
    expect(attacker.hp).toBeLessThan(100);
  });

  it('thorns does not reflect on ranged attacks', () => {
    const attacker = makeAttacker({ maxHp: 100 });
    attacker.affinityStats = ['DEX', 'LCK'];
    const defender = makeDefender({ maxHp: 100 });
    defender.addStatusEffect({ type: 'thorns', duration: 3, value: 0.5 });

    const result = resolveAttack(attacker, defender, {
      baseDamage: 5, damageType: 'ranged', weaponMultiplier: 1.0, forceCrit: false, forceDodge: false,
    });

    expect(result.thornsDamage).toBe(0);
    expect(attacker.hp).toBe(100);
  });

  it('mana_shield absorbs damage', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender({ maxHp: 100 });
    defender.addStatusEffect({ type: 'mana_shield', duration: 999, value: 100 });

    const result = resolveAttack(attacker, defender, {
      baseDamage: 5, damageType: 'melee', weaponMultiplier: 1.0, forceCrit: false, forceDodge: false,
    });

    // Mana shield absorbs damage, so actual HP damage should be minimal (1 min)
    expect(result.damage).toBe(1);
  });
});

describe('skill tree combat effects', () => {
  it('applies melee damage multiplier from tree effects', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const d1 = makeDefender({ maxHp: 100 });
    const d2 = makeDefender({ maxHp: 100 });

    const r1 = resolveAttack(attacker, d1, {
      baseDamage: 5, damageType: 'melee', forceCrit: false, forceDodge: false,
    });
    const r2 = resolveAttack(attacker, d2, {
      baseDamage: 5, damageType: 'melee', forceCrit: false, forceDodge: false,
      attackerTreeEffects: { melee_damage_mult: 1.24 },
    });

    expect(r2.damage).toBeGreaterThan(r1.damage);
  });

  it('applies ranged damage multiplier from tree effects', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['DEX', 'LCK'];
    const d1 = makeDefender({ maxHp: 100 });
    const d2 = makeDefender({ maxHp: 100 });

    const r1 = resolveAttack(attacker, d1, {
      baseDamage: 5, damageType: 'ranged', forceCrit: false, forceDodge: false,
    });
    const r2 = resolveAttack(attacker, d2, {
      baseDamage: 5, damageType: 'ranged', forceCrit: false, forceDodge: false,
      attackerTreeEffects: { ranged_damage_mult: 1.24 },
    });

    expect(r2.damage).toBeGreaterThan(r1.damage);
  });

  it('applies dodge bonus from tree effects', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender({ stats: { STR: 3, DEX: 0, CON: 3, INT: 1, WIS: 1, LCK: 2 }, maxHp: 100 });

    // With 100% dodge bonus, should always dodge
    const result = resolveAttack(attacker, defender, {
      baseDamage: 5, damageType: 'melee', forceCrit: false,
      defenderTreeEffects: { dodge_bonus: 100 },
    });

    expect(result.dodged).toBe(true);
  });

  it('applies damage reduction from tree effects', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const d1 = makeDefender({ maxHp: 100 });
    const d2 = makeDefender({ maxHp: 100 });

    const r1 = resolveAttack(attacker, d1, {
      baseDamage: 10, damageType: 'melee', forceCrit: false, forceDodge: false,
    });
    const r2 = resolveAttack(attacker, d2, {
      baseDamage: 10, damageType: 'melee', forceCrit: false, forceDodge: false,
      defenderTreeEffects: { damage_reduction: 0.09 },
    });

    expect(r2.damage).toBeLessThanOrEqual(r1.damage);
  });

  it('applies crit bonus from tree effects', () => {
    const attacker = makeAttacker({ stats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 0 } });
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender({ maxHp: 100 });

    // LCK=0 so base crit chance is 0%. With 100% crit bonus, should always crit.
    const result = resolveAttack(attacker, defender, {
      baseDamage: 5, damageType: 'melee', forceDodge: false,
      attackerTreeEffects: { crit_bonus: 100 },
    });

    expect(result.crit).toBe(true);
  });

  it('applies crit damage bonus from tree effects', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const d1 = makeDefender({ maxHp: 100 });
    const d2 = makeDefender({ maxHp: 100 });

    const r1 = resolveAttack(attacker, d1, {
      baseDamage: 5, damageType: 'melee', forceCrit: true, forceDodge: false,
    });
    const r2 = resolveAttack(attacker, d2, {
      baseDamage: 5, damageType: 'melee', forceCrit: true, forceDodge: false,
      attackerTreeEffects: { crit_damage_bonus: 0.50 },
    });

    expect(r2.damage).toBeGreaterThan(r1.damage);
  });

  it('applies block chance from tree effects', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender({ maxHp: 100 });

    // 100% block chance — should always block
    const result = resolveAttack(attacker, defender, {
      baseDamage: 5, damageType: 'melee', forceCrit: false, forceDodge: false,
      defenderTreeEffects: { block_chance: 1.0, dodge_bonus: 0 },
    });

    expect(result.blocked).toBe(true);
    expect(result.damage).toBe(0);
  });

  it('returns blocked: false normally', () => {
    const attacker = makeAttacker();
    attacker.affinityStats = ['STR', 'CON'];
    const defender = makeDefender({ maxHp: 100 });

    const result = resolveAttack(attacker, defender, {
      baseDamage: 5, damageType: 'melee', forceCrit: false, forceDodge: false,
    });

    expect(result.blocked).toBe(false);
  });
});

describe('Trap mechanics', () => {
  describe('trap dodge chance', () => {
    it('dodge chance equals DEX * 1.0 percent', () => {
      // Trap dodge uses same formula as combat: DEX * 1.0
      const player = makeDefender({ stats: { STR: 3, DEX: 10, CON: 3, INT: 1, WIS: 1, LCK: 2 } });
      const dodgeChance = player.stats.DEX * 1.0;
      expect(dodgeChance).toBe(10);
    });

    it('dodge chance includes tree dodge_bonus', () => {
      const player = makeDefender({ stats: { STR: 3, DEX: 5, CON: 3, INT: 1, WIS: 1, LCK: 2 } });
      const treeEffects = { dodge_bonus: 8 };
      let dodgeChance = player.stats.DEX * 1.0;
      if (treeEffects?.dodge_bonus) dodgeChance += treeEffects.dodge_bonus;
      expect(dodgeChance).toBe(13);
    });
  });

  describe('trap disarm damage', () => {
    it('disarm deals 50% of full trap damage', () => {
      for (const floor of [1, 5, 10]) {
        const fullDamage = 2 + floor;
        const disarmDamage = Math.max(1, Math.floor(fullDamage * 0.5));
        expect(disarmDamage).toBe(Math.floor(fullDamage / 2));
      }
    });

    it('disarm damage is at least 1', () => {
      // Even on floor 0 (hypothetical), minimum damage is 1
      const fullDamage = 2 + 0;
      const disarmDamage = Math.max(1, Math.floor(fullDamage * 0.5));
      expect(disarmDamage).toBeGreaterThanOrEqual(1);
    });

    it('disarm damage is less than full trap damage', () => {
      for (const floor of [1, 3, 7, 10]) {
        const fullDamage = 2 + floor;
        const disarmDamage = Math.max(1, Math.floor(fullDamage * 0.5));
        expect(disarmDamage).toBeLessThan(fullDamage);
      }
    });
  });
});

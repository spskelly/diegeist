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

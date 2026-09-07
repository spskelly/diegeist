import { describe, it, expect } from 'vitest';
import { createPlayer, computePlayerMaxHp, getLevelStatBonuses } from '../src/player.js';
import { PLAYER_CLASSES, BASE_SPEED } from '../src/constants.js';

describe('createPlayer', () => {
  it('creates a fighter with correct base stats', () => {
    const p = createPlayer('fighter', 5, 5);
    expect(p.type).toBe('player');
    expect(p.stats.STR).toBe(8);
    expect(p.stats.DEX).toBe(5);
    expect(p.stats.CON).toBe(7);
    // 50 base + 7 con * 2
    expect(p.maxHp).toBe(64);
    expect(p.hp).toBe(64);
    expect(p.speed).toBe(BASE_SPEED);
    expect(p.position.x).toBe(5);
    expect(p.position.y).toBe(5);
  });

  it('creates an archer with correct base stats', () => {
    const p = createPlayer('archer', 0, 0);
    expect(p.stats.DEX).toBe(8);
    expect(p.stats.LCK).toBe(6);
    expect(p.maxHp).toBe(46);
  });

  it('creates a mage with correct base stats', () => {
    const p = createPlayer('mage', 0, 0);
    expect(p.stats.INT).toBe(8);
    expect(p.stats.WIS).toBe(7);
    expect(p.maxHp).toBe(42);
  });

  it('stores the class key on the player', () => {
    const p = createPlayer('fighter', 0, 0);
    expect(p.playerClass).toBe('fighter');
  });

  it('stores affinity stats from the class', () => {
    const p = createPlayer('fighter', 0, 0);
    expect(p.affinityStats).toEqual(['STR', 'CON']);
  });

  it('initializes with empty inventory and belt', () => {
    const p = createPlayer('fighter', 0, 0);
    expect(p.inventory).toEqual([]);
    expect(p.belt).toEqual([null, null, null]);
  });

  it('initializes gold to 0 and floorNumber to 1', () => {
    const p = createPlayer('fighter', 0, 0);
    expect(p.gold).toBe(0);
    expect(p.floorNumber).toBe(1);
  });

  it('applies permanent stat bonuses if provided', () => {
    const p = createPlayer('fighter', 0, 0, { STR: 2, CON: 1 });
    expect(p.stats.STR).toBe(10);
    expect(p.stats.CON).toBe(8);
    expect(p.stats.DEX).toBe(5); // unchanged
  });

  it('ignores missing permanent bonuses gracefully', () => {
    const p = createPlayer('mage', 3, 7, {});
    expect(p.stats.INT).toBe(8);
    expect(p.position.x).toBe(3);
    expect(p.position.y).toBe(7);
  });

  it('grants affinity stats every two levels', () => {
    expect(getLevelStatBonuses('fighter', 1)).toMatchObject({ STR: 0, CON: 0, DEX: 0 });
    expect(getLevelStatBonuses('fighter', 4)).toMatchObject({ STR: 2, CON: 2, DEX: 0 });
    const p = createPlayer('archer', 0, 0, {}, 6);
    expect(p.stats.DEX).toBe(11);
    expect(p.stats.LCK).toBe(9);
    expect(p.stats.STR).toBe(4);
    expect(p.level).toBe(6);
  });

  it('scales max hp with level, con and tree multiplier', () => {
    const base = computePlayerMaxHp('fighter', { CON: 7 }, 1);
    expect(base).toBe(64);
    expect(computePlayerMaxHp('fighter', { CON: 7 }, 11)).toBe(Math.round(64 * 1.8));
    expect(computePlayerMaxHp('fighter', { CON: 12 }, 1)).toBe(74);
    expect(computePlayerMaxHp('fighter', { CON: 7 }, 1, { max_hp_mult: 1.18 })).toBe(Math.round(64 * 1.18));
    const leveled = createPlayer('fighter', 0, 0, {}, 5);
    expect(leveled.maxHp).toBeGreaterThan(base);
  });
});

import { describe, it, expect } from 'vitest';
import { createPlayer } from '../src/player.js';
import { PLAYER_CLASSES, BASE_SPEED } from '../src/constants.js';

describe('createPlayer', () => {
  it('creates a fighter with correct base stats', () => {
    const p = createPlayer('fighter', 5, 5);
    expect(p.type).toBe('player');
    expect(p.stats.STR).toBe(8);
    expect(p.stats.DEX).toBe(5);
    expect(p.stats.CON).toBe(7);
    expect(p.maxHp).toBe(15);
    expect(p.hp).toBe(15);
    expect(p.speed).toBe(BASE_SPEED);
    expect(p.position.x).toBe(5);
    expect(p.position.y).toBe(5);
  });

  it('creates an archer with correct base stats', () => {
    const p = createPlayer('archer', 0, 0);
    expect(p.stats.DEX).toBe(8);
    expect(p.stats.LCK).toBe(6);
    expect(p.maxHp).toBe(10);
  });

  it('creates a mage with correct base stats', () => {
    const p = createPlayer('mage', 0, 0);
    expect(p.stats.INT).toBe(8);
    expect(p.stats.WIS).toBe(7);
    expect(p.maxHp).toBe(10);
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
});

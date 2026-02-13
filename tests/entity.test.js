import { describe, it, expect } from 'vitest';
import { Entity } from '../src/entity.js';

describe('Entity', () => {
  it('creates an entity with position and stats', () => {
    const e = new Entity({
      id: 'rat_1',
      type: 'enemy',
      x: 5, y: 3,
      stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 },
      maxHp: 5,
      speed: 100,
    });
    expect(e.id).toBe('rat_1');
    expect(e.position.x).toBe(5);
    expect(e.position.y).toBe(3);
    expect(e.hp).toBe(5);
    expect(e.maxHp).toBe(5);
    expect(e.speed).toBe(100);
    expect(e.energy).toBe(0);
  });

  it('accumulates energy based on speed', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    e.gainEnergy();
    expect(e.energy).toBe(100);
  });

  it('reports ready when energy >= threshold', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    expect(e.isReady()).toBe(false);
    e.gainEnergy();
    expect(e.isReady()).toBe(true);
  });

  it('spends energy on taking a turn', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 150 });
    e.gainEnergy();
    expect(e.isReady()).toBe(true);
    e.spendTurn();
    expect(e.energy).toBe(50);
  });

  it('can take damage and die', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    e.takeDamage(3);
    expect(e.hp).toBe(2);
    expect(e.isAlive()).toBe(true);
    e.takeDamage(5);
    expect(e.hp).toBe(0);
    expect(e.isAlive()).toBe(false);
  });

  it('hp does not go below 0', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    e.takeDamage(999);
    expect(e.hp).toBe(0);
  });

  it('can heal up to maxHp', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 10, speed: 100 });
    e.takeDamage(5);
    e.heal(3);
    expect(e.hp).toBe(8);
    e.heal(999);
    expect(e.hp).toBe(10);
  });

  it('moves to a new position', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 3, y: 4, stats: {}, maxHp: 5, speed: 100 });
    e.moveTo(5, 6);
    expect(e.position.x).toBe(5);
    expect(e.position.y).toBe(6);
  });

  it('initializes with empty equipment, inventory, belt', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    expect(e.equipment.head).toBeNull();
    expect(e.equipment.torso).toBeNull();
    expect(e.inventory).toEqual([]);
    expect(e.belt).toEqual([null, null, null]);
  });

  it('fills in missing stats with 0', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: { STR: 5 }, maxHp: 5, speed: 100 });
    expect(e.stats.STR).toBe(5);
    expect(e.stats.DEX).toBe(0);
    expect(e.stats.CON).toBe(0);
  });
});

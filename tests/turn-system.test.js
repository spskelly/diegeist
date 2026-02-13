import { describe, it, expect } from 'vitest';
import { TurnSystem } from '../src/turn-system.js';
import { Entity } from '../src/entity.js';

function makeEntity(id, speed) {
  return new Entity({ id, type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed });
}

describe('TurnSystem', () => {
  it('registers entities', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);
    expect(ts.entities).toHaveLength(1);
  });

  it('removes entities by id', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);
    ts.removeEntity('e1');
    expect(ts.entities).toHaveLength(0);
  });

  it('ticks all entities and returns those ready (sorted by excess energy desc)', () => {
    const ts = new TurnSystem();
    const slow = makeEntity('slow', 50);
    const normal = makeEntity('normal', 100);
    const fast = makeEntity('fast', 150);
    ts.addEntity(slow);
    ts.addEntity(normal);
    ts.addEntity(fast);

    const ready = ts.tick();
    expect(ready.map(e => e.id)).toEqual(['fast', 'normal']);
    expect(slow.isReady()).toBe(false);
  });

  it('handles multiple ticks correctly', () => {
    const ts = new TurnSystem();
    const slow = makeEntity('slow', 50);
    ts.addEntity(slow);

    let ready = ts.tick();
    expect(ready).toHaveLength(0);

    ready = ts.tick();
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('slow');
  });

  it('entities spend energy after acting - next tick gives them another turn', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);

    let ready = ts.tick();
    expect(ready).toHaveLength(1);
    ready[0].spendTurn();

    ready = ts.tick();
    expect(ready).toHaveLength(1);
  });

  it('skips dead entities', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);
    e.takeDamage(999);

    const ready = ts.tick();
    expect(ready).toHaveLength(0);
  });

  it('handles empty entity list', () => {
    const ts = new TurnSystem();
    const ready = ts.tick();
    expect(ready).toEqual([]);
  });

  it('handles mixed speeds over multiple ticks', () => {
    const ts = new TurnSystem();
    const slow = makeEntity('slow', 50);
    const fast = makeEntity('fast', 200);
    ts.addEntity(slow);
    ts.addEntity(fast);

    // Tick 1: slow=50, fast=200 -> fast ready (excess 100)
    let ready = ts.tick();
    expect(ready.map(e => e.id)).toEqual(['fast']);
    fast.spendTurn(); // fast energy = 100

    // Tick 2: slow=100, fast=300 -> both ready. fast has excess 200, slow has excess 0
    ready = ts.tick();
    expect(ready.map(e => e.id)).toEqual(['fast', 'slow']);
  });
});

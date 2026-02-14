import { describe, it, expect } from 'vitest';
import { getAIAction } from '../src/ai.js';
import { GameMap } from '../src/game-map.js';
import { Entity } from '../src/entity.js';
import { TILE } from '../src/constants.js';

function makeOpenMap(size = 20) {
  const map = new GameMap(size, size);
  for (let y = 1; y < size - 1; y++)
    for (let x = 1; x < size - 1; x++)
      map.setTile(x, y, TILE.FLOOR);
  return map;
}

function makeEnemy(x, y, behavior, overrides = {}) {
  const e = new Entity({
    id: `enemy_${x}_${y}`, type: 'enemy', x, y,
    stats: { STR: 5, DEX: 5, CON: 5, INT: 5, WIS: 5, LCK: 5 },
    maxHp: 10, speed: 100, behavior, ...overrides,
  });
  e.affinityStats = [];
  return e;
}

function makePlayer(x, y) {
  const p = new Entity({
    id: 'player', type: 'player', x, y,
    stats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 },
    maxHp: 15, speed: 100,
  });
  p.playerClass = 'fighter';
  p.affinityStats = ['STR', 'CON'];
  return p;
}

describe('getAIAction - wander', () => {
  it('returns a move action to an adjacent walkable tile', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'wander');
    const player = makePlayer(15, 15); // far away
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('move');
    const dx = Math.abs(action.x - 5);
    const dy = Math.abs(action.y - 5);
    expect(dx + dy).toBe(1); // adjacent
  });
});

describe('getAIAction - rushdown', () => {
  it('moves toward the player when not adjacent', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'rushdown');
    const player = makePlayer(8, 5);
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('move');
    expect(action.x).toBe(6); // moves toward player
    expect(action.y).toBe(5);
  });

  it('attacks when adjacent to player', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'rushdown');
    const player = makePlayer(6, 5);
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('attack');
    expect(action.targetX).toBe(6);
    expect(action.targetY).toBe(5);
  });
});

describe('getAIAction - kiting', () => {
  it('retreats when player is too close', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'kiting');
    const player = makePlayer(6, 5); // 1 tile away - too close
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('move');
    // Should move away from player (toward lower x)
    expect(action.x).toBeLessThanOrEqual(5);
  });

  it('attacks at preferred range', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'kiting');
    const player = makePlayer(9, 5); // 4 tiles away - in range
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('attack');
  });

  it('approaches if player is too far', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'kiting');
    const player = makePlayer(15, 5); // 10 tiles away - too far
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('move');
    expect(action.x).toBeGreaterThan(5); // moves toward player
  });
});

describe('getAIAction - ambush', () => {
  it('stays hidden when player is far', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'ambush');
    enemy.hidden = true;
    const player = makePlayer(15, 15);
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('wait');
    expect(enemy.hidden).toBe(true);
  });

  it('reveals and attacks when player is within 2 tiles', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'ambush');
    enemy.hidden = true;
    const player = makePlayer(6, 5); // 1 tile away
    const action = getAIAction(enemy, player, map, []);
    expect(enemy.hidden).toBe(false);
    expect(action.type).toBe('attack');
  });
});

describe('getAIAction - summoner', () => {
  it('spawns a minion when cooldown is ready', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'summoner');
    enemy.summonCooldown = 0;
    const player = makePlayer(10, 10);
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('summon');
    expect(action.spawnX).toBeDefined();
    expect(action.spawnY).toBeDefined();
    expect(enemy.summonCooldown).toBeGreaterThan(0);
  });

  it('attacks at range when summon is on cooldown', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'summoner');
    enemy.summonCooldown = 3;
    const player = makePlayer(9, 5);
    const action = getAIAction(enemy, player, map, []);
    expect(action.type).toBe('attack');
  });

  it('does not summon when it already has too many minions', () => {
    const map = makeOpenMap();
    const enemy = makeEnemy(5, 5, 'summoner');
    enemy.summonCooldown = 0;
    const player = makePlayer(9, 5);
    const minionA = makeEnemy(6, 6, 'rushdown');
    minionA.isSummonedMinion = true;
    minionA.summonedBy = enemy.id;
    const minionB = makeEnemy(7, 6, 'rushdown');
    minionB.isSummonedMinion = true;
    minionB.summonedBy = enemy.id;
    const action = getAIAction(enemy, player, map, [enemy, minionA, minionB]);
    expect(action.type).not.toBe('summon');
  });
});

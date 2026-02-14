// src/ai.js
import { findPath } from './pathfinding.js';

function distance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function hasLineOfSight(map, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) return true;
    if (map.blocksLOS(x, y)) return false;
  }

  return true;
}

const SUMMONER_COOLDOWN_TURNS = 6;
const MAX_SUMMONED_MINIONS_TOTAL = 8;
const MAX_SUMMONED_MINIONS_PER_SUMMONER = 2;

function countSummonedMinions(allEntities, summonerId = null) {
  return allEntities.filter(e => {
    if (e.type !== 'enemy' || !e.isAlive()) return false;
    const looksLikeSummonedMinion = e.isSummonedMinion || e.name === 'Minion';
    if (!looksLikeSummonedMinion) return false;
    if (summonerId === null) return true;
    if (e.summonedBy) return e.summonedBy === summonerId;
    // Fallback for legacy minions without ownership tags.
    return true;
  }).length;
}

function getWanderAction(enemy, map, allEntities) {
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  const shuffled = dirs.sort(() => Math.random() - 0.5);
  for (const d of shuffled) {
    const nx = enemy.position.x + d.dx;
    const ny = enemy.position.y + d.dy;
    if (map.isWalkable(nx, ny)) {
      const occupied = allEntities.some(e => e !== enemy && e.isAlive() && e.position.x === nx && e.position.y === ny);
      if (!occupied) {
        return { type: 'move', x: nx, y: ny };
      }
    }
  }
  return { type: 'wait' };
}

function getRushdownAction(enemy, player, map, allEntities) {
  const dist = distance(enemy.position.x, enemy.position.y, player.position.x, player.position.y);

  // Adjacent to player? Attack!
  if (dist === 1) {
    return { type: 'attack', targetX: player.position.x, targetY: player.position.y, damageType: 'melee' };
  }

  // Pathfind toward player
  const blocked = allEntities
    .filter(e => e !== enemy && e.isAlive() && e.id !== 'player')
    .map(e => e.position);
  const path = findPath(map, enemy.position.x, enemy.position.y, player.position.x, player.position.y, blocked);

  if (path && path.length > 0) {
    return { type: 'move', x: path[0].x, y: path[0].y };
  }

  return getWanderAction(enemy, map, allEntities);
}

function getKitingAction(enemy, player, map, allEntities) {
  const dist = distance(enemy.position.x, enemy.position.y, player.position.x, player.position.y);
  const preferredMin = 3;
  const preferredMax = 5;
  const canSeePlayer = hasLineOfSight(map, enemy.position.x, enemy.position.y, player.position.x, player.position.y);

  // In preferred range? Attack!
  if (dist >= preferredMin && dist <= preferredMax && canSeePlayer) {
    return { type: 'attack', targetX: player.position.x, targetY: player.position.y, damageType: 'ranged' };
  }

  // Too close? Retreat
  if (dist < preferredMin) {
    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    // Try to move away
    const retreatDirs = [
      { dx: Math.sign(dx), dy: 0 },
      { dx: 0, dy: Math.sign(dy) },
      { dx: Math.sign(dx), dy: Math.sign(dy) ? Math.sign(dy) : 1 },
    ].filter(d => d.dx !== 0 || d.dy !== 0);

    for (const d of retreatDirs) {
      const nx = enemy.position.x + d.dx;
      const ny = enemy.position.y + d.dy;
      if (map.isWalkable(nx, ny)) {
        return { type: 'move', x: nx, y: ny };
      }
    }
    return { type: 'wait' };
  }

  // Too far? Approach
  const blocked = allEntities.filter(e => e !== enemy && e.isAlive() && e.id !== 'player').map(e => e.position);
  const path = findPath(map, enemy.position.x, enemy.position.y, player.position.x, player.position.y, blocked);
  if (path && path.length > 0) {
    return { type: 'move', x: path[0].x, y: path[0].y };
  }
  return getWanderAction(enemy, map, allEntities);
}

function getAmbushAction(enemy, player, map, allEntities) {
  const dist = distance(enemy.position.x, enemy.position.y, player.position.x, player.position.y);

  if (enemy.hidden === undefined) enemy.hidden = true;

  if (enemy.hidden) {
    if (dist <= 2) {
      enemy.hidden = false;
      if (dist === 1) {
        return { type: 'attack', targetX: player.position.x, targetY: player.position.y, damageType: 'melee' };
      }
      return getRushdownAction(enemy, player, map, allEntities);
    }
    return { type: 'wait' };
  }

  return getRushdownAction(enemy, player, map, allEntities);
}

function getSummonerAction(enemy, player, map, allEntities) {
  if (enemy.summonCooldown === undefined) enemy.summonCooldown = 0;

  if (enemy.summonCooldown > 0) {
    enemy.summonCooldown--;
  }

  // Summon if off cooldown
  const summonedByThis = countSummonedMinions(allEntities, enemy.id);
  const summonedTotal = countSummonedMinions(allEntities);
  if (
    enemy.summonCooldown === 0 &&
    summonedByThis < MAX_SUMMONED_MINIONS_PER_SUMMONER &&
    summonedTotal < MAX_SUMMONED_MINIONS_TOTAL
  ) {
    // Find an adjacent empty tile to spawn
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    for (const d of dirs) {
      const nx = enemy.position.x + d.dx;
      const ny = enemy.position.y + d.dy;
      if (map.isWalkable(nx, ny)) {
        const occupied = allEntities.some(e => e.isAlive() && e.position.x === nx && e.position.y === ny);
        if (!occupied) {
          enemy.summonCooldown = SUMMONER_COOLDOWN_TURNS;
          return { type: 'summon', spawnX: nx, spawnY: ny };
        }
      }
    }
  }

  // Otherwise attack at range if in range
  const dist = distance(enemy.position.x, enemy.position.y, player.position.x, player.position.y);
  if (dist <= 5 && hasLineOfSight(map, enemy.position.x, enemy.position.y, player.position.x, player.position.y)) {
    return { type: 'attack', targetX: player.position.x, targetY: player.position.y, damageType: 'magic' };
  }

  // Move away if too close
  if (dist < 3) {
    const dx = Math.sign(enemy.position.x - player.position.x);
    const dy = Math.sign(enemy.position.y - player.position.y);
    const nx = enemy.position.x + (dx || 1);
    const ny = enemy.position.y + (dy || 0);
    if (map.isWalkable(nx, ny)) {
      return { type: 'move', x: nx, y: ny };
    }
  }

  return { type: 'wait' };
}

export function getAIAction(enemy, player, map, allEntities) {
  switch (enemy.behavior) {
    case 'rushdown': return getRushdownAction(enemy, player, map, allEntities);
    case 'kiting': return getKitingAction(enemy, player, map, allEntities);
    case 'ambush': return getAmbushAction(enemy, player, map, allEntities);
    case 'summoner': return getSummonerAction(enemy, player, map, allEntities);
    case 'wander':
    default:
      return getWanderAction(enemy, map, allEntities);
  }
}

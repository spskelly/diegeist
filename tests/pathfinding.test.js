import { describe, it, expect } from 'vitest';
import { findPath } from '../src/pathfinding.js';
import { GameMap } from '../src/game-map.js';
import { TILE } from '../src/constants.js';

function makeSimpleMap() {
  const map = new GameMap(10, 10);
  // Open 8x8 room
  for (let y = 1; y < 9; y++)
    for (let x = 1; x < 9; x++)
      map.setTile(x, y, TILE.FLOOR);
  return map;
}

describe('findPath', () => {
  it('finds a straight-line path in an open room', () => {
    const map = makeSimpleMap();
    const path = findPath(map, 1, 1, 5, 1);
    expect(path).not.toBeNull();
    expect(path.length).toBe(4); // 4 steps to go from (1,1) to (5,1)
    expect(path[0]).toEqual({ x: 2, y: 1 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 1 });
  });

  it('finds a path around a wall', () => {
    const map = makeSimpleMap();
    // Add a wall in the middle
    for (let y = 1; y < 7; y++) map.setTile(5, y, TILE.WALL);
    const path = findPath(map, 3, 3, 7, 3);
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(4); // Must go around wall
    // Verify path doesn't go through walls
    for (const step of path) {
      expect(map.isWalkable(step.x, step.y)).toBe(true);
    }
  });

  it('returns null for unreachable target', () => {
    const map = makeSimpleMap();
    // Wall off the target
    for (let x = 0; x < 10; x++) map.setTile(x, 5, TILE.WALL);
    const path = findPath(map, 1, 1, 1, 8);
    expect(path).toBeNull();
  });

  it('returns empty array when already at target', () => {
    const map = makeSimpleMap();
    const path = findPath(map, 3, 3, 3, 3);
    expect(path).toEqual([]);
  });

  it('returns path of length 1 for adjacent target', () => {
    const map = makeSimpleMap();
    const path = findPath(map, 3, 3, 4, 3);
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual({ x: 4, y: 3 });
  });

  it('avoids occupied tiles if blockedPositions provided', () => {
    const map = makeSimpleMap();
    // Block the direct path
    const blocked = [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }];
    const path = findPath(map, 1, 1, 5, 1, blocked);
    expect(path).not.toBeNull();
    for (const step of path) {
      const isBlocked = blocked.some(b => b.x === step.x && b.y === step.y);
      expect(isBlocked).toBe(false);
    }
  });

  it('handles diagonal-free 4-directional movement', () => {
    const map = makeSimpleMap();
    const path = findPath(map, 1, 1, 3, 3);
    expect(path).not.toBeNull();
    // Each step should be exactly 1 tile in cardinal direction
    let prev = { x: 1, y: 1 };
    for (const step of path) {
      const dx = Math.abs(step.x - prev.x);
      const dy = Math.abs(step.y - prev.y);
      expect(dx + dy).toBe(1); // Manhattan distance of 1
      prev = step;
    }
  });
});

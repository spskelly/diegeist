import { describe, it, expect } from 'vitest';
import { BSPNode, generateDungeon } from '../src/dungeon-gen.js';
import { BIOME_THEMES, getBiome, TILE } from '../src/constants.js';

describe('BSPNode', () => {
  it('creates a node with bounds', () => {
    const node = new BSPNode(0, 0, 50, 50);
    expect(node.x).toBe(0);
    expect(node.y).toBe(0);
    expect(node.width).toBe(50);
    expect(node.height).toBe(50);
    expect(node.left).toBeNull();
    expect(node.right).toBeNull();
  });

  it('splits into two children', () => {
    const node = new BSPNode(0, 0, 40, 40);
    const didSplit = node.split(10);
    expect(didSplit).toBe(true);
    expect(node.left).not.toBeNull();
    expect(node.right).not.toBeNull();
  });

  it('refuses to split if too small', () => {
    const node = new BSPNode(0, 0, 8, 8);
    const didSplit = node.split(10);
    expect(didSplit).toBe(false);
  });

  it('returns leaves', () => {
    const node = new BSPNode(0, 0, 60, 60);
    node.split(10);
    if (node.left) node.left.split(10);
    if (node.right) node.right.split(10);
    const leaves = node.getLeaves();
    expect(leaves.length).toBeGreaterThan(1);
    for (const leaf of leaves) {
      expect(leaf.left).toBeNull();
      expect(leaf.right).toBeNull();
    }
  });
});

describe('generateDungeon', () => {
  it('generates a map of the correct size', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    expect(map.width).toBe(60);
    expect(map.height).toBe(60);
  });

  it('generates rooms', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    expect(map.rooms.length).toBeGreaterThanOrEqual(3);
  });

  it('has a boss room', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    const bossRoom = map.rooms.find(r => r.type === 'boss');
    expect(bossRoom).toBeDefined();
    // Boss room should be at least 8x8 interior
    expect(bossRoom.width).toBeGreaterThanOrEqual(8);
    expect(bossRoom.height).toBeGreaterThanOrEqual(8);
  });

  it('has a start room', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    const startRoom = map.rooms.find(r => r.type === 'start');
    expect(startRoom).toBeDefined();
  });

  it('places stairs in the boss room', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    const bossRoom = map.rooms.find(r => r.type === 'boss');
    let foundStairs = false;
    for (let y = bossRoom.y; y < bossRoom.y + bossRoom.height; y++) {
      for (let x = bossRoom.x; x < bossRoom.x + bossRoom.width; x++) {
        if (map.getTile(x, y) === TILE.STAIRS_DOWN) foundStairs = true;
      }
    }
    expect(foundStairs).toBe(true);
  });

  it('all navigable tiles are connected if closed doors are considered passable', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    const isNavigable = (x, y) => map.isWalkable(x, y) || map.getTile(x, y) === TILE.DOOR;
    // Find any navigable tile
    let startX = -1, startY = -1;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (isNavigable(x, y)) {
          startX = x; startY = y;
          break outer;
        }
      }
    }
    expect(startX).not.toBe(-1);

    // Flood fill from start
    const visited = new Set();
    const queue = [[startX, startY]];
    visited.add(`${startX},${startY}`);
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nx = cx + dx, ny = cy + dy;
        const key = `${nx},${ny}`;
        if (!visited.has(key) && isNavigable(nx, ny)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }

    // Count all navigable tiles
    let totalNavigable = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (isNavigable(x, y)) totalNavigable++;
      }
    }

    expect(visited.size).toBe(totalNavigable);
  });

  it('generates corridor-heavy archetype', () => {
    const map = generateDungeon(60, 60, 'corridor-heavy', 1);
    expect(map.rooms.length).toBeGreaterThanOrEqual(3);
  });

  it('generates cavernous archetype', () => {
    const map = generateDungeon(60, 60, 'cavernous', 1);
    expect(map.rooms.length).toBeGreaterThanOrEqual(2);
  });

  it('has special rooms on most floors', () => {
    // Run multiple times to check special rooms spawn
    let foundSpecial = false;
    for (let i = 0; i < 5; i++) {
      const map = generateDungeon(60, 60, 'hybrid', 3);
      if (map.rooms.some(r => ['treasure', 'trap', 'shop', 'shrine', 'rest', 'challenge'].includes(r.type))) {
        foundSpecial = true;
        break;
      }
    }
    expect(foundSpecial).toBe(true);
  });

  it('has doors at room-corridor junctions', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    let doorCount = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.getTile(x, y) === TILE.DOOR) doorCount++;
      }
    }
    expect(doorCount).toBeGreaterThan(0);
  });

  it('every door connects two passable tiles on opposite sides', () => {
    // 60 floors across every archetype and biome floor: no door may open onto a wall
    const isPassable = t => t === TILE.FLOOR || t === TILE.STAIRS_DOWN || t === TILE.TRAP || t === TILE.CORRIDOR || t === TILE.DOOR;
    for (let run = 0; run < 60; run++) {
      const archetype = ['hybrid', 'corridor-heavy', 'cavernous'][run % 3];
      const floor = 1 + (run % 10);
      const map = generateDungeon(60, 50, archetype, floor, BIOME_THEMES[getBiome(floor)]);
      const orphans = [];
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.getTile(x, y) !== TILE.DOOR) continue;
          const horizontal = isPassable(map.getTile(x - 1, y)) && isPassable(map.getTile(x + 1, y));
          const vertical = isPassable(map.getTile(x, y - 1)) && isPassable(map.getTile(x, y + 1));
          if (!horizontal && !vertical) orphans.push(`${x},${y}`);
        }
      }
      expect(orphans, `run=${run} ${archetype} floor ${floor}: doors to nowhere at ${orphans.join(' ')}`).toEqual([]);
    }
  });


  it('all corridors are 1-tile wide', () => {
    // Run multiple times since dungeon gen is random
    for (let run = 0; run < 10; run++) {
      const archetype = ['hybrid', 'corridor-heavy', 'cavernous'][run % 3];
      const map = generateDungeon(60, 60, archetype, 1);
      for (let y = 1; y < map.height - 1; y++) {
        for (let x = 1; x < map.width - 1; x++) {
          if (map.getTile(x, y) !== TILE.CORRIDOR) continue;
          // A corridor tile should not have an adjacent corridor tile
          // that forms a 2-wide section (both have passable on same perp side)
          const walkable = (tx, ty) => map.inBounds(tx, ty) && (
            map.getTile(tx, ty) === TILE.CORRIDOR ||
            map.getTile(tx, ty) === TILE.FLOOR ||
            map.getTile(tx, ty) === TILE.STAIRS_DOWN
          );
          // Check horizontal pair
          if (map.getTile(x + 1, y) === TILE.CORRIDOR) {
            const bothN = walkable(x, y - 1) && walkable(x + 1, y - 1);
            const bothS = walkable(x, y + 1) && walkable(x + 1, y + 1);
            expect(bothN || bothS, `2-wide corridor at (${x},${y})-(${x+1},${y}) run=${run}`).toBe(false);
          }
          // Check vertical pair
          if (map.getTile(x, y + 1) === TILE.CORRIDOR) {
            const bothW = walkable(x - 1, y) && walkable(x - 1, y + 1);
            const bothE = walkable(x + 1, y) && walkable(x + 1, y + 1);
            expect(bothW || bothE, `2-wide corridor at (${x},${y})-(${x},${y+1}) run=${run}`).toBe(false);
          }
        }
      }
    }
  });

  it('start room is far from boss room', () => {
    const map = generateDungeon(60, 60, 'hybrid', 1);
    const bossRoom = map.rooms.find(r => r.type === 'boss');
    const startRoom = map.rooms.find(r => r.type === 'start');
    const bossCenter = { x: bossRoom.x + bossRoom.width / 2, y: bossRoom.y + bossRoom.height / 2 };
    const startCenter = { x: startRoom.x + startRoom.width / 2, y: startRoom.y + startRoom.height / 2 };
    const dist = Math.sqrt((bossCenter.x - startCenter.x) ** 2 + (bossCenter.y - startCenter.y) ** 2);
    expect(dist).toBeGreaterThan(5); // At least some distance apart
  });

  it('every room has at least one door', () => {
    for (let run = 0; run < 10; run++) {
      const archetype = ['hybrid', 'corridor-heavy', 'cavernous'][run % 3];
      const map = generateDungeon(60, 60, archetype, 1);
      for (const room of map.rooms) {
        let hasDoor = false;
        for (let x = room.x; x < room.x + room.width; x++) {
          if (map.getTile(x, room.y - 1) === TILE.DOOR) hasDoor = true;
          if (map.getTile(x, room.y + room.height) === TILE.DOOR) hasDoor = true;
        }
        for (let y = room.y; y < room.y + room.height; y++) {
          if (map.getTile(room.x - 1, y) === TILE.DOOR) hasDoor = true;
          if (map.getTile(room.x + room.width, y) === TILE.DOOR) hasDoor = true;
        }
        expect(hasDoor, `Room at (${room.x},${room.y}) has no door, run=${run}`).toBe(true);
      }
    }
  });

  it('no corridor tile is directly adjacent to a floor tile', () => {
    for (let run = 0; run < 10; run++) {
      const archetype = ['hybrid', 'corridor-heavy', 'cavernous'][run % 3];
      const map = generateDungeon(60, 60, archetype, 1);
      for (let y = 1; y < map.height - 1; y++) {
        for (let x = 1; x < map.width - 1; x++) {
          if (map.getTile(x, y) !== TILE.CORRIDOR) continue;
          for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
            expect(map.getTile(x + dx, y + dy),
              `Corridor at (${x},${y}) adjacent to FLOOR at (${x+dx},${y+dy}), run=${run}`
            ).not.toBe(TILE.FLOOR);
          }
        }
      }
    }
  });
});

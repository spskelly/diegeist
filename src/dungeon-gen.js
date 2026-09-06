import { GameMap } from './game-map.js';
import { TILE } from './constants.js';

const ARCHETYPE_PARAMS = {
  'corridor-heavy': { minLeafSize: 10, maxRoomSize: 8, minRoomSize: 4, splitDepth: 6 },
  'cavernous': { minLeafSize: 14, maxRoomSize: 14, minRoomSize: 6, splitDepth: 4 },
  'hybrid': { minLeafSize: 12, maxRoomSize: 10, minRoomSize: 5, splitDepth: 5 },
};

const SPECIAL_ROOM_TYPES = ['treasure', 'trap', 'shop', 'shrine', 'rest', 'challenge'];

export class BSPNode {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.left = null;
    this.right = null;
    this.room = null;
  }

  split(minSize) {
    if (this.left || this.right) return false;

    // Determine split direction
    let splitH = Math.random() > 0.5;
    if (this.width > this.height && this.width / this.height >= 1.25) splitH = false;
    else if (this.height > this.width && this.height / this.width >= 1.25) splitH = true;

    const max = (splitH ? this.height : this.width) - minSize;
    if (max < minSize) return false;

    const splitPos = Math.floor(Math.random() * (max - minSize + 1)) + minSize;

    if (splitH) {
      this.left = new BSPNode(this.x, this.y, this.width, splitPos);
      this.right = new BSPNode(this.x, this.y + splitPos, this.width, this.height - splitPos);
    } else {
      this.left = new BSPNode(this.x, this.y, splitPos, this.height);
      this.right = new BSPNode(this.x + splitPos, this.y, this.width - splitPos, this.height);
    }
    return true;
  }

  getLeaves() {
    if (!this.left && !this.right) return [this];
    const leaves = [];
    if (this.left) leaves.push(...this.left.getLeaves());
    if (this.right) leaves.push(...this.right.getLeaves());
    return leaves;
  }

  getRoom() {
    if (this.room) return this.room;
    if (this.left) { const r = this.left.getRoom(); if (r) return r; }
    if (this.right) { const r = this.right.getRoom(); if (r) return r; }
    return null;
  }
}

function createRoom(leaf, minSize, maxSize) {
  // 2-tile margin from leaf edges guarantees rooms are at least 4 tiles apart,
  // giving corridors space for clean perpendicular entries and doors.
  const margin = 2;
  const roomW = Math.floor(Math.random() * (Math.min(maxSize, leaf.width - margin * 2) - minSize + 1)) + minSize;
  const roomH = Math.floor(Math.random() * (Math.min(maxSize, leaf.height - margin * 2) - minSize + 1)) + minSize;
  const roomX = leaf.x + Math.floor(Math.random() * (leaf.width - roomW - margin * 2 + 1)) + margin;
  const roomY = leaf.y + Math.floor(Math.random() * (leaf.height - roomH - margin * 2 + 1)) + margin;
  return { x: roomX, y: roomY, width: roomW, height: roomH, type: 'standard' };
}

function carveRoom(map, room) {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      map.setTile(x, y, TILE.FLOOR);
    }
  }
}

function buildRoomBuffer(rooms) {
  // Full ring around each room including corners — discourages corridors from
  // cutting through room corners (which creates non-perpendicular entries)
  const buffer = new Set();
  for (const room of rooms) {
    for (let x = room.x - 1; x <= room.x + room.width; x++) {
      buffer.add(`${x},${room.y - 1}`);           // north edge + corners
      buffer.add(`${x},${room.y + room.height}`);  // south edge + corners
    }
    for (let y = room.y; y < room.y + room.height; y++) {
      buffer.add(`${room.x - 1},${y}`);
      buffer.add(`${room.x + room.width},${y}`);
    }
  }
  return buffer;
}

function pickExitPoint(room, side) {
  // Pick a point on the room's wall, clamped 1 tile from corners when possible
  if (side === 'north' || side === 'south') {
    const center = Math.floor(room.x + room.width / 2);
    const x = room.width >= 3
      ? Math.max(room.x + 1, Math.min(center, room.x + room.width - 2))
      : center;
    const y = side === 'north' ? room.y - 1 : room.y + room.height;
    return { x, y };
  }
  const center = Math.floor(room.y + room.height / 2);
  const y = room.height >= 3
    ? Math.max(room.y + 1, Math.min(center, room.y + room.height - 2))
    : center;
  const x = side === 'west' ? room.x - 1 : room.x + room.width;
  return { x, y };
}

function facingSide(room, targetX, targetY) {
  const c = roomCenter(room);
  const dx = targetX - c.x, dy = targetY - c.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'south' : 'north';
  return dx >= 0 ? 'east' : 'west';
}

function carveCorridor(map, x1, y1, x2, y2, roomBuffer) {
  // Dijkstra from (x1,y1) to (x2,y2).
  // Buffer tiles are expensive (cost 50) but passable — no separate fallback needed.
  const key = (x, y) => `${x},${y}`;
  const startKey = key(x1, y1), endKey = key(x2, y2);

  const canPass = (x, y) => {
    if (!map.inBounds(x, y)) return false;
    if (key(x, y) === endKey) return true;
    const t = map.getTile(x, y);
    return t === TILE.WALL || t === TILE.CORRIDOR;
  };

  const dist = new Map();
  const prev = new Map();
  const pq = [[0, x1, y1]];
  dist.set(startKey, 0);

  while (pq.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i][0] < pq[minIdx][0]) minIdx = i;
    }
    const [d, cx, cy] = pq[minIdx];
    pq[minIdx] = pq[pq.length - 1];
    pq.pop();

    const ck = key(cx, cy);
    if (d > (dist.get(ck) ?? Infinity)) continue;

    if (cx === x2 && cy === y2) {
      let cur = ck;
      while (cur) {
        const [px, py] = cur.split(',').map(Number);
        if (map.getTile(px, py) !== TILE.FLOOR) map.setTile(px, py, TILE.CORRIDOR);
        cur = prev.get(cur);
      }
      return;
    }

    for (const [ddx, ddy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + ddx, ny = cy + ddy;
      if (!canPass(nx, ny)) continue;
      const nk = key(nx, ny);
      const cost = (roomBuffer && roomBuffer.has(nk) && nk !== startKey && nk !== endKey) ? 50 : 1;
      const nd = d + cost;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, ck);
        pq.push([nd, nx, ny]);
      }
    }
  }
}

function carveWallToWallCorridor(map, room1, room2, roomBuffer) {
  const c2 = roomCenter(room2);
  const c1 = roomCenter(room1);
  const side1 = facingSide(room1, c2.x, c2.y);
  const side2 = facingSide(room2, c1.x, c1.y);
  const exit1 = pickExitPoint(room1, side1);
  const exit2 = pickExitPoint(room2, side2);
  carveCorridor(map, exit1.x, exit1.y, exit2.x, exit2.y, roomBuffer);
}

function connectRooms(map, node, roomBuffer) {
  if (!node.left || !node.right) return;

  const leftRoom = node.left.getRoom();
  const rightRoom = node.right.getRoom();

  if (leftRoom && rightRoom) {
    carveWallToWallCorridor(map, leftRoom, rightRoom, roomBuffer);
  }

  connectRooms(map, node.left, roomBuffer);
  connectRooms(map, node.right, roomBuffer);
}

function thinCorridors(map) {
  // Iteratively remove corridor tiles that are part of 2+ wide sections,
  // ensuring the corridor network stays connected.
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];

  function isPassable(x, y) {
    if (!map.inBounds(x, y)) return false;
    const t = map.getTile(x, y);
    return t === TILE.CORRIDOR || t === TILE.FLOOR || t === TILE.STAIRS_DOWN || t === TILE.TRAP;
  }

  function canSafelyRemove(x, y) {
    // A tile can be removed if all its passable neighbors remain connected
    // to each other without going through (x,y).
    const neighbors = [];
    for (const [dx, dy] of dirs) {
      if (isPassable(x + dx, y + dy)) neighbors.push([x + dx, y + dy]);
    }
    if (neighbors.length <= 1) return true;

    // BFS from first neighbor, blocking (x,y), check all others reachable
    const visited = new Set([`${x},${y}`]);
    const queue = [neighbors[0]];
    visited.add(`${neighbors[0][0]},${neighbors[0][1]}`);
    const targets = new Set(neighbors.slice(1).map(([nx, ny]) => `${nx},${ny}`));
    let found = 0;

    while (queue.length > 0 && found < targets.size) {
      const [cx, cy] = queue.shift();
      if (targets.has(`${cx},${cy}`)) found++;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        const key = `${nx},${ny}`;
        if (!visited.has(key) && isPassable(nx, ny)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }
    return found === targets.size;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (map.getTile(x, y) !== TILE.CORRIDOR) continue;

        // Check if this tile is part of a 2+ wide corridor section.
        // Two adjacent corridor tiles are "wide" if they both have passable
        // tiles on the same perpendicular side (i.e. the passage is 2+ wide).
        let isWide = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (!map.inBounds(nx, ny) || map.getTile(nx, ny) !== TILE.CORRIDOR) continue;

          if (dx !== 0) { // horizontal pair (side by side)
            if ((isPassable(x, y - 1) && isPassable(nx, ny - 1)) ||
                (isPassable(x, y + 1) && isPassable(nx, ny + 1))) {
              isWide = true;
              break;
            }
          } else { // vertical pair (stacked)
            if ((isPassable(x - 1, y) && isPassable(nx - 1, ny)) ||
                (isPassable(x + 1, y) && isPassable(nx + 1, ny))) {
              isWide = true;
              break;
            }
          }
        }

        if (isWide && canSafelyRemove(x, y)) {
          map.setTile(x, y, TILE.WALL);
          changed = true;
        }
      }
    }
  }
}

function getWallCorridors(map, room, side) {
  const tiles = [];
  if (side === 'north') {
    const wy = room.y - 1;
    for (let x = room.x; x < room.x + room.width; x++)
      if (map.getTile(x, wy) === TILE.CORRIDOR) tiles.push({ x, y: wy });
  } else if (side === 'south') {
    const wy = room.y + room.height;
    for (let x = room.x; x < room.x + room.width; x++)
      if (map.getTile(x, wy) === TILE.CORRIDOR) tiles.push({ x, y: wy });
  } else if (side === 'west') {
    const wx = room.x - 1;
    for (let y = room.y; y < room.y + room.height; y++)
      if (map.getTile(wx, y) === TILE.CORRIDOR) tiles.push({ x: wx, y });
  } else {
    const wx = room.x + room.width;
    for (let y = room.y; y < room.y + room.height; y++)
      if (map.getTile(wx, y) === TILE.CORRIDOR) tiles.push({ x: wx, y });
  }
  return tiles;
}

function canSafelyWallOff(map, x, y) {
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const isPassable = (px, py) => {
    if (!map.inBounds(px, py)) return false;
    const t = map.getTile(px, py);
    return t === TILE.CORRIDOR || t === TILE.FLOOR || t === TILE.DOOR ||
           t === TILE.STAIRS_DOWN || t === TILE.TRAP;
  };
  const neighbors = [];
  for (const [dx, dy] of dirs) {
    if (isPassable(x + dx, y + dy)) neighbors.push([x + dx, y + dy]);
  }
  if (neighbors.length <= 1) return true;
  // BFS from first neighbor, blocking (x,y), check all others reachable
  const visited = new Set([`${x},${y}`]);
  const queue = [neighbors[0]];
  visited.add(`${neighbors[0][0]},${neighbors[0][1]}`);
  const targets = new Set(neighbors.slice(1).map(([nx, ny]) => `${nx},${ny}`));
  let found = 0;
  while (queue.length > 0 && found < targets.size) {
    const [cx, cy] = queue.shift();
    if (targets.has(`${cx},${cy}`)) found++;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && isPassable(nx, ny)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return found === targets.size;
}

function hasValidDoorGeometry(map, x, y) {
  const walkable = (px, py) => map.inBounds(px, py) && map.isWalkable(px, py);
  const n = walkable(x, y - 1), s = walkable(x, y + 1);
  const w = walkable(x - 1, y), e = walkable(x + 1, y);
  return (n && s && !w && !e) || (w && e && !n && !s);
}

function placeDoors(map, rooms) {
  // Outward direction per wall side (away from room, into corridor)
  const outDir = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

  for (const room of rooms) {
    for (const side of ['north', 'south', 'west', 'east']) {
      const corridors = getWallCorridors(map, room, side);
      for (const c of corridors) {
        if (map.getTile(c.x, c.y) !== TILE.CORRIDOR) continue;
        // Door needs corridor on outward side (room is already on inward side)
        const [odx, ody] = outDir[side];
        const outTile = map.getTile(c.x + odx, c.y + ody);
        if (outTile === TILE.CORRIDOR || outTile === TILE.DOOR) {
          map.setTile(c.x, c.y, TILE.DOOR);
        } else if (canSafelyWallOff(map, c.x, c.y)) {
          map.setTile(c.x, c.y, TILE.WALL);
        }
      }
    }
  }

  // Safety net: any remaining CORRIDOR adjacent to FLOOR
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.getTile(x, y) !== TILE.CORRIDOR) continue;
      const adjFloor = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(
        ([dx, dy]) => map.getTile(x + dx, y + dy) === TILE.FLOOR
      );
      if (!adjFloor) continue;
      if (hasValidDoorGeometry(map, x, y)) {
        map.setTile(x, y, TILE.DOOR);
      } else if (canSafelyWallOff(map, x, y)) {
        map.setTile(x, y, TILE.WALL);
      }
    }
  }
}

function repairCorridorConnectivity(map) {
  // Flood-fill from any navigable tile (treating doors as passable).
  // Any corridor tile not reached is orphaned — convert to WALL.
  const isNavigable = (x, y) => {
    if (!map.inBounds(x, y)) return false;
    const t = map.getTile(x, y);
    return t === TILE.FLOOR || t === TILE.CORRIDOR || t === TILE.DOOR ||
           t === TILE.STAIRS_DOWN || t === TILE.TRAP;
  };

  let seedX = -1, seedY = -1;
  for (let y = 0; y < map.height && seedX === -1; y++)
    for (let x = 0; x < map.width && seedX === -1; x++)
      if (isNavigable(x, y)) { seedX = x; seedY = y; }
  if (seedX === -1) return;

  const visited = new Set();
  const queue = [[seedX, seedY]];
  visited.add(`${seedX},${seedY}`);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx, ny = cy + dy;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && isNavigable(nx, ny)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++)
      if (map.getTile(x, y) === TILE.CORRIDOR && !visited.has(`${x},${y}`))
        map.setTile(x, y, TILE.WALL);
}

function trimDeadEndCorridors(map) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (map.getTile(x, y) !== TILE.CORRIDOR) continue;
        let passable = 0;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const t = map.getTile(x + dx, y + dy);
          if (t === TILE.CORRIDOR || t === TILE.FLOOR || t === TILE.DOOR ||
              t === TILE.STAIRS_DOWN || t === TILE.TRAP) passable++;
        }
        if (passable <= 1) {
          map.setTile(x, y, TILE.WALL);
          changed = true;
        }
      }
    }
  }
}

// a door must connect two passable tiles on opposite sides. trimming dead-end
// corridors can eat the stub behind a door and leave a door that opens onto a
// wall; those doors become wall again.
function removeOrphanDoors(map) {
  const passable = (x, y) => {
    const t = map.getTile(x, y);
    return t === TILE.FLOOR || t === TILE.CORRIDOR || t === TILE.DOOR ||
           t === TILE.STAIRS_DOWN || t === TILE.TRAP;
  };
  let removed = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.getTile(x, y) !== TILE.DOOR) continue;
      const horizontal = passable(x - 1, y) && passable(x + 1, y);
      const vertical = passable(x, y - 1) && passable(x, y + 1);
      if (!horizontal && !vertical) {
        map.setTile(x, y, TILE.WALL);
        removed++;
      }
    }
  }
  return removed;
}

function roomCenter(room) {
  return { x: Math.floor(room.x + room.width / 2), y: Math.floor(room.y + room.height / 2) };
}

function roomDist(a, b) {
  const ac = roomCenter(a), bc = roomCenter(b);
  return Math.sqrt((ac.x - bc.x) ** 2 + (ac.y - bc.y) ** 2);
}

function fixRoomWaterConnectivity(map, room) {
  // Flood-fill from every door-adjacent floor tile inside the room.
  // Any walkable room tile not reached is cut off by water — remove water
  // tiles along the shortest path until everything reconnects.
  const walkable = (x, y) => {
    if (x < room.x || x >= room.x + room.width) return false;
    if (y < room.y || y >= room.y + room.height) return false;
    const t = map.getTile(x, y);
    return t === TILE.FLOOR || t === TILE.TRAP || t === TILE.STAIRS_DOWN;
  };

  // Find all walkable tiles in the room
  const allWalkable = [];
  for (let y = room.y; y < room.y + room.height; y++)
    for (let x = room.x; x < room.x + room.width; x++)
      if (walkable(x, y)) allWalkable.push([x, y]);
  if (allWalkable.length === 0) return;

  // Prefer seeding from an entrance tile (adjacent to door/corridor) so
  // flood-fill guarantees connectivity to exits, not just internal connectivity
  const dirs4 = [[0,-1],[0,1],[-1,0],[1,0]];
  const seed = allWalkable.find(([wx, wy]) =>
    dirs4.some(([dx, dy]) => {
      const t = map.getTile(wx + dx, wy + dy);
      return t === TILE.DOOR || t === TILE.CORRIDOR;
    })
  ) || allWalkable[0];

  // Flood-fill from the seed tile
  const visited = new Set();
  const queue = [seed];
  visited.add(`${seed[0]},${seed[1]}`);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = cx + dx, ny = cy + dy;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && walkable(nx, ny)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  // If all walkable tiles are connected, done
  if (visited.size === allWalkable.length) return;

  // Find unreached walkable tiles and clear water between them and the
  // reached set. Convert water tiles adjacent to unreached tiles to floor,
  // then re-run until connected.
  for (let pass = 0; pass < 20; pass++) {
    const unreached = allWalkable.filter(([x, y]) => !visited.has(`${x},${y}`));
    if (unreached.length === 0) break;
    let cleared = false;
    for (const [ux, uy] of unreached) {
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = ux + dx, ny = uy + dy;
        if (nx >= room.x && nx < room.x + room.width &&
            ny >= room.y && ny < room.y + room.height &&
            map.getTile(nx, ny) === TILE.WATER) {
          map.setTile(nx, ny, TILE.FLOOR);
          cleared = true;
        }
      }
    }
    if (!cleared) break;
    // Re-flood
    visited.clear();
    queue.length = 0;
    queue.push(allWalkable[0]);
    visited.add(`${allWalkable[0][0]},${allWalkable[0][1]}`);
    // Re-check walkability since we cleared water
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = cx + dx, ny = cy + dy;
        const key = `${nx},${ny}`;
        if (!visited.has(key) && walkable(nx, ny)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }
  }
}

export function generateDungeon(width, height, archetype, floorNumber, biomeConfig = null) {
  const params = ARCHETYPE_PARAMS[archetype] || ARCHETYPE_PARAMS.hybrid;
  const map = new GameMap(width, height);

  // Build BSP tree
  const root = new BSPNode(1, 1, width - 2, height - 2);
  const toSplit = [root];
  let depth = 0;
  while (toSplit.length > 0 && depth < params.splitDepth) {
    const nextSplit = [];
    for (const node of toSplit) {
      if (node.split(params.minLeafSize)) {
        nextSplit.push(node.left, node.right);
      }
    }
    toSplit.length = 0;
    toSplit.push(...nextSplit);
    depth++;
  }

  // Create rooms in leaves
  const leaves = root.getLeaves();
  const rooms = [];
  for (const leaf of leaves) {
    const room = createRoom(leaf, params.minRoomSize, params.maxRoomSize);
    leaf.room = room;
    rooms.push(room);
    carveRoom(map, room);
  }

  // Designate and expand boss room BEFORE corridor carving so the buffer
  // includes expanded bounds and corridors route around them properly
  rooms.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const bossRoom = rooms[0];
  bossRoom.type = 'boss';
  if (bossRoom.width < 8 || bossRoom.height < 8) {
    const newW = Math.max(bossRoom.width, 8);
    const newH = Math.max(bossRoom.height, 8);
    bossRoom.width = Math.min(newW, width - bossRoom.x - 2);
    bossRoom.height = Math.min(newH, height - bossRoom.y - 2);
    carveRoom(map, bossRoom);
  }

  // Place stairs in boss room center
  const bossCenter = roomCenter(bossRoom);
  map.setTile(bossCenter.x, bossCenter.y, TILE.STAIRS_DOWN);

  // Connect rooms (BFS pathfinding avoids room buffer zones)
  const roomBuffer = buildRoomBuffer(rooms);
  connectRooms(map, root, roomBuffer);

  // Designate start room (furthest from boss)
  let maxDist = -1;
  let startRoom = null;
  for (const room of rooms) {
    if (room === bossRoom) continue;
    const d = roomDist(room, bossRoom);
    if (d > maxDist) {
      maxDist = d;
      startRoom = room;
    }
  }
  if (startRoom) startRoom.type = 'start';

  // Designate special rooms (1-3, not boss or start)
  const standardRooms = rooms.filter(r => r.type === 'standard');
  const numSpecial = Math.min(standardRooms.length, 1 + Math.floor(Math.random() * 3));
  const shuffled = standardRooms.sort(() => Math.random() - 0.5);
  for (let i = 0; i < numSpecial; i++) {
    shuffled[i].type = SPECIAL_ROOM_TYPES[Math.floor(Math.random() * SPECIAL_ROOM_TYPES.length)];
  }

  // Thin any 2+ wide corridor sections down to 1-tile width
  thinCorridors(map);

  // Place doors at room-corridor junctions (seal-and-punch)
  placeDoors(map, rooms);

  // Clean up orphaned and dead-end corridor segments, then any door left
  // opening onto a wall. removing a door can expose a new dead end, so repeat.
  repairCorridorConnectivity(map);
  trimDeadEndCorridors(map);
  while (removeOrphanDoors(map) > 0) trimDeadEndCorridors(map);

  // Place biome-specific environmental tiles
  if (biomeConfig) {
    for (const room of rooms) {
      if (room.type === 'start' || room.type === 'boss') continue;
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (map.getTile(x, y) !== TILE.FLOOR) continue;
          // Never place water/traps next to doors or corridor entrances
          const adjEntrance = [[0,-1],[0,1],[-1,0],[1,0]].some(
            ([dx, dy]) => {
              const t = map.getTile(x + dx, y + dy);
              return t === TILE.DOOR || t === TILE.CORRIDOR;
            }
          );
          if (adjEntrance) continue;
          if (biomeConfig.waterChance && Math.random() < biomeConfig.waterChance) {
            map.setTile(x, y, TILE.WATER);
          } else if (biomeConfig.trapChance && Math.random() < biomeConfig.trapChance) {
            map.setTile(x, y, TILE.TRAP);
          }
        }
      }
      // Remove water that partitions the room — flood-fill from any walkable
      // tile and revert unreachable water back to floor.
      fixRoomWaterConnectivity(map, room);
    }
  }

  // Store rooms on map
  for (const room of rooms) {
    map.addRoom(room);
  }

  return map;
}

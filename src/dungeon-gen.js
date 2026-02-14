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
  const roomW = Math.floor(Math.random() * (Math.min(maxSize, leaf.width - 2) - minSize + 1)) + minSize;
  const roomH = Math.floor(Math.random() * (Math.min(maxSize, leaf.height - 2) - minSize + 1)) + minSize;
  const roomX = leaf.x + Math.floor(Math.random() * (leaf.width - roomW - 1)) + 1;
  const roomY = leaf.y + Math.floor(Math.random() * (leaf.height - roomH - 1)) + 1;
  return { x: roomX, y: roomY, width: roomW, height: roomH, type: 'standard' };
}

function carveRoom(map, room) {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      map.setTile(x, y, TILE.FLOOR);
    }
  }
}

function carveCorridor(map, x1, y1, x2, y2) {
  let x = x1, y = y1;
  // L-shaped corridor: go horizontal first, then vertical (or vice versa randomly)
  if (Math.random() > 0.5) {
    while (x !== x2) {
      if (map.getTile(x, y) !== TILE.FLOOR) map.setTile(x, y, TILE.CORRIDOR);
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      if (map.getTile(x, y) !== TILE.FLOOR) map.setTile(x, y, TILE.CORRIDOR);
      y += y < y2 ? 1 : -1;
    }
  } else {
    while (y !== y2) {
      if (map.getTile(x, y) !== TILE.FLOOR) map.setTile(x, y, TILE.CORRIDOR);
      y += y < y2 ? 1 : -1;
    }
    while (x !== x2) {
      if (map.getTile(x, y) !== TILE.FLOOR) map.setTile(x, y, TILE.CORRIDOR);
      x += x < x2 ? 1 : -1;
    }
  }
  if (map.getTile(x, y) !== TILE.FLOOR) map.setTile(x, y, TILE.CORRIDOR);
}

function connectRooms(map, node) {
  if (!node.left || !node.right) return;

  const leftRoom = node.left.getRoom();
  const rightRoom = node.right.getRoom();

  if (leftRoom && rightRoom) {
    const lx = Math.floor(leftRoom.x + leftRoom.width / 2);
    const ly = Math.floor(leftRoom.y + leftRoom.height / 2);
    const rx = Math.floor(rightRoom.x + rightRoom.width / 2);
    const ry = Math.floor(rightRoom.y + rightRoom.height / 2);
    carveCorridor(map, lx, ly, rx, ry);
  }

  connectRooms(map, node.left);
  connectRooms(map, node.right);
}

function narrowCorridorEntrances(map, rooms) {
  // Find 2-wide corridor entrances at room edges and fill one tile to create
  // a proper 1-wide doorway. Without this, isValidDoorGeometry fails for both
  // tiles (each has a walkable neighbor on the perpendicular axis).
  // Only fill a tile if it has no corridor neighbors besides its pair partner,
  // so we never disconnect the corridor network.
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  function canFill(fx, fy, keepX, keepY) {
    // Safe to wall off (fx,fy) only if none of its corridor neighbors lead
    // deeper into the network (i.e. its only CORRIDOR neighbor is the kept tile).
    for (const [dx, dy] of dirs) {
      const nx = fx + dx, ny = fy + dy;
      if (nx === keepX && ny === keepY) continue; // the partner we're keeping
      if (map.inBounds(nx, ny) && map.getTile(nx, ny) === TILE.CORRIDOR) return false;
    }
    return true;
  }

  for (const room of rooms) {
    // Horizontal edges (north/south): corridor pairs side-by-side on x axis
    for (const edgeY of [room.y - 1, room.y + room.height]) {
      for (let x = room.x; x < room.x + room.width - 1; x++) {
        if (map.getTile(x, edgeY) !== TILE.CORRIDOR || map.getTile(x + 1, edgeY) !== TILE.CORRIDOR) continue;
        if (canFill(x + 1, edgeY, x, edgeY)) {
          map.setTile(x + 1, edgeY, TILE.WALL);
        } else if (canFill(x, edgeY, x + 1, edgeY)) {
          map.setTile(x, edgeY, TILE.WALL);
        }
      }
    }
    // Vertical edges (west/east): corridor pairs stacked on y axis
    for (const edgeX of [room.x - 1, room.x + room.width]) {
      for (let y = room.y; y < room.y + room.height - 1; y++) {
        if (map.getTile(edgeX, y) !== TILE.CORRIDOR || map.getTile(edgeX, y + 1) !== TILE.CORRIDOR) continue;
        if (canFill(edgeX, y + 1, edgeX, y)) {
          map.setTile(edgeX, y + 1, TILE.WALL);
        } else if (canFill(edgeX, y, edgeX, y + 1)) {
          map.setTile(edgeX, y, TILE.WALL);
        }
      }
    }
  }
}

function findBestDoorCandidate(candidates) {
  // Pick the candidate closest to the wall's midpoint for a natural look
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const mid = (candidates.length - 1) / 2;
  let best = candidates[0], bestDist = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const d = Math.abs(i - mid);
    if (d < bestDist) { bestDist = d; best = candidates[i]; }
  }
  return best;
}

function placeDoors(map, rooms) {
  narrowCorridorEntrances(map, rooms);
  // Place at most one door per room wall (north/south/east/west)
  for (const room of rooms) {
    const walls = {
      north: [], south: [], west: [], east: [],
    };
    // Gather valid candidates per wall
    for (let x = room.x; x < room.x + room.width; x++) {
      if (isDoorCandidate(map, x, room.y - 1, x, room.y))
        walls.north.push([x, room.y - 1, x, room.y]);
      if (isDoorCandidate(map, x, room.y + room.height, x, room.y + room.height - 1))
        walls.south.push([x, room.y + room.height, x, room.y + room.height - 1]);
    }
    for (let y = room.y; y < room.y + room.height; y++) {
      if (isDoorCandidate(map, room.x - 1, y, room.x, y))
        walls.west.push([room.x - 1, y, room.x, y]);
      if (isDoorCandidate(map, room.x + room.width, y, room.x + room.width - 1, y))
        walls.east.push([room.x + room.width, y, room.x + room.width - 1, y]);
    }
    // Place one door per wall, choosing the most central candidate
    for (const side of ['north', 'south', 'west', 'east']) {
      const pick = findBestDoorCandidate(walls[side]);
      if (pick) map.setTile(pick[0], pick[1], TILE.DOOR);
    }
  }
}

function isDoorCandidate(map, corridorX, corridorY, floorX, floorY) {
  if (!map.inBounds(corridorX, corridorY) || !map.inBounds(floorX, floorY)) return false;
  if (map.getTile(corridorX, corridorY) !== TILE.CORRIDOR) return false;
  if (map.getTile(floorX, floorY) !== TILE.FLOOR) return false;
  const dx = corridorX - floorX;
  const dy = corridorY - floorY;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const oppositeX = corridorX + dx;
  const oppositeY = corridorY + dy;
  if (!map.inBounds(oppositeX, oppositeY)) return false;
  if (!isWalkableTile(map, oppositeX, oppositeY)) return false;
  if (!isValidDoorGeometry(map, corridorX, corridorY)) return false;
  return true;
}

function isWalkableTile(map, x, y) {
  return map.inBounds(x, y) && map.isWalkable(x, y);
}

function isValidDoorGeometry(map, x, y) {
  const northOpen = isWalkableTile(map, x, y - 1);
  const southOpen = isWalkableTile(map, x, y + 1);
  const westOpen = isWalkableTile(map, x - 1, y);
  const eastOpen = isWalkableTile(map, x + 1, y);

  const verticalDoor = northOpen && southOpen && !westOpen && !eastOpen;
  const horizontalDoor = westOpen && eastOpen && !northOpen && !southOpen;
  return verticalDoor || horizontalDoor;
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

  // Flood-fill from the first walkable tile
  const visited = new Set();
  const queue = [allWalkable[0]];
  visited.add(`${allWalkable[0][0]},${allWalkable[0][1]}`);
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

  // Connect rooms
  connectRooms(map, root);

  // Designate boss room (largest room or ensure >=8x8)
  rooms.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const bossRoom = rooms[0];
  bossRoom.type = 'boss';
  // Ensure boss room is at least 8x8
  if (bossRoom.width < 8 || bossRoom.height < 8) {
    // Expand the boss room if possible
    const newW = Math.max(bossRoom.width, 8);
    const newH = Math.max(bossRoom.height, 8);
    // Re-carve the expanded room
    bossRoom.width = Math.min(newW, width - bossRoom.x - 2);
    bossRoom.height = Math.min(newH, height - bossRoom.y - 2);
    carveRoom(map, bossRoom);
  }

  // Place stairs in boss room center
  const bossCenter = roomCenter(bossRoom);
  map.setTile(bossCenter.x, bossCenter.y, TILE.STAIRS_DOWN);

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

  // Place doors at room-corridor junctions
  placeDoors(map, rooms);

  // Place biome-specific environmental tiles
  if (biomeConfig) {
    for (const room of rooms) {
      if (room.type === 'start' || room.type === 'boss') continue;
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (map.getTile(x, y) !== TILE.FLOOR) continue;
          // Never place water/traps next to doors — water blocks access
          const adjDoor = [[0,-1],[0,1],[-1,0],[1,0]].some(
            ([dx, dy]) => map.getTile(x + dx, y + dy) === TILE.DOOR
          );
          if (adjDoor) continue;
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

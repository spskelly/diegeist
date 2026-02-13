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

function placeDoors(map, rooms) {
  // Place doors where corridors meet room edges
  for (const room of rooms) {
    // Check all positions around the room perimeter
    for (let x = room.x; x < room.x + room.width; x++) {
      // Check north and south edges
      checkAndPlaceDoor(map, x, room.y - 1, x, room.y);
      checkAndPlaceDoor(map, x, room.y + room.height, x, room.y + room.height - 1);
    }
    for (let y = room.y; y < room.y + room.height; y++) {
      // Check west and east edges
      checkAndPlaceDoor(map, room.x - 1, y, room.x, y);
      checkAndPlaceDoor(map, room.x + room.width, y, room.x + room.width - 1, y);
    }
  }
}

function checkAndPlaceDoor(map, corridorX, corridorY, floorX, floorY) {
  if (map.getTile(corridorX, corridorY) === TILE.CORRIDOR &&
      map.getTile(floorX, floorY) === TILE.FLOOR) {
    map.setTile(corridorX, corridorY, TILE.DOOR);
  }
}

function roomCenter(room) {
  return { x: Math.floor(room.x + room.width / 2), y: Math.floor(room.y + room.height / 2) };
}

function roomDist(a, b) {
  const ac = roomCenter(a), bc = roomCenter(b);
  return Math.sqrt((ac.x - bc.x) ** 2 + (ac.y - bc.y) ** 2);
}

export function generateDungeon(width, height, archetype, floorNumber) {
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

  // Store rooms on map
  for (const room of rooms) {
    map.addRoom(room);
  }

  return map;
}

import { TILE } from './constants.js';

export class GameMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: height }, () => new Array(width).fill(TILE.WALL));
    this.explored = Array.from({ length: height }, () => new Array(width).fill(false));
    this.visible = Array.from({ length: height }, () => new Array(width).fill(false));
    this.rooms = [];
    this.entities = [];
    this.items = [];
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return TILE.WALL;
    return this.tiles[y][x];
  }

  setTile(x, y, type) {
    if (this.inBounds(x, y)) {
      this.tiles[y][x] = type;
    }
  }

  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    return TILE.properties[tile]?.walkable ?? false;
  }

  blocksLOS(x, y) {
    const tile = this.getTile(x, y);
    return TILE.properties[tile]?.blocksLOS ?? true;
  }

  isExplored(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.explored[y][x];
  }

  setExplored(x, y, value) {
    if (this.inBounds(x, y)) {
      this.explored[y][x] = value;
    }
  }

  isVisible(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.visible[y][x];
  }

  setVisible(x, y, value) {
    if (this.inBounds(x, y)) {
      this.visible[y][x] = value;
    }
  }

  clearVisibility() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.visible[y][x] = false;
      }
    }
  }

  addRoom(room) {
    this.rooms.push(room);
  }
}

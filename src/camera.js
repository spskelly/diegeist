import { TILE_SIZE } from './constants.js';

export class Camera {
  constructor(canvasWidth, canvasHeight, zoom = 1) {
    this.x = 0;
    this.y = 0;
    this.zoom = Math.max(1, zoom);
    this.tileSize = TILE_SIZE * this.zoom;
    this.offsetX = 0;
    this.offsetY = 0;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.resize(canvasWidth, canvasHeight);
  }

  setZoom(zoom) {
    this.zoom = Math.max(1, zoom);
    this.tileSize = TILE_SIZE * this.zoom;
  }

  resize(canvasWidth, canvasHeight) {
    this.viewportWidth = Math.max(1, Math.floor(canvasWidth / this.tileSize));
    this.viewportHeight = Math.max(1, Math.floor(canvasHeight / this.tileSize));
    this.offsetX = Math.floor((canvasWidth - this.viewportWidth * this.tileSize) / 2);
    this.offsetY = Math.floor((canvasHeight - this.viewportHeight * this.tileSize) / 2);
  }

  // keeps the target in the middle of the viewport. when the map is smaller than
  // the viewport on an axis, the whole map is centered on that axis instead so a
  // small level never sits in a corner. negative offsets are fine: the renderer
  // skips tiles that fall outside the map.
  centerOn(targetX, targetY, mapWidth, mapHeight) {
    const halfW = Math.floor(this.viewportWidth / 2);
    const halfH = Math.floor(this.viewportHeight / 2);
    this.x = mapWidth <= this.viewportWidth
      ? -Math.floor((this.viewportWidth - mapWidth) / 2)
      : targetX - halfW;
    this.y = mapHeight <= this.viewportHeight
      ? -Math.floor((this.viewportHeight - mapHeight) / 2)
      : targetY - halfH;
  }

  tileToScreen(tileX, tileY) {
    return {
      sx: this.offsetX + (tileX - this.x) * this.tileSize,
      sy: this.offsetY + (tileY - this.y) * this.tileSize,
    };
  }

  // inverse of tileToScreen; used to turn a tap on the canvas into a tile coordinate
  screenToTile(sx, sy) {
    return {
      x: Math.floor((sx - this.offsetX) / this.tileSize) + this.x,
      y: Math.floor((sy - this.offsetY) / this.tileSize) + this.y,
    };
  }

  isInView(tileX, tileY) {
    return tileX >= this.x && tileX < this.x + this.viewportWidth &&
           tileY >= this.y && tileY < this.y + this.viewportHeight;
  }
}

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

  centerOn(targetX, targetY, mapWidth, mapHeight) {
    const halfW = Math.floor(this.viewportWidth / 2);
    const halfH = Math.floor(this.viewportHeight / 2);
    this.x = Math.max(0, Math.min(targetX - halfW, mapWidth - this.viewportWidth));
    this.y = Math.max(0, Math.min(targetY - halfH, mapHeight - this.viewportHeight));
  }

  tileToScreen(tileX, tileY) {
    return {
      sx: this.offsetX + (tileX - this.x) * this.tileSize,
      sy: this.offsetY + (tileY - this.y) * this.tileSize,
    };
  }

  isInView(tileX, tileY) {
    return tileX >= this.x && tileX < this.x + this.viewportWidth &&
           tileY >= this.y && tileY < this.y + this.viewportHeight;
  }
}

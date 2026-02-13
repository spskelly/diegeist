import { TILE_SIZE } from './constants.js';

export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = Math.floor(canvasWidth / TILE_SIZE);
    this.viewportHeight = Math.floor(canvasHeight / TILE_SIZE);
  }

  resize(canvasWidth, canvasHeight) {
    this.viewportWidth = Math.floor(canvasWidth / TILE_SIZE);
    this.viewportHeight = Math.floor(canvasHeight / TILE_SIZE);
  }

  centerOn(targetX, targetY, mapWidth, mapHeight) {
    const halfW = Math.floor(this.viewportWidth / 2);
    const halfH = Math.floor(this.viewportHeight / 2);
    this.x = Math.max(0, Math.min(targetX - halfW, mapWidth - this.viewportWidth));
    this.y = Math.max(0, Math.min(targetY - halfH, mapHeight - this.viewportHeight));
  }

  tileToScreen(tileX, tileY) {
    return {
      sx: (tileX - this.x) * TILE_SIZE,
      sy: (tileY - this.y) * TILE_SIZE,
    };
  }

  isInView(tileX, tileY) {
    return tileX >= this.x && tileX < this.x + this.viewportWidth &&
           tileY >= this.y && tileY < this.y + this.viewportHeight;
  }
}

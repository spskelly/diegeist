import { TILE_SPRITE_MAP } from './sprites.js';

export class Renderer {
  constructor(canvas, spriteRegistry, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = spriteRegistry;
    this.camera = camera;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMap(map) {
    const cam = this.camera;
    for (let ty = cam.y; ty < cam.y + cam.viewportHeight && ty < map.height; ty++) {
      for (let tx = cam.x; tx < cam.x + cam.viewportWidth && tx < map.width; tx++) {
        if (!map.isExplored(tx, ty)) continue;

        const tileId = map.getTile(tx, ty);
        const spriteKey = TILE_SPRITE_MAP[tileId];
        const sprite = this.sprites.get(spriteKey);
        const { sx, sy } = cam.tileToScreen(tx, ty);

        if (sprite) {
          this.ctx.drawImage(sprite, sx, sy, cam.tileSize, cam.tileSize);
        }

        if (!map.isVisible(tx, ty)) {
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          this.ctx.fillRect(sx, sy, cam.tileSize, cam.tileSize);
        }
      }
    }
  }

  drawEntity(entity, map) {
    if (!map.isVisible(entity.position.x, entity.position.y)) return;
    if (!this.camera.isInView(entity.position.x, entity.position.y)) return;

    const sprite = this.sprites.get(entity.spriteKey || 'trap');
    const { sx, sy } = this.camera.tileToScreen(entity.position.x, entity.position.y);
    if (sprite) {
      this.ctx.drawImage(sprite, sx, sy, this.camera.tileSize, this.camera.tileSize);
    }
  }

  drawPlayer(player) {
    const spriteKey = `player_${player.playerClass}`;
    const sprite = this.sprites.get(spriteKey);
    const { sx, sy } = this.camera.tileToScreen(player.position.x, player.position.y);
    if (sprite) {
      this.ctx.drawImage(sprite, sx, sy, this.camera.tileSize, this.camera.tileSize);
    }
  }

  render(gameState) {
    this.clear();
    this.drawMap(gameState.map);
    for (const groundItem of gameState.map.items) {
      if (gameState.map.isVisible(groundItem.position.x, groundItem.position.y)) {
        const { sx, sy } = this.camera.tileToScreen(groundItem.position.x, groundItem.position.y);
        const markerSize = Math.max(4, Math.floor(this.camera.tileSize * 0.35));
        const markerOffset = Math.floor((this.camera.tileSize - markerSize) / 2);
        this.ctx.fillStyle = '#ff0';
        this.ctx.fillRect(sx + markerOffset, sy + markerOffset, markerSize, markerSize);
      }
    }
    for (const entity of gameState.map.entities) {
      if (entity.type === 'enemy' && entity.isAlive()) {
        this.drawEntity(entity, gameState.map);
      }
    }
    this.drawPlayer(gameState.player);
  }
}

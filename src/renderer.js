import { TILE_SPRITE_MAP } from './sprites.js';

// progress of a timed vfx window on an entity, or -1 when it is not running.
// a start time in the future (clock reset after a reload) counts as expired
function vfxProgress(window, nowMs) {
  if (!window || typeof nowMs !== 'number') return -1;
  const t = (nowMs - window.startMs) / window.durationMs;
  if (t < 0 || t >= 1) return -1;
  return t;
}

// screen-space nudge (in tiles) for an attacker mid-lunge. the sprite eases
// toward the target and back so the strike lands at the animation's midpoint
export function getEntityVfxOffset(entity, nowMs) {
  const t = vfxProgress(entity?.vfxLunge, nowMs);
  if (t < 0) return { dx: 0, dy: 0 };
  const push = Math.sin(Math.PI * t) * entity.vfxLunge.amount;
  return { dx: entity.vfxLunge.dx * push, dy: entity.vfxLunge.dy * push };
}

export function isHitFlashActive(entity, nowMs) {
  return vfxProgress(entity?.vfxHit, nowMs) >= 0;
}

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

  drawEntity(entity, map, nowMs = null) {
    if (!map.isVisible(entity.position.x, entity.position.y)) return;
    if (!this.camera.isInView(entity.position.x, entity.position.y)) return;

    const sprite = this.sprites.get(entity.spriteKey || 'trap');
    const nudge = getEntityVfxOffset(entity, nowMs);
    const { sx, sy } = this.camera.tileToScreen(entity.position.x + nudge.dx, entity.position.y + nudge.dy);
    const ts = this.camera.tileSize;

    if (entity.renderScale && entity.renderScale > 1 && sprite) {
      const scaledSize = ts * entity.renderScale;
      const offset = (scaledSize - ts) / 2;
      // Draw aura glow behind boss
      this.ctx.fillStyle = entity.auraColor || 'rgba(200, 40, 40, 0.25)';
      this.ctx.fillRect(sx - offset - 2, sy - offset - 2, scaledSize + 4, scaledSize + 4);
      // Draw scaled sprite
      this.ctx.drawImage(sprite, sx - offset, sy - offset, scaledSize, scaledSize);
      this.drawHitFlash(entity, sprite, sx - offset, sy - offset, scaledSize, nowMs);
    } else if (sprite) {
      this.ctx.drawImage(sprite, sx, sy, ts, ts);
      this.drawHitFlash(entity, sprite, sx, sy, ts, nowMs);
    }
  }

  drawPlayer(player, nowMs = null) {
    const spriteKey = `player_${player.playerClass}`;
    const sprite = this.sprites.get(spriteKey);
    const nudge = getEntityVfxOffset(player, nowMs);
    const { sx, sy } = this.camera.tileToScreen(player.position.x + nudge.dx, player.position.y + nudge.dy);
    if (sprite) {
      this.ctx.drawImage(sprite, sx, sy, this.camera.tileSize, this.camera.tileSize);
      this.drawHitFlash(player, sprite, sx, sy, this.camera.tileSize, nowMs);
    }
  }

  // brief pale flash over the opaque pixels of a sprite that just took a hit.
  // the sprite is stamped onto a scratch canvas, recoloured with source-in so
  // only its own silhouette stays, then blended back over the map
  drawHitFlash(entity, sprite, sx, sy, size, nowMs) {
    if (!isHitFlashActive(entity, nowMs)) return;
    if (!this.flashCanvas) {
      if (typeof document === 'undefined') return;
      this.flashCanvas = document.createElement('canvas');
      this.flashCtx = this.flashCanvas.getContext('2d');
    }
    const w = sprite.width;
    const h = sprite.height;
    if (this.flashCanvas.width !== w || this.flashCanvas.height !== h) {
      this.flashCanvas.width = w;
      this.flashCanvas.height = h;
    }
    const fctx = this.flashCtx;
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, w, h);
    fctx.drawImage(sprite, 0, 0);
    fctx.globalCompositeOperation = 'source-in';
    fctx.fillStyle = '#fff4e0';
    fctx.fillRect(0, 0, w, h);
    const savedAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = 0.7;
    this.ctx.drawImage(this.flashCanvas, sx, sy, size, size);
    this.ctx.globalAlpha = savedAlpha;
  }

  render(gameState) {
    const nowMs = typeof gameState.nowMs === 'number' ? gameState.nowMs : null;
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
        this.drawEntity(entity, gameState.map, nowMs);
      }
    }
    if (gameState.player) {
      this.drawPlayer(gameState.player, nowMs);
    }
  }
}

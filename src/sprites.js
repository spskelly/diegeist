import { TILE_SIZE } from './constants.js';

export const SPRITE_DEFINITIONS = {
  wall: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(1, 1, 14, 6);
      ctx.fillRect(0, 8, 7, 6);
      ctx.fillRect(8, 8, 8, 6);
      ctx.strokeStyle = '#151525';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
    },
  },
  floor: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#353545';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(10, 6, 2, 2);
      ctx.fillRect(5, 12, 2, 2);
    },
  },
  corridor: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#33333f';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#2e2e3a';
      ctx.fillRect(4, 4, 1, 1);
      ctx.fillRect(11, 9, 1, 1);
    },
  },
  door: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(3, 2, 10, 12);
      ctx.fillStyle = '#a07818';
      ctx.fillRect(4, 3, 8, 10);
      ctx.fillStyle = '#c8a000';
      ctx.fillRect(10, 7, 2, 2);
    },
  },
  stairs_down: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#666';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(2 + i * 2, 4 + i * 3, 12 - i * 4, 2);
      }
    },
  },
  player_fighter: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#b03030';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(12, 3, 2, 8);
      ctx.fillStyle = '#a08030';
      ctx.fillRect(11, 8, 4, 2);
    },
  },
  player_archer: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#2a7030';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(13, 8, 5, -1.2, 1.2);
      ctx.stroke();
    },
  },
  player_mage: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3030a0';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      ctx.fillStyle = '#3030a0';
      ctx.fillRect(5, 0, 6, 2);
      ctx.fillRect(7, -1, 2, 1);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(13, 1, 1, 14);
      ctx.fillStyle = '#40d0ff';
      ctx.fillRect(12, 0, 3, 2);
    },
  },
  water: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#1a2a5a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#2a3a6a';
      ctx.fillRect(2, 4, 5, 1);
      ctx.fillRect(9, 8, 5, 1);
      ctx.fillRect(3, 12, 4, 1);
    },
  },
  trap: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#804040';
      ctx.fillRect(4, 4, 8, 1);
      ctx.fillRect(4, 11, 8, 1);
      ctx.fillRect(4, 4, 1, 8);
      ctx.fillRect(11, 4, 1, 8);
      ctx.fillRect(7, 6, 2, 4);
    },
  },
};

export const TILE_SPRITE_MAP = {
  0: 'wall',
  1: 'floor',
  2: 'corridor',
  3: 'door',
  4: 'stairs_down',
  5: 'water',
  6: 'trap',
};

export class SpriteRegistry {
  constructor() {
    this.cache = {};
  }

  init() {
    for (const [key, def] of Object.entries(SPRITE_DEFINITIONS)) {
      const canvas = document.createElement('canvas');
      canvas.width = def.size;
      canvas.height = def.size;
      const ctx = canvas.getContext('2d');
      def.draw(ctx);
      this.cache[key] = canvas;
    }
  }

  get(key) {
    return this.cache[key] || null;
  }
}

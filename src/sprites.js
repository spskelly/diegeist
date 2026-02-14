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
  door_open: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(2, 2, 2, 12);
      ctx.fillRect(12, 2, 2, 12);
      ctx.fillStyle = '#a07818';
      ctx.fillRect(3, 2, 1, 12);
      ctx.fillRect(12, 2, 1, 12);
      ctx.fillStyle = '#2d2d38';
      ctx.fillRect(5, 2, 6, 12);
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
  arrow_projectile: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#d6b35c';
      ctx.fillRect(4, 7, 8, 2);
      ctx.fillStyle = '#f0d388';
      ctx.fillRect(11, 6, 3, 4);
      ctx.fillStyle = '#80624a';
      ctx.fillRect(2, 6, 2, 4);
      ctx.fillRect(1, 5, 1, 6);
    },
  },
  arcbolt_projectile: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#3ce0ff';
      ctx.fillRect(7, 2, 2, 4);
      ctx.fillRect(5, 5, 2, 4);
      ctx.fillRect(8, 6, 2, 4);
      ctx.fillRect(6, 9, 2, 4);
      ctx.fillRect(8, 10, 2, 4);
      ctx.fillStyle = '#9ff3ff';
      ctx.fillRect(7, 4, 2, 2);
      ctx.fillRect(7, 8, 2, 2);
    },
  },
  bat: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#2b2f44';
      ctx.fillRect(2, 7, 5, 3);
      ctx.fillRect(9, 7, 5, 3);
      ctx.fillStyle = '#3e4663';
      ctx.fillRect(5, 6, 6, 4);
      ctx.fillStyle = '#252a3a';
      ctx.fillRect(6, 10, 4, 2);
      ctx.fillStyle = '#d84a4a';
      ctx.fillRect(7, 7, 1, 1);
      ctx.fillRect(9, 7, 1, 1);
    },
  },
  cultist: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#4a2b62';
      ctx.fillRect(5, 5, 6, 8);
      ctx.fillStyle = '#2d193b';
      ctx.fillRect(4, 8, 8, 5);
      ctx.fillStyle = '#d2b48c';
      ctx.fillRect(6, 3, 4, 3);
      ctx.fillStyle = '#6f4a8a';
      ctx.fillRect(5, 2, 6, 2);
      ctx.fillStyle = '#9a73b4';
      ctx.fillRect(7, 8, 2, 3);
    },
  },
  boss_tyrant: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#2b1a1a';
      ctx.fillRect(2, 4, 12, 10);
      ctx.fillStyle = '#4a2b2b';
      ctx.fillRect(1, 8, 14, 6);
      ctx.fillStyle = '#d9c7a0';
      ctx.fillRect(5, 2, 6, 4);
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(4, 0, 8, 2);
      ctx.fillRect(3, 1, 2, 2);
      ctx.fillRect(11, 1, 2, 2);
      ctx.fillStyle = '#ff5c5c';
      ctx.fillRect(6, 3, 1, 1);
      ctx.fillRect(9, 3, 1, 1);
      ctx.fillStyle = '#9f2b2b';
      ctx.fillRect(4, 11, 3, 3);
      ctx.fillRect(9, 11, 3, 3);
    },
  },
  rat: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#8b6040';
      ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = '#6b4030';
      ctx.fillRect(5, 5, 3, 2);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(5, 6, 1, 1);
      ctx.fillRect(7, 6, 1, 1);
      ctx.fillStyle = '#8b6040';
      ctx.fillRect(2, 10, 2, 3);
      ctx.fillRect(10, 10, 2, 3);
      ctx.fillStyle = '#a07050';
      ctx.fillRect(11, 8, 4, 1);
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
  7: 'door_open',
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

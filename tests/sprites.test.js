import { describe, it, expect } from 'vitest';
import { SPRITE_DEFINITIONS, TILE_SPRITE_MAP } from '../src/sprites.js';

describe('SpriteDefinitions', () => {
  it('has definitions for all tile sprites', () => {
    expect(SPRITE_DEFINITIONS.wall).toBeDefined();
    expect(SPRITE_DEFINITIONS.floor).toBeDefined();
    expect(SPRITE_DEFINITIONS.corridor).toBeDefined();
    expect(SPRITE_DEFINITIONS.door).toBeDefined();
    expect(SPRITE_DEFINITIONS.door_open).toBeDefined();
    expect(SPRITE_DEFINITIONS.stairs_down).toBeDefined();
    expect(SPRITE_DEFINITIONS.water).toBeDefined();
    expect(SPRITE_DEFINITIONS.trap).toBeDefined();
  });

  it('has definitions for player class sprites', () => {
    expect(SPRITE_DEFINITIONS.player_fighter).toBeDefined();
    expect(SPRITE_DEFINITIONS.player_archer).toBeDefined();
    expect(SPRITE_DEFINITIONS.player_mage).toBeDefined();
  });

  it('each sprite definition has a draw function', () => {
    for (const [key, def] of Object.entries(SPRITE_DEFINITIONS)) {
      expect(typeof def.draw).toBe('function');
    }
  });

  it('each sprite definition has size 16', () => {
    for (const [key, def] of Object.entries(SPRITE_DEFINITIONS)) {
      expect(def.size).toBe(16);
    }
  });
});

describe('TILE_SPRITE_MAP', () => {
  it('maps tile type IDs to sprite keys', () => {
    expect(TILE_SPRITE_MAP[0]).toBe('wall');
    expect(TILE_SPRITE_MAP[1]).toBe('floor');
    expect(TILE_SPRITE_MAP[2]).toBe('corridor');
    expect(TILE_SPRITE_MAP[3]).toBe('door');
    expect(TILE_SPRITE_MAP[4]).toBe('stairs_down');
    expect(TILE_SPRITE_MAP[5]).toBe('water');
    expect(TILE_SPRITE_MAP[6]).toBe('trap');
    expect(TILE_SPRITE_MAP[7]).toBe('door_open');
  });
});

import { describe, it, expect } from 'vitest';
import { GameMap } from '../src/game-map.js';
import { TILE } from '../src/constants.js';

describe('GameMap', () => {
  it('creates a map filled with walls by default', () => {
    const map = new GameMap(10, 10);
    expect(map.width).toBe(10);
    expect(map.height).toBe(10);
    expect(map.getTile(0, 0)).toBe(TILE.WALL);
    expect(map.getTile(5, 5)).toBe(TILE.WALL);
  });

  it('sets and gets tile values', () => {
    const map = new GameMap(10, 10);
    map.setTile(3, 4, TILE.FLOOR);
    expect(map.getTile(3, 4)).toBe(TILE.FLOOR);
  });

  it('returns WALL for out-of-bounds coordinates', () => {
    const map = new GameMap(10, 10);
    expect(map.getTile(-1, 0)).toBe(TILE.WALL);
    expect(map.getTile(0, -1)).toBe(TILE.WALL);
    expect(map.getTile(10, 0)).toBe(TILE.WALL);
    expect(map.getTile(0, 10)).toBe(TILE.WALL);
  });

  it('checks if a coordinate is in bounds', () => {
    const map = new GameMap(10, 10);
    expect(map.inBounds(0, 0)).toBe(true);
    expect(map.inBounds(9, 9)).toBe(true);
    expect(map.inBounds(-1, 0)).toBe(false);
    expect(map.inBounds(10, 0)).toBe(false);
  });

  it('checks if a tile is walkable', () => {
    const map = new GameMap(10, 10);
    expect(map.isWalkable(5, 5)).toBe(false);
    map.setTile(5, 5, TILE.FLOOR);
    expect(map.isWalkable(5, 5)).toBe(true);
  });

  it('checks if a tile blocks line of sight', () => {
    const map = new GameMap(10, 10);
    expect(map.blocksLOS(5, 5)).toBe(true);
    map.setTile(5, 5, TILE.FLOOR);
    expect(map.blocksLOS(5, 5)).toBe(false);
  });

  it('tracks explored tiles (initially all unexplored)', () => {
    const map = new GameMap(10, 10);
    expect(map.isExplored(5, 5)).toBe(false);
    map.setExplored(5, 5, true);
    expect(map.isExplored(5, 5)).toBe(true);
  });

  it('tracks visible tiles (initially all not visible)', () => {
    const map = new GameMap(10, 10);
    expect(map.isVisible(5, 5)).toBe(false);
    map.setVisible(5, 5, true);
    expect(map.isVisible(5, 5)).toBe(true);
  });

  it('clears all visibility', () => {
    const map = new GameMap(10, 10);
    map.setVisible(3, 3, true);
    map.setVisible(5, 5, true);
    map.clearVisibility();
    expect(map.isVisible(3, 3)).toBe(false);
    expect(map.isVisible(5, 5)).toBe(false);
  });

  it('stores and retrieves rooms', () => {
    const map = new GameMap(10, 10);
    const room = { x: 1, y: 1, width: 4, height: 4, type: 'standard' };
    map.addRoom(room);
    expect(map.rooms).toHaveLength(1);
    expect(map.rooms[0]).toEqual(room);
  });

  it('has empty entity and item lists initially', () => {
    const map = new GameMap(10, 10);
    expect(map.entities).toEqual([]);
    expect(map.items).toEqual([]);
  });
});

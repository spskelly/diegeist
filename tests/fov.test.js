import { describe, it, expect } from 'vitest';
import { computeFOV } from '../src/fov.js';
import { GameMap } from '../src/game-map.js';
import { TILE } from '../src/constants.js';

describe('computeFOV', () => {
  function makeOpenMap(size) {
    const map = new GameMap(size, size);
    for (let y = 1; y < size - 1; y++)
      for (let x = 1; x < size - 1; x++)
        map.setTile(x, y, TILE.FLOOR);
    return map;
  }

  it('marks the origin tile as visible', () => {
    const map = makeOpenMap(20);
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(10, 10)).toBe(true);
  });

  it('marks nearby open tiles as visible', () => {
    const map = makeOpenMap(20);
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(11, 10)).toBe(true);
    expect(map.isVisible(10, 11)).toBe(true);
    expect(map.isVisible(12, 12)).toBe(true);
  });

  it('does not mark tiles beyond radius as visible', () => {
    const map = makeOpenMap(30);
    computeFOV(map, 15, 15, 3);
    expect(map.isVisible(15, 15)).toBe(true);
    // 4 tiles away on one axis should be invisible
    expect(map.isVisible(19, 15)).toBe(false);
  });

  it('walls block visibility behind them', () => {
    const map = makeOpenMap(20);
    map.setTile(10, 8, TILE.WALL);
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(10, 8)).toBe(true);  // wall itself is visible
    expect(map.isVisible(10, 7)).toBe(false); // behind wall
  });

  it('marks visible tiles as explored', () => {
    const map = makeOpenMap(20);
    expect(map.isExplored(11, 10)).toBe(false);
    computeFOV(map, 10, 10, 8);
    expect(map.isExplored(11, 10)).toBe(true);
  });

  it('clears previous visibility before computing', () => {
    const map = makeOpenMap(20);
    map.setVisible(1, 1, true);
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(1, 1)).toBe(false);
  });

  it('explored tiles remain explored after FOV moves away', () => {
    const map = makeOpenMap(20);
    computeFOV(map, 5, 5, 3);
    expect(map.isExplored(6, 5)).toBe(true);
    // Now compute FOV from a distant position
    computeFOV(map, 15, 15, 3);
    // The old tile should still be explored but not visible
    expect(map.isExplored(6, 5)).toBe(true);
    expect(map.isVisible(6, 5)).toBe(false);
  });
});

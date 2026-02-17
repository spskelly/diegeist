import { describe, it, expect } from 'vitest';
import { buildTownMap, getTownSpawnPos, SHELTER_POS, SHELTER_ENTRANCE_POS } from '../src/town.js';
import { TILE, TOWN_SIZE } from '../src/constants.js';

describe('buildTownMap', () => {
  it('creates a 32x32 map', () => {
    const map = buildTownMap();
    expect(map.width).toBe(TOWN_SIZE);
    expect(map.height).toBe(TOWN_SIZE);
  });

  it('fills majority of tiles with grass', () => {
    const map = buildTownMap();
    let grassCount = 0;
    for (let y = 0; y < TOWN_SIZE; y++) {
      for (let x = 0; x < TOWN_SIZE; x++) {
        if (map.getTile(x, y) === TILE.GRASS) grassCount++;
      }
    }
    expect(grassCount).toBeGreaterThan(TOWN_SIZE * TOWN_SIZE * 0.5);
  });

  it('places shelter as a 2x2 block', () => {
    const map = buildTownMap();
    expect(map.getTile(SHELTER_POS.x, SHELTER_POS.y)).toBe(TILE.SHELTER);
    expect(map.getTile(SHELTER_POS.x + 1, SHELTER_POS.y)).toBe(TILE.SHELTER);
    expect(map.getTile(SHELTER_POS.x, SHELTER_POS.y + 1)).toBe(TILE.SHELTER);
    expect(map.getTile(SHELTER_POS.x + 1, SHELTER_POS.y + 1)).toBe(TILE.SHELTER);
  });

  it('places shelter entrance below the shelter', () => {
    const map = buildTownMap();
    expect(map.getTile(SHELTER_ENTRANCE_POS.x, SHELTER_ENTRANCE_POS.y)).toBe(TILE.SHELTER_ENTRANCE);
  });

  it('shelter body is not walkable', () => {
    const props = TILE.properties[TILE.SHELTER];
    expect(props.walkable).toBe(false);
    expect(props.blocksLOS).toBe(true);
  });

  it('shelter entrance is walkable', () => {
    const props = TILE.properties[TILE.SHELTER_ENTRANCE];
    expect(props.walkable).toBe(true);
    expect(props.blocksLOS).toBe(false);
  });

  it('has water tiles in the eastern area', () => {
    const map = buildTownMap();
    let waterCount = 0;
    for (let y = 0; y < TOWN_SIZE; y++) {
      for (let x = 20; x < TOWN_SIZE; x++) {
        if (map.getTile(x, y) === TILE.TOWN_WATER) waterCount++;
      }
    }
    expect(waterCount).toBeGreaterThan(0);
  });

  it('has rock tiles in the northwest quadrant', () => {
    const map = buildTownMap();
    let rockCount = 0;
    for (let y = 0; y < TOWN_SIZE / 2; y++) {
      for (let x = 0; x < TOWN_SIZE / 2; x++) {
        if (map.getTile(x, y) === TILE.TOWN_ROCK) rockCount++;
      }
    }
    expect(rockCount).toBeGreaterThan(0);
  });

  it('has hill tiles in the south', () => {
    const map = buildTownMap();
    let hillCount = 0;
    for (let y = 20; y < TOWN_SIZE; y++) {
      for (let x = 0; x < TOWN_SIZE; x++) {
        if (map.getTile(x, y) === TILE.TOWN_HILL) hillCount++;
      }
    }
    expect(hillCount).toBeGreaterThan(0);
  });

  it('marks all tiles as explored', () => {
    const map = buildTownMap();
    for (let y = 0; y < TOWN_SIZE; y++) {
      for (let x = 0; x < TOWN_SIZE; x++) {
        expect(map.isExplored(x, y)).toBe(true);
      }
    }
  });

  it('marks all tiles as visible', () => {
    const map = buildTownMap();
    for (let y = 0; y < TOWN_SIZE; y++) {
      for (let x = 0; x < TOWN_SIZE; x++) {
        expect(map.isVisible(x, y)).toBe(true);
      }
    }
  });

  it('is deterministic — two calls produce identical output', () => {
    const map1 = buildTownMap();
    const map2 = buildTownMap();
    for (let y = 0; y < TOWN_SIZE; y++) {
      for (let x = 0; x < TOWN_SIZE; x++) {
        expect(map1.getTile(x, y)).toBe(map2.getTile(x, y));
      }
    }
  });

  it('has path tiles forming a cross through center', () => {
    const map = buildTownMap();
    let pathCount = 0;
    for (let y = 0; y < TOWN_SIZE; y++) {
      for (let x = 0; x < TOWN_SIZE; x++) {
        if (map.getTile(x, y) === TILE.TOWN_PATH) pathCount++;
      }
    }
    expect(pathCount).toBeGreaterThan(0);
  });
});

describe('town tile properties', () => {
  it('grass is walkable and does not block LOS', () => {
    const props = TILE.properties[TILE.GRASS];
    expect(props.walkable).toBe(true);
    expect(props.blocksLOS).toBe(false);
  });

  it('path is walkable and does not block LOS', () => {
    const props = TILE.properties[TILE.TOWN_PATH];
    expect(props.walkable).toBe(true);
    expect(props.blocksLOS).toBe(false);
  });

  it('water is not walkable and does not block LOS', () => {
    const props = TILE.properties[TILE.TOWN_WATER];
    expect(props.walkable).toBe(false);
    expect(props.blocksLOS).toBe(false);
  });

  it('rock is not walkable and blocks LOS', () => {
    const props = TILE.properties[TILE.TOWN_ROCK];
    expect(props.walkable).toBe(false);
    expect(props.blocksLOS).toBe(true);
  });

  it('hill is walkable and does not block LOS', () => {
    const props = TILE.properties[TILE.TOWN_HILL];
    expect(props.walkable).toBe(true);
    expect(props.blocksLOS).toBe(false);
  });
});

describe('getTownSpawnPos', () => {
  it('returns saved position when available', () => {
    const saveData = { townPlayerPos: { x: 10, y: 12 } };
    const pos = getTownSpawnPos(saveData);
    expect(pos).toEqual({ x: 10, y: 12 });
  });

  it('returns a copy, not a reference to the saved position', () => {
    const saveData = { townPlayerPos: { x: 10, y: 12 } };
    const pos = getTownSpawnPos(saveData);
    pos.x = 99;
    expect(saveData.townPlayerPos.x).toBe(10);
  });

  it('returns default position near shelter when no save', () => {
    const pos = getTownSpawnPos(null);
    expect(pos.x).toBe(SHELTER_ENTRANCE_POS.x);
    expect(pos.y).toBe(SHELTER_ENTRANCE_POS.y + 1);
  });

  it('returns default position when saveData has no townPlayerPos', () => {
    const pos = getTownSpawnPos({ townPlayerPos: null });
    expect(pos.x).toBe(SHELTER_ENTRANCE_POS.x);
    expect(pos.y).toBe(SHELTER_ENTRANCE_POS.y + 1);
  });
});

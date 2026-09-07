import { TILE, TOWN_SIZE } from './constants.js';
import { GameMap } from './game-map.js';
import { stampBuildings } from './town-buildings.js';

export const SHELTER_POS = { x: 15, y: 15 };
export const SHELTER_ENTRANCE_POS = { x: 16, y: 17 };

export function buildTownMap(saveData = null) {
  const map = new GameMap(TOWN_SIZE, TOWN_SIZE);

  // 1. Fill with grass
  for (let y = 0; y < TOWN_SIZE; y++) {
    for (let x = 0; x < TOWN_SIZE; x++) {
      map.setTile(x, y, TILE.GRASS);
    }
  }

  // 2. River running north-south through eastern third (~x=23 with meander)
  for (let y = 0; y < TOWN_SIZE; y++) {
    const offset = Math.floor(Math.sin(y * 0.4) * 1.5);
    for (let dx = -1; dx <= 1; dx++) {
      const rx = 23 + offset + dx;
      if (rx >= 0 && rx < TOWN_SIZE) {
        map.setTile(rx, y, TILE.TOWN_WATER);
      }
    }
  }

  // 3. Rocky outcrops in northwest quadrant
  const rockPositions = [
    [3,2],[4,2],[5,2],
    [2,3],[3,3],[4,3],[5,3],[6,3],
    [2,4],[3,4],[4,4],[5,4],
    [3,5],[4,5],
    [2,6],[3,6],
  ];
  for (const [rx, ry] of rockPositions) {
    map.setTile(rx, ry, TILE.TOWN_ROCK);
  }

  // 4. Hillside in the south
  for (let y = 26; y <= 29; y++) {
    for (let x = 4; x <= 18; x++) {
      if ((x + y) % 3 !== 0) {
        map.setTile(x, y, TILE.TOWN_HILL);
      }
    }
  }

  // 5. Paths — cross pattern through center
  for (let x = 10; x <= 20; x++) {
    if (map.getTile(x, 16) === TILE.GRASS) {
      map.setTile(x, 16, TILE.TOWN_PATH);
    }
  }
  for (let y = 10; y <= 22; y++) {
    if (map.getTile(15, y) === TILE.GRASS) {
      map.setTile(15, y, TILE.TOWN_PATH);
    }
  }

  // 6. Shelter (2x2 at center)
  map.setTile(SHELTER_POS.x, SHELTER_POS.y, TILE.SHELTER);
  map.setTile(SHELTER_POS.x + 1, SHELTER_POS.y, TILE.SHELTER);
  map.setTile(SHELTER_POS.x, SHELTER_POS.y + 1, TILE.SHELTER);
  map.setTile(SHELTER_POS.x + 1, SHELTER_POS.y + 1, TILE.SHELTER);

  // Entrance tile below the shelter
  map.setTile(SHELTER_ENTRANCE_POS.x, SHELTER_ENTRANCE_POS.y, TILE.SHELTER_ENTRANCE);

  // 6b. Player-built structures
  stampBuildings(map, saveData?.buildings || []);

  // 7. Mark all tiles explored and visible (no FOV in town)
  for (let y = 0; y < TOWN_SIZE; y++) {
    for (let x = 0; x < TOWN_SIZE; x++) {
      map.setExplored(x, y, true);
      map.setVisible(x, y, true);
    }
  }

  return map;
}

export function getTownSpawnPos(saveData) {
  if (saveData?.townPlayerPos) {
    return { ...saveData.townPlayerPos };
  }
  return { x: SHELTER_ENTRANCE_POS.x, y: SHELTER_ENTRANCE_POS.y + 1 };
}

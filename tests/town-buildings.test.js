import { describe, it, expect } from 'vitest';
import { buildTownMap, SHELTER_POS } from '../src/town.js';
import { SaveData } from '../src/progression.js';
import { TILE } from '../src/constants.js';
import { generateItem } from '../src/items.js';
import { resolvePassiveEffects } from '../src/skill-tree.js';
import {
  BUILDINGS, BUILDING_ORDER, BLUEPRINT_DROPS, MAX_BUILDING_LEVEL,
  getBuildCost, formatCost, canAffordCost, hasBlueprint,
  canPlaceBuilding, placeBuilding, upgradeBuilding, findBuildingAt, getEntrance,
  getTownLevel, getTownIncome, applyTownIncome, getWatchtowerRevealFloors,
  forgeOperation, brewPotion, chooseBlessing, applyBlessingToEffects, respecSkills,
  getBuildingMenu, describeBuilding,
} from '../src/town-buildings.js';

function richSave() {
  const save = new SaveData();
  save.materials = { timber: 200, stone: 200, iron: 200, crystal: 200, aether: 200 };
  return save;
}

describe('building definitions', () => {
  it('every building has three level costs and a usable description', () => {
    for (const type of BUILDING_ORDER) {
      const def = BUILDINGS[type];
      expect(def.cost).toHaveLength(MAX_BUILDING_LEVEL);
      for (let lvl = 1; lvl <= MAX_BUILDING_LEVEL; lvl++) {
        expect(formatCost(getBuildCost(type, lvl))).not.toBe('free');
        expect(describeBuilding({ preRunBlessing: null }, { type, level: lvl }).length).toBeGreaterThan(5);
      }
    }
  });

  it('blueprint buildings are gated until the boss drops the blueprint', () => {
    const save = new SaveData();
    expect(hasBlueprint(save, 'farm')).toBe(true);
    expect(hasBlueprint(save, 'forge')).toBe(false);
    save.blueprints.push(BLUEPRINT_DROPS.brood_mother);
    expect(hasBlueprint(save, 'forge')).toBe(true);
  });
});

describe('placement', () => {
  it('accepts open grass with a walkable door tile', () => {
    const map = buildTownMap();
    expect(canPlaceBuilding(map, 5, 10, []).ok).toBe(true);
  });

  it('rejects water, rock, paths, the shelter, the border and the player tile', () => {
    const map = buildTownMap();
    expect(canPlaceBuilding(map, 21, 10, []).ok).toBe(false); // river
    expect(canPlaceBuilding(map, 3, 2, []).ok).toBe(false); // rocks
    expect(canPlaceBuilding(map, SHELTER_POS.x, SHELTER_POS.y, []).ok).toBe(false);
    expect(canPlaceBuilding(map, 0, 5, []).ok).toBe(false);
    expect(canPlaceBuilding(map, 5, 10, [], { x: 6, y: 11 }).ok).toBe(false);
    // door must land on walkable ground
    map.setTile(5, 12, TILE.TOWN_WATER);
    expect(canPlaceBuilding(map, 5, 10, []).ok).toBe(false);
  });

  it('places, spends materials, stamps tiles and refuses overlap', () => {
    const save = richSave();
    const map = buildTownMap();
    const result = placeBuilding(save, map, 'farm', 5, 10);
    expect(result.ok).toBe(true);
    expect(save.materials.timber).toBe(180);
    expect(save.buildings).toHaveLength(1);
    expect(map.getTile(5, 10)).toBe(TILE.BUILDING);
    expect(map.getTile(6, 11)).toBe(TILE.BUILDING);
    expect(map.getTile(5, 12)).toBe(TILE.BUILDING_ENTRANCE);
    expect(getEntrance(result.building)).toEqual({ x: 5, y: 12 });
    expect(findBuildingAt(save.buildings, 6, 10)).toBe(result.building);
    expect(findBuildingAt(save.buildings, 5, 12)).toBe(result.building);
    expect(placeBuilding(save, map, 'mine', 6, 10).ok).toBe(false);
    expect(placeBuilding(save, map, 'farm', 10, 10).ok).toBe(false); // one per type
    // a rebuilt map from the save carries the building
    const rebuilt = buildTownMap(save);
    expect(rebuilt.getTile(5, 10)).toBe(TILE.BUILDING);
  });

  it('refuses when unaffordable or without a blueprint', () => {
    const save = new SaveData();
    const map = buildTownMap();
    expect(placeBuilding(save, map, 'farm', 5, 10).reason).toMatch(/materials/);
    save.materials.timber = 100;
    expect(placeBuilding(save, map, 'forge', 5, 10).reason).toMatch(/blueprint/);
  });

  it('upgrades through three levels and computes town level', () => {
    const save = richSave();
    const map = buildTownMap();
    const { building } = placeBuilding(save, map, 'mine', 5, 10);
    expect(upgradeBuilding(save, building).ok).toBe(true);
    expect(upgradeBuilding(save, building).ok).toBe(true);
    expect(building.level).toBe(3);
    expect(upgradeBuilding(save, building).ok).toBe(false);
    expect(getTownLevel(save)).toBe(1);
    placeBuilding(save, map, 'farm', 10, 10);
    placeBuilding(save, map, 'watchtower', 10, 20);
    expect(getTownLevel(save)).toBe(1);
    expect(canAffordCost(save, { aether: 999 })).toBe(false);
  });
});

describe('income and passive effects', () => {
  it('farms and mines pay materials at the end of a run', () => {
    const save = richSave();
    const map = buildTownMap();
    placeBuilding(save, map, 'farm', 5, 10);
    const { building: mine } = placeBuilding(save, map, 'mine', 10, 10);
    upgradeBuilding(save, mine);
    const income = getTownIncome(save);
    expect(income.materials.timber).toBe(4);
    expect(income.materials.stone).toBe(5);
    expect(income.materials.iron).toBe(2);
    expect(income.lines).toHaveLength(2);
    const before = { ...save.materials };
    applyTownIncome(save);
    expect(save.materials.timber).toBe(before.timber + 4);
    expect(save.materials.iron).toBe(before.iron + 2);
  });

  it('watchtower reveals more floors per level', () => {
    const save = richSave();
    const map = buildTownMap();
    expect(getWatchtowerRevealFloors(save)).toBe(0);
    const { building } = placeBuilding(save, map, 'watchtower', 5, 10);
    expect(getWatchtowerRevealFloors(save)).toBe(1);
    upgradeBuilding(save, building);
    expect(getWatchtowerRevealFloors(save)).toBe(2);
  });
});

describe('services', () => {
  it('forge rerolls, tempers and sockets stashed gear at the right levels', () => {
    const save = richSave();
    const forge = { type: 'forge', level: 1 };
    const item = generateItem({ floorLevel: 3, forceRarity: 'common' });
    expect(forgeOperation(save, forge, item, 'temper').ok).toBe(false);
    expect(forgeOperation(save, forge, item, 'reroll').ok).toBe(true);
    expect(save.materials.stone).toBe(195);
    forge.level = 3;
    expect(forgeOperation(save, forge, item, 'temper').ok).toBe(true);
    expect(item.rarity).toBe('uncommon');
    const statCount = Object.keys(item.statBonuses).length;
    expect(forgeOperation(save, forge, item, 'socket').ok).toBe(true);
    const total = Object.values(item.statBonuses).reduce((a, b) => a + b, 0);
    expect(Object.keys(item.statBonuses).length).toBeGreaterThanOrEqual(statCount);
    expect(total).toBeGreaterThan(0);
    item.rarity = 'epic';
    expect(forgeOperation(save, forge, item, 'temper').ok).toBe(false);
  });

  it('apothecary brews up to the cap and respects level', () => {
    const save = richSave();
    const apothecary = { type: 'apothecary', level: 1 };
    expect(brewPotion(save, apothecary, 'Major Health Potion').ok).toBe(false);
    for (let i = 0; i < 3; i++) expect(brewPotion(save, apothecary, 'Minor Health Potion').ok).toBe(true);
    expect(brewPotion(save, apothecary, 'Minor Health Potion').ok).toBe(false);
    expect(save.brewedPotions).toHaveLength(3);
    expect(save.brewedPotions[0].effect).toBe('heal');
    expect(save.materials.timber).toBe(191);
  });

  it('shrine blessing costs aether and folds into passive effects', () => {
    const save = richSave();
    const shrine = { type: 'shrine', level: 2 };
    expect(chooseBlessing(save, shrine, 'vigor').ok).toBe(true);
    expect(save.materials.aether).toBe(198);
    expect(chooseBlessing(save, shrine, 'vigor').ok).toBe(false);
    const effects = applyBlessingToEffects(resolvePassiveEffects('fighter', {}), save.preRunBlessing);
    expect(effects.max_hp_mult).toBeCloseTo(1 + 0.15 * 1.5);
    const haste = applyBlessingToEffects(resolvePassiveEffects('fighter', {}), { id: 'haste', level: 1 });
    expect(haste.speed_bonus).toBe(10);
  });

  it('library respec refunds points for the class level', () => {
    const save = richSave();
    save.classLevels.fighter = 6;
    save.skillInvestments.fighter = { fighter_heavy_strike: 3, fighter_conditioning: 2 };
    save.skillPoints.fighter = 0;
    const library = { type: 'library', level: 1 };
    expect(respecSkills(save, 'fighter', library).ok).toBe(true);
    expect(save.skillInvestments.fighter).toEqual({});
    expect(save.skillPoints.fighter).toBe(5);
    expect(save.materials.aether).toBe(197);
    expect(respecSkills(save, 'fighter', library).ok).toBe(false);
  });

  it('building menus always end with upgrade and leave rows', () => {
    const save = richSave();
    save.blueprints.push('apothecary');
    const map = buildTownMap();
    const { building } = placeBuilding(save, map, 'apothecary', 5, 10);
    const game = { saveData: save, selectedClass: 'fighter', forgeItemIndex: null, leaveBuilding() { this.left = true; } };
    const rows = getBuildingMenu(game, building);
    expect(rows.at(-2).label).toMatch(/Upgrade/);
    expect(rows.at(-1).label).toBe('Leave');
    expect(rows[0].enabled).toBe(true);
    rows[0].run(game);
    expect(save.brewedPotions).toHaveLength(1);
    rows.at(-1).run(game);
    expect(game.left).toBe(true);
  });
});

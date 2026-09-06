// src/town-buildings.js
// the minimum viable town: seven 2x2 buildings placed on the town grid, paid
// for with run materials, each with one service that changes the next run.
import { TILE, TOWN_SIZE } from './constants.js';
import { MATERIALS, MATERIAL_COLORS, createEmptyMaterials } from './resources.js';
import { rerollItemStats, promoteItemRarity, socketItemStat, createConsumableByName } from './items.js';
import { getSkillPointsForLevel } from './skill-tree.js';

export const BUILDING_ORDER = ['farm', 'mine', 'watchtower', 'library', 'forge', 'apothecary', 'shrine'];

// which boss drops which blueprint on its first kill
export const BLUEPRINT_DROPS = {
  brood_mother: 'forge',
  rat_king: 'apothecary',
  bone_lord: 'shrine',
};
// display names of the bosses that carry each blueprint
export const BLUEPRINT_SOURCES = {
  forge: 'the Brood Mother (floor 3)',
  apothecary: 'the Rat King (floor 6)',
  shrine: 'the Bone Lord (floor 9)',
};

export const BUILDINGS = {
  farm: {
    id: 'farm', name: 'Farm', color: '#6a8a2a', roof: '#a08a3a',
    blurb: 'Grows timber between runs.',
    cost: [{ timber: 20 }, { timber: 30, stone: 10 }, { stone: 20, iron: 10 }],
    income: [{ timber: 4 }, { timber: 7, stone: 2 }, { timber: 10, stone: 4 }],
  },
  mine: {
    id: 'mine', name: 'Mine', color: '#5a5a66', roof: '#3a3a44',
    blurb: 'Digs stone, then iron, between runs.',
    cost: [{ timber: 20 }, { timber: 15, stone: 15 }, { stone: 20, iron: 10 }],
    income: [{ stone: 3 }, { stone: 5, iron: 2 }, { stone: 7, iron: 4, crystal: 1 }],
  },
  watchtower: {
    id: 'watchtower', name: 'Watchtower', color: '#7a6a4a', roof: '#4a3a2a',
    blurb: 'Scouts the first floors of every run.',
    cost: [{ timber: 15 }, { timber: 20, stone: 10 }, { stone: 15, iron: 10 }],
    revealFloors: [1, 2, 3],
  },
  library: {
    id: 'library', name: 'Library', color: '#4a5a8a', roof: '#2a3a6a',
    blurb: 'Respec skill points. L3 grants +10% XP.',
    cost: [{ stone: 20, iron: 10 }, { iron: 15, crystal: 5 }, { crystal: 15, aether: 5 }],
    respecCost: [{ aether: 3 }, { aether: 2 }, {}],
    xpBonus: [0, 0, 0.10],
  },
  forge: {
    id: 'forge', name: 'Forge', color: '#8a4a2a', roof: '#3a2a2a', blueprint: 'forge',
    blurb: 'Reworks stashed gear.',
    cost: [{ timber: 20, stone: 15 }, { stone: 20, iron: 15 }, { iron: 20, crystal: 10 }],
  },
  apothecary: {
    id: 'apothecary', name: 'Apothecary', color: '#3a7a6a', roof: '#2a5a4a', blueprint: 'apothecary',
    blurb: 'Brews potions for the next run.',
    cost: [{ timber: 15, stone: 10 }, { stone: 20, iron: 10 }, { iron: 15, crystal: 10 }],
  },
  shrine: {
    id: 'shrine', name: 'Shrine', color: '#7a4a8a', roof: '#c0a0e0', blueprint: 'shrine',
    blurb: 'Grants a blessing for the next run.',
    cost: [{ stone: 15, iron: 10 }, { iron: 15, crystal: 10 }, { crystal: 10, aether: 5 }],
  },
};

export const BUILDING_SIZE = 2;
export const MAX_BUILDING_LEVEL = 3;

// forge operations on a stashed item: [level required, cost]
export const FORGE_OPS = {
  reroll: { name: 'Reroll stats', level: 1, cost: { stone: 5 }, blurb: 'New random stat bonuses, same rarity.' },
  temper: { name: 'Temper (+1 rarity)', level: 2, cost: { iron: 10, crystal: 3 }, blurb: 'Raise rarity one tier, up to epic.' },
  socket: { name: 'Socket (+3 stat)', level: 3, cost: { crystal: 5, aether: 2 }, blurb: 'Add +3 to a random new stat.' },
};

// apothecary brews: [level required, cost, per-run cap]
export const BREWS = {
  'Minor Health Potion': { level: 1, cost: { timber: 3 }, cap: 3 },
  'Major Health Potion': { level: 2, cost: { stone: 4 }, cap: 2 },
  'Speed Potion': { level: 3, cost: { iron: 3 }, cap: 1 },
  'Invisibility Potion': { level: 3, cost: { iron: 3 }, cap: 1 },
};

export const BLESSING_COST = { aether: 2 };
export const BLESSINGS = {
  vigor: { id: 'vigor', name: 'Vigor', blurb: '+15% max HP', value: 0.15 },
  might: { id: 'might', name: 'Might', blurb: '+10% damage', value: 0.10 },
  fortune: { id: 'fortune', name: 'Fortune', blurb: '+10% crit chance', value: 10 },
  haste: { id: 'haste', name: 'Haste', blurb: '+10 speed', value: 10 },
};
// blessing strength by shrine level
export const BLESSING_LEVEL_MULT = [1, 1.5, 2];

export function getBuildingDef(type) {
  return BUILDINGS[type] || null;
}

export function hasBlueprint(save, type) {
  const def = getBuildingDef(type);
  if (!def || !def.blueprint) return true;
  return Array.isArray(save?.blueprints) && save.blueprints.includes(def.blueprint);
}

// cost to reach `level` (1 = build, 2 and 3 = upgrades)
export function getBuildCost(type, level) {
  const def = getBuildingDef(type);
  if (!def || level < 1 || level > MAX_BUILDING_LEVEL) return null;
  return def.cost[level - 1];
}

export function formatCost(cost) {
  if (!cost) return '';
  const parts = MATERIALS.filter(m => cost[m] > 0).map(m => `${cost[m]} ${m}`);
  return parts.length ? parts.join(', ') : 'free';
}

export function canAffordCost(save, cost) {
  if (!cost) return false;
  for (const m of MATERIALS) if ((cost[m] || 0) > (save.materials?.[m] || 0)) return false;
  return true;
}

export function getFootprint(building) {
  const tiles = [];
  for (let dy = 0; dy < BUILDING_SIZE; dy++) {
    for (let dx = 0; dx < BUILDING_SIZE; dx++) tiles.push({ x: building.x + dx, y: building.y + dy });
  }
  return tiles;
}

// the door sits under the bottom-left tile
export function getEntrance(building) {
  return { x: building.x, y: building.y + BUILDING_SIZE };
}

export function findBuildingAt(buildings, x, y) {
  return (buildings || []).find(b => {
    const e = getEntrance(b);
    if (e.x === x && e.y === y) return true;
    return x >= b.x && x < b.x + BUILDING_SIZE && y >= b.y && y < b.y + BUILDING_SIZE;
  }) || null;
}

export function getBuildingByType(save, type) {
  return (save?.buildings || []).find(b => b.type === type) || null;
}

export function getBuildingLevel(save, type) {
  return getBuildingByType(save, type)?.level || 0;
}

// placement rules: footprint on grass inside the border, door tile walkable,
// no overlap with other buildings or the player
export function canPlaceBuilding(map, x, y, buildings = [], playerPos = null) {
  const probe = { x, y };
  const tiles = getFootprint(probe);
  const door = getEntrance(probe);
  for (const t of tiles) {
    if (t.x < 1 || t.y < 1 || t.x >= TOWN_SIZE - 1 || t.y >= TOWN_SIZE - 1) return { ok: false, reason: 'Too close to the edge.' };
    if (map.getTile(t.x, t.y) !== TILE.GRASS) return { ok: false, reason: 'Needs open grass.' };
    if (findBuildingAt(buildings, t.x, t.y)) return { ok: false, reason: 'Overlaps a building.' };
    if (playerPos && playerPos.x === t.x && playerPos.y === t.y) return { ok: false, reason: 'You are standing there.' };
  }
  const doorTile = map.getTile(door.x, door.y);
  if (!map.inBounds(door.x, door.y) || !TILE.properties[doorTile]?.walkable || doorTile === TILE.SHELTER_ENTRANCE || doorTile === TILE.BUILDING_ENTRANCE) {
    return { ok: false, reason: 'The door needs open ground below.' };
  }
  if (findBuildingAt(buildings, door.x, door.y)) return { ok: false, reason: 'The door is blocked.' };
  return { ok: true, reason: '' };
}

export function stampBuilding(map, building) {
  for (const t of getFootprint(building)) map.setTile(t.x, t.y, TILE.BUILDING);
  const e = getEntrance(building);
  map.setTile(e.x, e.y, TILE.BUILDING_ENTRANCE);
}

export function stampBuildings(map, buildings) {
  for (const b of buildings || []) stampBuilding(map, b);
}

export function placeBuilding(save, map, type, x, y, playerPos = null) {
  const def = getBuildingDef(type);
  if (!def) return { ok: false, reason: 'Unknown building.' };
  if (!hasBlueprint(save, type)) return { ok: false, reason: 'You need the blueprint first.' };
  if (getBuildingByType(save, type)) return { ok: false, reason: `You already have a ${def.name}.` };
  const check = canPlaceBuilding(map, x, y, save.buildings, playerPos);
  if (!check.ok) return check;
  const cost = getBuildCost(type, 1);
  if (!canAffordCost(save, cost)) return { ok: false, reason: `Not enough materials (${formatCost(cost)}).` };
  save.spendMaterials(cost);
  const building = { id: `${type}_${Date.now()}`, type, x, y, level: 1 };
  if (!Array.isArray(save.buildings)) save.buildings = [];
  save.buildings.push(building);
  stampBuilding(map, building);
  return { ok: true, reason: '', building };
}

export function upgradeBuilding(save, building) {
  const def = getBuildingDef(building.type);
  if (!def) return { ok: false, reason: 'Unknown building.' };
  if (building.level >= MAX_BUILDING_LEVEL) return { ok: false, reason: `${def.name} is at max level.` };
  const cost = getBuildCost(building.type, building.level + 1);
  if (!canAffordCost(save, cost)) return { ok: false, reason: `Not enough materials (${formatCost(cost)}).` };
  save.spendMaterials(cost);
  building.level += 1;
  return { ok: true, reason: `${def.name} is now level ${building.level}.` };
}

export function getTownLevel(save) {
  const total = (save?.buildings || []).reduce((sum, b) => sum + (b.level || 0), 0);
  return Math.floor(total / 3);
}

// passive materials from farms and mines, paid at the end of every run
export function getTownIncome(save) {
  const total = createEmptyMaterials();
  const lines = [];
  for (const b of save?.buildings || []) {
    const def = getBuildingDef(b.type);
    const income = def?.income?.[b.level - 1];
    if (!income) continue;
    for (const m of MATERIALS) total[m] += income[m] || 0;
    lines.push(`${def.name}: ${formatCost(income)}`);
  }
  return { materials: total, lines };
}

export function applyTownIncome(save) {
  const income = getTownIncome(save);
  if (income.lines.length > 0) save.addMaterials(income.materials);
  return income;
}

export function getWatchtowerRevealFloors(save) {
  const level = getBuildingLevel(save, 'watchtower');
  return level > 0 ? BUILDINGS.watchtower.revealFloors[level - 1] : 0;
}

export function getLibraryXpBonus(save) {
  const level = getBuildingLevel(save, 'library');
  return level > 0 ? BUILDINGS.library.xpBonus[level - 1] : 0;
}

// --- services ---

export function forgeOperation(save, building, item, opKey) {
  const op = FORGE_OPS[opKey];
  if (!op || !item) return { ok: false, reason: 'Nothing to do.' };
  if (building.level < op.level) return { ok: false, reason: `${op.name} needs forge level ${op.level}.` };
  if (item.type === 'consumable') return { ok: false, reason: 'Potions cannot be forged.' };
  if (opKey === 'temper' && (item.rarity === 'epic' || item.rarity === 'legendary')) return { ok: false, reason: 'Already as fine as the forge can make it.' };
  if (!canAffordCost(save, op.cost)) return { ok: false, reason: `Not enough materials (${formatCost(op.cost)}).` };
  save.spendMaterials(op.cost);
  if (opKey === 'reroll') rerollItemStats(item);
  else if (opKey === 'temper') promoteItemRarity(item);
  else socketItemStat(item, 3);
  return { ok: true, reason: `${op.name}: ${item.name} reworked.` };
}

export function brewPotion(save, building, name) {
  const brew = BREWS[name];
  if (!brew) return { ok: false, reason: 'Unknown brew.' };
  if (building.level < brew.level) return { ok: false, reason: `${name} needs apothecary level ${brew.level}.` };
  if (!Array.isArray(save.brewedPotions)) save.brewedPotions = [];
  const brewed = save.brewedPotions.filter(p => p.name === name).length;
  if (brewed >= brew.cap) return { ok: false, reason: `Only ${brew.cap} ${name}${brew.cap > 1 ? 's' : ''} per run.` };
  if (!canAffordCost(save, brew.cost)) return { ok: false, reason: `Not enough materials (${formatCost(brew.cost)}).` };
  save.spendMaterials(brew.cost);
  save.brewedPotions.push(createConsumableByName(name, 1));
  return { ok: true, reason: `Brewed ${name} (${brewed + 1}/${brew.cap}).` };
}

export function chooseBlessing(save, building, id) {
  const blessing = BLESSINGS[id];
  if (!blessing) return { ok: false, reason: 'Unknown blessing.' };
  if (save.preRunBlessing?.id === id) return { ok: false, reason: `${blessing.name} is already chosen.` };
  if (!canAffordCost(save, BLESSING_COST)) return { ok: false, reason: `Not enough materials (${formatCost(BLESSING_COST)}).` };
  save.spendMaterials(BLESSING_COST);
  save.preRunBlessing = { id, level: building.level };
  return { ok: true, reason: `${blessing.name} will bless your next run.` };
}

// folds a blessing into a resolved passive-effects object (same shape as the tree)
export function applyBlessingToEffects(effects, blessing) {
  if (!effects || !blessing) return effects;
  const def = BLESSINGS[blessing.id];
  if (!def) return effects;
  const mult = BLESSING_LEVEL_MULT[Math.max(0, Math.min(2, (blessing.level || 1) - 1))];
  const value = def.value * mult;
  if (blessing.id === 'vigor') effects.max_hp_mult = (effects.max_hp_mult || 1) * (1 + value);
  if (blessing.id === 'might') {
    for (const key of ['melee_damage_mult', 'ranged_damage_mult', 'magic_damage_mult']) {
      effects[key] = (effects[key] || 1) * (1 + value);
    }
  }
  if (blessing.id === 'fortune') effects.crit_bonus = (effects.crit_bonus || 0) + value;
  if (blessing.id === 'haste') effects.speed_bonus = (effects.speed_bonus || 0) + value;
  return effects;
}

export function describeBlessing(blessing) {
  const def = blessing ? BLESSINGS[blessing.id] : null;
  if (!def) return 'none';
  const mult = BLESSING_LEVEL_MULT[Math.max(0, Math.min(2, (blessing.level || 1) - 1))];
  return mult === 1 ? `${def.name} (${def.blurb})` : `${def.name} x${mult}`;
}

export function respecSkills(save, classKey, building) {
  const cost = BUILDINGS.library.respecCost[building.level - 1];
  const invested = Object.values(save.skillInvestments?.[classKey] || {}).reduce((a, b) => a + b, 0);
  if (invested === 0) return { ok: false, reason: 'No skill points are invested.' };
  if (!canAffordCost(save, cost)) return { ok: false, reason: `Not enough materials (${formatCost(cost)}).` };
  save.spendMaterials(cost);
  save.skillInvestments[classKey] = {};
  save.skillPoints[classKey] = getSkillPointsForLevel(save.classLevels?.[classKey] || 1);
  return { ok: true, reason: `Skill points refunded: ${save.skillPoints[classKey]} to spend.` };
}

// one-line description of what a building does at its current level
export function describeBuilding(save, building) {
  const def = getBuildingDef(building.type);
  const lvl = building.level;
  switch (building.type) {
    case 'farm':
    case 'mine':
      return `Income per run: ${formatCost(def.income[lvl - 1])}.`;
    case 'watchtower':
      return `The first ${def.revealFloors[lvl - 1]} floor${def.revealFloors[lvl - 1] > 1 ? 's' : ''} of each run start partly explored.`;
    case 'library':
      return `Respec costs ${formatCost(def.respecCost[lvl - 1])}.${def.xpBonus[lvl - 1] ? ' +10% XP.' : ''}`;
    case 'forge':
      return `Operations: ${Object.values(FORGE_OPS).filter(o => o.level <= lvl).map(o => o.name).join(', ')}.`;
    case 'apothecary':
      return `Brews: ${Object.entries(BREWS).filter(([, b]) => b.level <= lvl).map(([n]) => n).join(', ')}.`;
    case 'shrine':
      return `Blessings are x${BLESSING_LEVEL_MULT[lvl - 1]} strength. Next run: ${describeBlessing(save.preRunBlessing)}.`;
    default:
      return def?.blurb || '';
  }
}

// rows for the building service menu. each row: { label, cost, enabled, run(game) -> notice }
export function getBuildingMenu(game, building) {
  const save = game.saveData;
  const def = getBuildingDef(building.type);
  const rows = [];
  const upgradeCost = building.level < MAX_BUILDING_LEVEL ? getBuildCost(building.type, building.level + 1) : null;

  if (building.type === 'forge') {
    const items = [...(save.stash || [])];
    // queued loadout gear can be worked on too
    if (Array.isArray(save.pendingLoadout)) items.push(...save.pendingLoadout);
    if (game.forgeItemIndex === null || game.forgeItemIndex === undefined) {
      if (items.length === 0) rows.push({ label: 'No gear in the stash to work on.', enabled: false, run: () => '' });
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        rows.push({ label: `${item.name} [${item.rarity}]`, enabled: item.type !== 'consumable', run: (g) => { g.forgeItemIndex = i; g.buildingCursor = 1; return ''; } });
      }
    } else {
      const item = items[game.forgeItemIndex];
      if (!item) { game.forgeItemIndex = null; return getBuildingMenu(game, building); }
      rows.push({ label: `Working on: ${item.name}`, enabled: false, run: () => '' });
      for (const [key, op] of Object.entries(FORGE_OPS)) {
        rows.push({
          label: op.name, cost: op.cost, enabled: building.level >= op.level && canAffordCost(save, op.cost),
          detail: building.level >= op.level ? op.blurb : `Needs forge level ${op.level}.`,
          run: (g) => forgeOperation(g.saveData, building, item, key).reason,
        });
      }
      rows.push({ label: 'Pick another item', enabled: true, run: (g) => { g.forgeItemIndex = null; g.buildingCursor = 0; return ''; } });
    }
  } else if (building.type === 'apothecary') {
    for (const [name, brew] of Object.entries(BREWS)) {
      const brewed = (save.brewedPotions || []).filter(p => p.name === name).length;
      rows.push({
        label: `Brew ${name} (${brewed}/${brew.cap})`, cost: brew.cost,
        enabled: building.level >= brew.level && brewed < brew.cap && canAffordCost(save, brew.cost),
        detail: building.level >= brew.level ? 'Added to your bag at the start of the next run.' : `Needs apothecary level ${brew.level}.`,
        run: (g) => brewPotion(g.saveData, building, name).reason,
      });
    }
  } else if (building.type === 'shrine') {
    for (const b of Object.values(BLESSINGS)) {
      rows.push({
        label: `${b.name}: ${b.blurb}`, cost: BLESSING_COST,
        enabled: save.preRunBlessing?.id !== b.id && canAffordCost(save, BLESSING_COST),
        detail: 'Lasts for the whole next run.',
        run: (g) => chooseBlessing(g.saveData, building, b.id).reason,
      });
    }
  } else if (building.type === 'library') {
    const classKey = game.selectedClass;
    const cost = def.respecCost[building.level - 1];
    rows.push({
      label: `Respec ${classKey} skill points`, cost,
      enabled: canAffordCost(save, cost),
      detail: 'Refunds every invested point for this class.',
      run: (g) => respecSkills(g.saveData, classKey, building).reason,
    });
  }

  rows.push({
    label: upgradeCost ? `Upgrade to level ${building.level + 1}` : 'Max level',
    cost: upgradeCost, enabled: !!upgradeCost && canAffordCost(save, upgradeCost),
    detail: upgradeCost ? describeUpgrade(building) : '',
    run: (g) => upgradeBuilding(g.saveData, building).reason,
  });
  rows.push({ label: 'Leave', enabled: true, run: (g) => { g.leaveBuilding(); return ''; } });
  return rows;
}

function describeUpgrade(building) {
  const next = { ...building, level: building.level + 1 };
  return describeBuilding({ preRunBlessing: null }, next);
}

export { MATERIAL_COLORS };

export const TILE_SIZE = 16;
export const ENERGY_THRESHOLD = 100;
export const BASE_SPEED = 100;
export const FOV_RADIUS = 8;
export const SOFT_GATE_MULTIPLIER = 0.65;
export const STAT_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'LCK'];

export const RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
};

export const EQUIPMENT_SLOTS = ['head', 'torso', 'legs', 'leftHand', 'rightHand', 'accessory1', 'accessory2'];
export const STAT_DESCRIPTIONS = {
  STR: 'Melee damage',
  DEX: 'Dodge, ranged dmg',
  CON: 'Max HP, defense',
  INT: 'Magic damage',
  WIS: 'Magic resist',
  LCK: 'Crit chance',
};

export const PLAYER_CLASSES = {
  fighter: { name: 'Fighter', description: 'Tough melee brawler. High STR and CON.', affinity: 'STR, CON — full melee and health scaling', baseStats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 }, baseHp: 15, affinityStats: ['STR', 'CON'] },
  archer: { name: 'Archer', description: 'Agile ranged striker. High DEX and LCK.', affinity: 'DEX, LCK — full ranged and crit scaling', baseStats: { STR: 4, DEX: 8, CON: 5, INT: 3, WIS: 4, LCK: 6 }, baseHp: 10, affinityStats: ['DEX', 'LCK'] },
  mage: { name: 'Mage', description: 'Powerful spellcaster. High INT and WIS.', affinity: 'INT, WIS — full magic and resist scaling', baseStats: { STR: 3, DEX: 4, CON: 4, INT: 8, WIS: 7, LCK: 4 }, baseHp: 10, affinityStats: ['INT', 'WIS'] },
};

export const CLASS_SKILLS = {
  archer: {
    name: 'Quick Shot',
    description: 'Basic ranged attack against the nearest visible foe.',
    cooldown: 0,
    range: 6,
    area: { type: 'single', size: 1 },
    damage: 3,
    statScaling: 'DEX',
    requiredAttackType: 'ranged',
  },
  mage: {
    name: 'Arc Bolt',
    description: 'Basic magical bolt against the nearest visible foe.',
    cooldown: 0,
    range: 6,
    area: { type: 'single', size: 1 },
    damage: 3,
    statScaling: 'INT',
    requiredAttackType: 'magic',
  },
};

export function getBiome(floorNumber) {
  if (floorNumber <= 3) return 'jungle';
  if (floorNumber <= 6) return 'dirt_cave';
  if (floorNumber <= 9) return 'stone_cave';
  return 'dungeon';
}

export const BIOME_THEMES = {
  jungle: {
    name: 'Jungle',
    floors: [1, 2, 3],
    palette: {
      wall:      { primary: '#2a4a2a', secondary: '#1e3a1e', outline: '#152515' },
      floor:     { primary: '#3a4a3a', secondary: '#354535' },
      corridor:  { primary: '#33403a', secondary: '#2e3a35' },
      door:      { frame: '#5a3a0a', panel: '#7a5a18', knob: '#c8a000' },
      door_open: { frame: '#5a3a0a', panel: '#7a5a18', interior: '#2d3d2d' },
      stairs:    { bg: '#3a4a3a', steps: '#667' },
      water:     { primary: '#1a3a3a', wave: '#2a4a4a' },
      trap:      { bg: '#3a4a3a', markings: '#804040' },
    },
    archetypeWeights: { 'corridor-heavy': 50, 'cavernous': 20, 'hybrid': 30 },
    waterChance: 0.12,
    trapChance: 0.03,
  },
  dirt_cave: {
    name: 'Dirt Cave',
    floors: [4, 5, 6],
    palette: {
      wall:      { primary: '#4a3a2a', secondary: '#3a2e1e', outline: '#2a2015' },
      floor:     { primary: '#4a4030', secondary: '#453b2b' },
      corridor:  { primary: '#403830', secondary: '#3a332a' },
      door:      { frame: '#6b4914', panel: '#8b6918', knob: '#c8a000' },
      door_open: { frame: '#6b4914', panel: '#8b6918', interior: '#38302a' },
      stairs:    { bg: '#4a4030', steps: '#777' },
      water:     { primary: '#2a2a1a', wave: '#3a3a2a' },
      trap:      { bg: '#4a4030', markings: '#804040' },
    },
    archetypeWeights: { 'corridor-heavy': 25, 'cavernous': 25, 'hybrid': 50 },
    waterChance: 0.04,
    trapChance: 0.06,
  },
  stone_cave: {
    name: 'Stone Cave',
    floors: [7, 8, 9],
    palette: {
      wall:      { primary: '#2a2a4a', secondary: '#1e1e3e', outline: '#151535' },
      floor:     { primary: '#3a3a5a', secondary: '#353555' },
      corridor:  { primary: '#33334f', secondary: '#2e2e4a' },
      door:      { frame: '#5a5a7a', panel: '#7a7a9a', knob: '#a0a0d0' },
      door_open: { frame: '#5a5a7a', panel: '#7a7a9a', interior: '#2d2d48' },
      stairs:    { bg: '#3a3a5a', steps: '#8888aa' },
      water:     { primary: '#1a1a4a', wave: '#2a2a5a' },
      trap:      { bg: '#3a3a5a', markings: '#605080' },
    },
    archetypeWeights: { 'corridor-heavy': 20, 'cavernous': 50, 'hybrid': 30 },
    waterChance: 0.06,
    trapChance: 0.08,
  },
  dungeon: {
    name: 'Dungeon',
    floors: [10],
    palette: {
      wall:      { primary: '#3a1a2a', secondary: '#2e1020', outline: '#200a18' },
      floor:     { primary: '#3a2a3a', secondary: '#352535' },
      corridor:  { primary: '#33233f', secondary: '#2e1e3a' },
      door:      { frame: '#6b1434', panel: '#8b2848', knob: '#d04060' },
      door_open: { frame: '#6b1434', panel: '#8b2848', interior: '#2d1828' },
      stairs:    { bg: '#3a2a3a', steps: '#886' },
      water:     { primary: '#2a1a3a', wave: '#3a2a4a' },
      trap:      { bg: '#3a2a3a', markings: '#a04040' },
    },
    archetypeWeights: { 'corridor-heavy': 50, 'cavernous': 15, 'hybrid': 35 },
    waterChance: 0.02,
    trapChance: 0.10,
  },
  town: {
    name: 'Town',
    palette: {
      grass:    { primary: '#4a6a30', secondary: '#3d5a28', accent: '#5a7a3a' },
      path:     { primary: '#8a7a5a', secondary: '#7a6a4a', border: '#6a5a3a' },
      water:    { primary: '#2a5a8a', wave: '#3a6a9a', foam: '#5a8aaa' },
      rock:     { primary: '#6a6a6a', secondary: '#5a5a5a', highlight: '#7a7a7a' },
      hill:     { primary: '#5a7a30', secondary: '#4a6a28', contour: '#6a8a3a' },
      shelter:  { walls: '#7a5a3a', roof: '#5a3a1a', door: '#8a6a4a' },
    },
  },
};

export const TOWN_SIZE = 32;
export const TOWN_MOVE_DELAY = 120;

export const TILE = {
  WALL: 0, FLOOR: 1, CORRIDOR: 2, DOOR: 3, STAIRS_DOWN: 4, WATER: 5, TRAP: 6, DOOR_OPEN: 7,
  // Town tiles (100+ range)
  GRASS: 100, TOWN_PATH: 101, TOWN_WATER: 102, TOWN_ROCK: 103, TOWN_HILL: 104,
  SHELTER: 105, SHELTER_ENTRANCE: 106,
  properties: {
    0: { name: 'Wall', walkable: false, blocksLOS: true },
    1: { name: 'Floor', walkable: true, blocksLOS: false },
    2: { name: 'Corridor', walkable: true, blocksLOS: false },
    3: { name: 'Door (Closed)', walkable: false, blocksLOS: true },
    4: { name: 'Stairs Down', walkable: true, blocksLOS: false },
    5: { name: 'Water', walkable: false, blocksLOS: false },
    6: { name: 'Trap', walkable: true, blocksLOS: false },
    7: { name: 'Door (Open)', walkable: true, blocksLOS: false },
    100: { name: 'Grass', walkable: true, blocksLOS: false },
    101: { name: 'Path', walkable: true, blocksLOS: false },
    102: { name: 'Water', walkable: false, blocksLOS: false },
    103: { name: 'Rock', walkable: false, blocksLOS: true },
    104: { name: 'Hill', walkable: true, blocksLOS: false },
    105: { name: 'Shelter', walkable: false, blocksLOS: true },
    106: { name: 'Shelter Entrance', walkable: true, blocksLOS: false },
  },
};

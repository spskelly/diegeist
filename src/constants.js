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
export const PLAYER_CLASSES = {
  fighter: { name: 'Fighter', baseStats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 }, baseHp: 15, affinityStats: ['STR', 'CON'] },
  archer: { name: 'Archer', baseStats: { STR: 4, DEX: 8, CON: 5, INT: 3, WIS: 4, LCK: 6 }, baseHp: 10, affinityStats: ['DEX', 'LCK'] },
  mage: { name: 'Mage', baseStats: { STR: 3, DEX: 4, CON: 4, INT: 8, WIS: 7, LCK: 4 }, baseHp: 10, affinityStats: ['INT', 'WIS'] },
};

export const TILE = {
  WALL: 0, FLOOR: 1, CORRIDOR: 2, DOOR: 3, STAIRS_DOWN: 4, WATER: 5, TRAP: 6,
  properties: {
    0: { name: 'Wall', walkable: false, blocksLOS: true },
    1: { name: 'Floor', walkable: true, blocksLOS: false },
    2: { name: 'Corridor', walkable: true, blocksLOS: false },
    3: { name: 'Door', walkable: true, blocksLOS: false },
    4: { name: 'Stairs Down', walkable: true, blocksLOS: false },
    5: { name: 'Water', walkable: false, blocksLOS: false },
    6: { name: 'Trap', walkable: true, blocksLOS: false },
  },
};

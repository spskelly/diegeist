import { RARITY, EQUIPMENT_SLOTS, STAT_NAMES } from './constants.js';

let nextItemId = 1;

export const ITEM_TEMPLATES = [
  { baseName: 'Sword', slot: 'leftHand', baseType: 'weapon', primaryStat: 'STR', attackType: 'melee' },
  { baseName: 'Greataxe', slot: 'leftHand', baseType: 'weapon', primaryStat: 'STR', attackType: 'melee' },
  { baseName: 'Dagger', slot: 'leftHand', baseType: 'weapon', primaryStat: 'DEX', attackType: 'melee' },
  { baseName: 'Longbow', slot: 'leftHand', baseType: 'weapon', primaryStat: 'DEX', attackType: 'ranged' },
  { baseName: 'Crossbow', slot: 'leftHand', baseType: 'weapon', primaryStat: 'DEX', attackType: 'ranged' },
  { baseName: 'Staff', slot: 'leftHand', baseType: 'weapon', primaryStat: 'INT', attackType: 'magic' },
  { baseName: 'Wand', slot: 'leftHand', baseType: 'weapon', primaryStat: 'INT', attackType: 'magic' },
  { baseName: 'Shield', slot: 'rightHand', baseType: 'weapon', primaryStat: 'CON', attackType: 'melee' },
  { baseName: 'Orb', slot: 'rightHand', baseType: 'weapon', primaryStat: 'WIS', attackType: 'magic' },
  { baseName: 'Helmet', slot: 'head', baseType: 'armor', primaryStat: 'CON' },
  { baseName: 'Hood', slot: 'head', baseType: 'armor', primaryStat: 'DEX' },
  { baseName: 'Crown', slot: 'head', baseType: 'armor', primaryStat: 'INT' },
  { baseName: 'Plate Armor', slot: 'torso', baseType: 'armor', primaryStat: 'CON' },
  { baseName: 'Leather Armor', slot: 'torso', baseType: 'armor', primaryStat: 'DEX' },
  { baseName: 'Robe', slot: 'torso', baseType: 'armor', primaryStat: 'INT' },
  { baseName: 'Greaves', slot: 'legs', baseType: 'armor', primaryStat: 'CON' },
  { baseName: 'Boots', slot: 'legs', baseType: 'armor', primaryStat: 'DEX' },
  { baseName: 'Ring', slot: 'accessory1', baseType: 'accessory', primaryStat: 'LCK' },
  { baseName: 'Amulet', slot: 'accessory2', baseType: 'accessory', primaryStat: 'WIS' },
];

const PREFIXES = ['Iron', 'Steel', 'Blessed', 'Cursed', 'Ancient', 'Dark', 'Shadow', 'Flame', 'Frost', 'Thunder', 'Bone', 'Crystal'];
const SUFFIXES = ['of Power', 'of Speed', 'of Fortitude', 'of Insight', 'of Wisdom', 'of Fortune', 'of Cleaving', 'of Piercing', 'of the Mage'];

const SKILL_POOL = [
  { name: 'Cleave', description: 'Hit all adjacent enemies', range: 1, area: { type: 'cone', size: 3 }, statScaling: 'STR', baseDamage: 4 },
  { name: 'Shield Bash', description: 'Stun adjacent enemy for 1 turn', range: 1, area: { type: 'single', size: 1 }, statScaling: 'STR', baseDamage: 2 },
  { name: 'Power Shot', description: 'Piercing shot through first target', range: 6, area: { type: 'line', size: 6 }, statScaling: 'DEX', baseDamage: 5 },
  { name: 'Multishot', description: 'Fire at 2-3 targets', range: 5, area: { type: 'single', size: 1 }, statScaling: 'DEX', baseDamage: 3 },
  { name: 'Fireball', description: 'AoE explosion at target (3x3)', range: 5, area: { type: 'circle', size: 3 }, statScaling: 'INT', baseDamage: 6 },
  { name: 'Chain Lightning', description: 'Hits target + jumps to 1-2 nearby', range: 5, area: { type: 'single', size: 1 }, statScaling: 'INT', baseDamage: 4 },
  { name: 'Frost Nova', description: 'AoE around caster, slows enemies', range: 0, area: { type: 'circle', size: 3 }, statScaling: 'INT', baseDamage: 3 },
];

const STARTER_CLASS_WEAPONS = {
  fighter: {
    name: 'Rusty Sword',
    slot: 'leftHand',
    type: 'weapon',
    attackType: 'melee',
    statBonuses: { STR: 1 },
    skill: null,
    description: 'A worn blade, but still reliable in close quarters.',
  },
  archer: {
    name: 'Training Bow',
    slot: 'leftHand',
    type: 'weapon',
    attackType: 'ranged',
    statBonuses: { DEX: 1 },
    skill: {
      name: 'Quick Shot',
      description: 'Basic ranged attack against the nearest visible foe.',
      cooldown: 0,
      currentCooldown: 0,
      range: 6,
      area: { type: 'single', size: 1 },
      damage: 3,
      statScaling: 'DEX',
    },
    description: 'A simple short bow built for fast shots.',
  },
  mage: {
    name: 'Apprentice Wand',
    slot: 'leftHand',
    type: 'weapon',
    attackType: 'magic',
    statBonuses: { INT: 1 },
    skill: {
      name: 'Arc Bolt',
      description: 'Basic magical bolt against the nearest visible foe.',
      cooldown: 0,
      currentCooldown: 0,
      range: 6,
      area: { type: 'single', size: 1 },
      damage: 3,
      statScaling: 'INT',
    },
    description: 'A beginner focus for channeling raw arcane force.',
  },
};

const RARITY_CONFIG = {
  common:    { statMultiplier: 1.0, maxBonuses: 2, skillChance: 0.10, cooldownRange: [6, 8], dropWeight: 50 },
  uncommon:  { statMultiplier: 1.3, maxBonuses: 3, skillChance: 0.30, cooldownRange: [5, 7], dropWeight: 30 },
  rare:      { statMultiplier: 1.7, maxBonuses: 4, skillChance: 0.60, cooldownRange: [4, 6], dropWeight: 15 },
  epic:      { statMultiplier: 2.2, maxBonuses: 5, skillChance: 0.90, cooldownRange: [3, 5], dropWeight: 4 },
  legendary: { statMultiplier: 3.0, maxBonuses: 6, skillChance: 1.00, cooldownRange: [2, 3], dropWeight: 1 },
};

function rollRarity(floorLevel, luck = 0, context = 'drop') {
  const contextBonus = context === 'boss' ? 20 : context === 'chest' ? 10 : 0;
  const luckBonus = luck * 0.5;
  const floorBonus = floorLevel * 2;
  const totalBonus = contextBonus + luckBonus + floorBonus;

  const weights = {
    common: Math.max(1, RARITY_CONFIG.common.dropWeight - totalBonus),
    uncommon: RARITY_CONFIG.uncommon.dropWeight + totalBonus * 0.3,
    rare: RARITY_CONFIG.rare.dropWeight + totalBonus * 0.2,
    epic: Math.max(0, RARITY_CONFIG.epic.dropWeight + totalBonus * 0.1),
    legendary: floorLevel >= 10 ? RARITY_CONFIG.legendary.dropWeight + totalBonus * 0.05 : 0,
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

function generateStatBonuses(rarity, floorLevel, primaryStat) {
  const config = RARITY_CONFIG[rarity];
  const bonuses = {};
  const numBonuses = 1 + Math.floor(Math.random() * config.maxBonuses);

  // Always include primary stat
  const baseValue = Math.ceil(floorLevel * 0.5 * config.statMultiplier);
  bonuses[primaryStat] = baseValue + Math.floor(Math.random() * Math.max(1, Math.ceil(baseValue * 0.5)));

  // Add random bonus stats
  const otherStats = STAT_NAMES.filter(s => s !== primaryStat);
  for (let i = 1; i < numBonuses; i++) {
    const stat = otherStats[Math.floor(Math.random() * otherStats.length)];
    const value = Math.max(1, Math.ceil(baseValue * 0.5 * (0.5 + Math.random())));
    bonuses[stat] = (bonuses[stat] || 0) + value;
  }

  return bonuses;
}

function generateSkill(rarity) {
  const config = RARITY_CONFIG[rarity];
  if (Math.random() > config.skillChance) return null;

  const template = SKILL_POOL[Math.floor(Math.random() * SKILL_POOL.length)];
  const cooldown = config.cooldownRange[0] + Math.floor(Math.random() * (config.cooldownRange[1] - config.cooldownRange[0] + 1));

  return {
    name: template.name,
    description: template.description,
    cooldown,
    currentCooldown: 0,
    range: template.range,
    area: { ...template.area },
    damage: template.baseDamage,
    statScaling: template.statScaling,
  };
}

function generateName(template, rarity) {
  let name = template.baseName;
  if (rarity !== 'common' && Math.random() > 0.3) {
    name = PREFIXES[Math.floor(Math.random() * PREFIXES.length)] + ' ' + name;
  }
  if ((rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') && Math.random() > 0.4) {
    name += ' ' + SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  }
  return name;
}

export function generateItem({ floorLevel, luck = 0, context = 'drop', forceRarity = null }) {
  const template = ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)];
  const rarity = forceRarity || rollRarity(floorLevel, luck, context);
  const statBonuses = generateStatBonuses(rarity, floorLevel, template.primaryStat);
  const skill = generateSkill(rarity);
  const name = generateName(template, rarity);

  return {
    id: `item_${nextItemId++}`,
    name,
    type: template.baseType === 'weapon' ? 'weapon' : template.slot === 'accessory1' || template.slot === 'accessory2' ? 'accessory' : template.baseType,
    rarity,
    slot: template.slot,
    statBonuses,
    skill,
    floorLevel,
    attackType: template.attackType || null,
    description: `A ${rarity} ${template.baseName.toLowerCase()} found on floor ${floorLevel}.`,
    sprite: template.baseName.toLowerCase().replace(/\s+/g, '_'),
  };
}

export const CONSUMABLE_TYPES = [
  { name: 'Minor Health Potion', effect: 'heal', magnitudeBase: 0.25, rarity: 'common' },
  { name: 'Major Health Potion', effect: 'heal', magnitudeBase: 0.60, rarity: 'uncommon' },
  { name: 'Scroll of Mapping', effect: 'reveal_map', magnitudeBase: 1, rarity: 'uncommon' },
  { name: 'Bomb', effect: 'aoe_damage', magnitudeBase: 8, rarity: 'uncommon' },
  { name: 'Speed Potion', effect: 'speed_boost', magnitudeBase: 10, rarity: 'rare' },
  { name: 'Invisibility Potion', effect: 'invisibility', magnitudeBase: 8, rarity: 'rare' },
  { name: 'Scroll of Teleportation', effect: 'teleport', magnitudeBase: 1, rarity: 'rare' },
];

export function generateConsumable(floorLevel) {
  const template = CONSUMABLE_TYPES[Math.floor(Math.random() * CONSUMABLE_TYPES.length)];
  return {
    id: `item_${nextItemId++}`,
    name: template.name,
    type: 'consumable',
    rarity: template.rarity,
    slot: null,
    statBonuses: {},
    skill: null,
    effect: template.effect,
    magnitude: template.magnitudeBase,
    floorLevel,
    description: `${template.name}.`,
    sprite: 'consumable',
    stackable: true,
  };
}

export function createStarterWeapon(classKey) {
  const template = STARTER_CLASS_WEAPONS[classKey];
  if (!template) return null;

  return {
    id: `item_${nextItemId++}`,
    name: template.name,
    type: template.type,
    rarity: 'common',
    slot: template.slot,
    statBonuses: { ...template.statBonuses },
    skill: template.skill
      ? {
        ...template.skill,
        area: { ...template.skill.area },
      }
      : null,
    attackType: template.attackType || 'melee',
    floorLevel: 1,
    description: template.description,
    sprite: template.name.toLowerCase().replace(/\s+/g, '_'),
  };
}

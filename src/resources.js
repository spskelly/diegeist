export const MATERIALS = ['timber', 'stone', 'iron', 'crystal', 'aether'];

export const MATERIAL_COLORS = {
  timber: '#c4a05a',
  stone: '#b8b8a8',
  iron: '#8eaaba',
  crystal: '#b48ee8',
  aether: '#d8b4ff',
};

export const BIOME_MATERIALS = {
  wilds:    { primary: 'timber',  secondary: 'stone',   tertiary: 'iron' },
  cave:     { primary: 'stone',   secondary: 'iron',    tertiary: 'timber' },
  dungeon:  { primary: 'iron',    secondary: 'crystal', tertiary: 'stone' },
  eldritch: { primary: 'crystal', secondary: 'iron',    tertiary: 'aether' },
};

const BASE_DROP_CHANCE = 0.40;
const BASE_QTY_MIN = 1;
const BASE_QTY_MAX = 2;
const QTY_RANK_SCALE = 0.35;
const SECONDARY_CHANCE = 0.15;  // at rank 3+
const TERTIARY_CHANCE = 0.08;   // at rank 5+

export function createEmptyMaterials() {
  return { timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 };
}

export function addMaterials(target, source) {
  for (const mat of MATERIALS) {
    target[mat] = (target[mat] || 0) + (source[mat] || 0);
  }
}

export function scaleMaterials(materials, factor) {
  const result = createEmptyMaterials();
  for (const mat of MATERIALS) {
    result[mat] = materials[mat] > 0 ? Math.ceil(materials[mat] * factor) : 0;
  }
  return result;
}

export function rollMaterialDrop(biome, rank = 1, opts = {}) {
  const roll = opts.forceRoll ?? Math.random();
  if (roll >= BASE_DROP_CHANCE) return null;

  const biomeMats = BIOME_MATERIALS[biome] || BIOME_MATERIALS.wilds;
  const qtyRoll = opts.forceQtyRoll ?? Math.random();

  // Determine which material type drops
  let type = biomeMats.primary;
  if (rank >= 5) {
    const tertiaryRoll = opts.forceTertiaryRoll ?? Math.random();
    if (tertiaryRoll < TERTIARY_CHANCE) {
      type = biomeMats.tertiary;
    }
  }
  if (rank >= 3 && type === biomeMats.primary) {
    const secondaryRoll = opts.forceSecondaryRoll ?? Math.random();
    if (secondaryRoll < SECONDARY_CHANCE) {
      type = biomeMats.secondary;
    }
  }

  // Scale quantity with rank
  const rankMultiplier = 1 + (rank - 1) * QTY_RANK_SCALE;
  const scaledMin = Math.max(1, Math.round(BASE_QTY_MIN * rankMultiplier));
  const scaledMax = Math.max(scaledMin, Math.round(BASE_QTY_MAX * rankMultiplier));
  const quantity = scaledMin + Math.floor(qtyRoll * (scaledMax - scaledMin + 1));

  return { type, quantity };
}

export function getFloorClearMaterials(biome, rank = 1, qtyRoll = null) {
  const biomeMats = BIOME_MATERIALS[biome] || BIOME_MATERIALS.wilds;
  const roll = qtyRoll ?? Math.random();
  const baseMin = 3;
  const baseMax = 5;
  const rankMultiplier = 1 + (rank - 1) * QTY_RANK_SCALE;
  const scaledMin = Math.round(baseMin * rankMultiplier);
  const scaledMax = Math.round(baseMax * rankMultiplier);
  const quantity = scaledMin + Math.floor(roll * (scaledMax - scaledMin + 1));
  return { type: biomeMats.primary, quantity };
}

export function getBossKillMaterials(biome, rank = 1, qtyRoll = null) {
  const biomeMats = BIOME_MATERIALS[biome] || BIOME_MATERIALS.wilds;
  const roll = qtyRoll ?? Math.random();
  const aetherQty = 2 + Math.floor(roll * 3); // 2-4

  const rankMultiplier = 1 + (rank - 1) * QTY_RANK_SCALE;
  const primaryQty = Math.round(3 * rankMultiplier) + Math.floor(roll * Math.round(3 * rankMultiplier));

  return [
    { type: 'aether', quantity: aetherQty },
    { type: biomeMats.primary, quantity: primaryQty },
  ];
}

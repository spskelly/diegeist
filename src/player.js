import { Entity } from './entity.js';
import { PLAYER_CLASSES, BASE_SPEED, STAT_NAMES, HP_PER_CON, HP_GROWTH_PER_LEVEL } from './constants.js';

// affinity stats grow by one point every two character levels
export function getLevelStatBonuses(classKey, level) {
  const classDef = PLAYER_CLASSES[classKey];
  const bonus = Math.floor(Math.max(1, level) / 2);
  const bonuses = {};
  for (const stat of STAT_NAMES) bonuses[stat] = 0;
  if (!classDef) return bonuses;
  for (const stat of classDef.affinityStats) bonuses[stat] = bonus;
  return bonuses;
}

// max hp grows with con (including gear), character level and tree passives
export function computePlayerMaxHp(classKey, totalStats, level = 1, treeEffects = null) {
  const classDef = PLAYER_CLASSES[classKey];
  const baseHp = classDef ? classDef.baseHp : 30;
  const base = baseHp + (totalStats?.CON || 0) * HP_PER_CON;
  const growth = 1 + HP_GROWTH_PER_LEVEL * Math.max(0, level - 1);
  const mult = treeEffects?.max_hp_mult || 1;
  return Math.max(1, Math.round(base * growth * mult));
}

export function createPlayer(classKey, x, y, permanentBonuses = {}, level = 1) {
  const classDef = PLAYER_CLASSES[classKey];
  const stats = { ...classDef.baseStats };
  const levelBonuses = getLevelStatBonuses(classKey, level);
  for (const stat of STAT_NAMES) {
    stats[stat] += (permanentBonuses[stat] || 0) + (levelBonuses[stat] || 0);
  }
  const player = new Entity({
    id: 'player',
    type: 'player',
    x,
    y,
    stats,
    maxHp: computePlayerMaxHp(classKey, stats, level),
    speed: BASE_SPEED,
    name: classDef.name,
  });
  player.playerClass = classKey;
  player.affinityStats = classDef.affinityStats;
  player.level = level;
  player.gold = 0;
  player.floorNumber = 1;
  return player;
}

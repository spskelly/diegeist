import { Entity } from './entity.js';
import { PLAYER_CLASSES, BASE_SPEED, STAT_NAMES } from './constants.js';

export function createPlayer(classKey, x, y, permanentBonuses = {}) {
  const classDef = PLAYER_CLASSES[classKey];
  const stats = { ...classDef.baseStats };
  for (const stat of STAT_NAMES) {
    stats[stat] += (permanentBonuses[stat] || 0);
  }
  const player = new Entity({
    id: 'player',
    type: 'player',
    x,
    y,
    stats,
    maxHp: classDef.baseHp,
    speed: BASE_SPEED,
    name: classDef.name,
  });
  player.playerClass = classKey;
  player.affinityStats = classDef.affinityStats;
  player.gold = 0;
  player.floorNumber = 1;
  return player;
}

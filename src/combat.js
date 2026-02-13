import { SOFT_GATE_MULTIPLIER } from './constants.js';

export function getEffectiveStat(statValue, isAffinity) {
  return isAffinity ? statValue : statValue * SOFT_GATE_MULTIPLIER;
}

export function calculateDamage({ baseDamage, stat, isAffinity, weaponMultiplier, defense, isMagic, targetWIS }) {
  const effectiveStat = getEffectiveStat(stat, isAffinity);
  let dmg = baseDamage * (effectiveStat / 5) * weaponMultiplier - defense;
  if (isMagic && targetWIS > 0) {
    dmg -= targetWIS * 0.5;
  }
  return Math.max(1, Math.floor(dmg));
}

export function resolveAttack(attacker, defender, options = {}) {
  const {
    baseDamage = 3,
    damageType = 'melee', // 'melee', 'ranged', 'magic'
    weaponMultiplier = 1.0,
    forceCrit = null,
    forceDodge = null,
  } = options;

  // Determine if dodged
  const dodgeChance = defender.stats.DEX * 1.0; // DEX% dodge chance
  const dodged = forceDodge !== null ? forceDodge : Math.random() * 100 < dodgeChance;

  if (dodged) {
    return { hit: false, dodged: true, crit: false, damage: 0, killed: false };
  }

  // Determine relevant stat and affinity
  let relevantStat;
  let isAffinity;
  const affinityStats = attacker.affinityStats || [];

  if (damageType === 'melee') {
    relevantStat = attacker.stats.STR;
    isAffinity = affinityStats.includes('STR');
  } else if (damageType === 'ranged') {
    relevantStat = attacker.stats.DEX;
    isAffinity = affinityStats.includes('DEX');
  } else {
    relevantStat = attacker.stats.INT;
    isAffinity = affinityStats.includes('INT');
  }

  // Determine crit
  const critChance = attacker.stats.LCK * 1.5;
  const isCrit = forceCrit !== null ? forceCrit : Math.random() * 100 < critChance;

  // Calculate defense (CON-based rough defense)
  const defense = Math.floor(defender.stats.CON * 0.3);
  const isMagic = damageType === 'magic';

  let damage = calculateDamage({
    baseDamage,
    stat: relevantStat,
    isAffinity,
    weaponMultiplier,
    defense,
    isMagic,
    targetWIS: defender.stats.WIS,
  });

  if (isCrit) {
    damage = Math.floor(damage * 2);
  }

  damage = Math.max(1, damage);
  defender.takeDamage(damage);

  return {
    hit: true,
    dodged: false,
    crit: isCrit,
    damage,
    killed: !defender.isAlive(),
  };
}

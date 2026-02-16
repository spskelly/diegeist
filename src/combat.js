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

  // Determine crit (lucky_strike doubles crit chance)
  let critChance = attacker.stats.LCK * 1.5;
  const luckyStrike = attacker.hasStatusEffect?.('lucky_strike');
  if (luckyStrike) critChance *= luckyStrike.value;
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

  // War Cry: attacker damage boost
  const warCry = attacker.hasStatusEffect?.('war_cry');
  if (warCry) damage = Math.floor(damage * warCry.value);

  if (isCrit) {
    damage = Math.floor(damage * 2);
  }

  // Fortify: defender damage reduction
  const fortify = defender.hasStatusEffect?.('fortify');
  if (fortify) damage = Math.max(1, Math.floor(damage * (1 - fortify.value)));

  // Iron Skin: defender damage reduction
  const ironSkin = defender.hasStatusEffect?.('iron_skin');
  if (ironSkin) damage = Math.max(1, Math.floor(damage * (1 - ironSkin.value)));

  // Mana Shield: absorb damage
  const manaShield = defender.hasStatusEffect?.('mana_shield');
  if (manaShield) {
    const absorbed = Math.min(damage, manaShield.value);
    damage -= absorbed;
    manaShield.value -= absorbed;
    if (manaShield.value <= 0) {
      defender.statusEffects = defender.statusEffects.filter(e => e.type !== 'mana_shield');
    }
  }

  damage = Math.max(1, damage);
  defender.takeDamage(damage);

  // Thorns: reflect damage back to attacker
  let thornsDamage = 0;
  const thorns = defender.hasStatusEffect?.('thorns');
  if (thorns && damageType === 'melee') {
    thornsDamage = Math.max(1, Math.floor(damage * thorns.value));
    attacker.takeDamage(thornsDamage);
  }

  return {
    hit: true,
    dodged: false,
    crit: isCrit,
    damage,
    thornsDamage,
    killed: !defender.isAlive(),
  };
}

import { SOFT_GATE_MULTIPLIER } from './constants.js';

// defense is percentage-based: every point of CON (or WIS against magic) shaves
// MITIGATION_PER_POINT off incoming damage, capped at MAX_MITIGATION. a flat
// subtraction made every low-level hit collapse to the minimum of 1 damage.
export const MITIGATION_PER_POINT = 0.02;
export const MAX_MITIGATION = 0.6;

export function getEffectiveStat(statValue, isAffinity) {
  return isAffinity ? statValue : statValue * SOFT_GATE_MULTIPLIER;
}

export function getMitigation(statValue) {
  return Math.min(MAX_MITIGATION, Math.max(0, statValue || 0) * MITIGATION_PER_POINT);
}

// damage dealt by a trap on a given floor. disarming it costs half.
export function getTrapDamage(floorNumber) {
  return 6 + floorNumber * 3;
}

export function calculateDamage({ baseDamage, stat, isAffinity, weaponMultiplier, defense, isMagic, targetWIS }) {
  const effectiveStat = getEffectiveStat(stat, isAffinity);
  const raw = baseDamage * (effectiveStat / 5) * weaponMultiplier;
  const mitigation = getMitigation(isMagic ? targetWIS : defense);
  return Math.max(1, Math.round(raw * (1 - mitigation)));
}

export function resolveAttack(attacker, defender, options = {}) {
  const {
    baseDamage = 3,
    damageType = 'melee', // 'melee', 'ranged', 'magic'
    weaponMultiplier = 1.0,
    forceCrit = null,
    forceDodge = null,
    attackerTreeEffects = null,
    defenderTreeEffects = null,
    damageMultiplier = 1,
  } = options;

  const isMagic = damageType === 'magic';

  // Determine if dodged
  let dodgeChance = defender.stats.DEX * 1.0; // DEX% dodge chance
  if (defenderTreeEffects?.dodge_bonus) dodgeChance += defenderTreeEffects.dodge_bonus;
  const dodged = forceDodge !== null ? forceDodge : Math.random() * 100 < dodgeChance;

  if (dodged) {
    return { hit: false, dodged: true, blocked: false, countered: false, crit: false, damage: 0, killed: false, thornsDamage: 0 };
  }

  // Block chance (Shield Wall) — skill tree passive
  if (defenderTreeEffects?.block_chance > 0) {
    const blocked = Math.random() * 100 < defenderTreeEffects.block_chance * 100;
    if (blocked) {
      return { hit: false, dodged: false, blocked: true, countered: false, crit: false, damage: 0, killed: false, thornsDamage: 0 };
    }
  }

  // Counterspell — negate a magic attack entirely
  if (isMagic && defenderTreeEffects?.counterspell_chance > 0) {
    if (Math.random() < defenderTreeEffects.counterspell_chance) {
      return { hit: false, dodged: false, blocked: true, countered: true, crit: false, damage: 0, killed: false, thornsDamage: 0 };
    }
  }

  // Determine relevant stat and affinity. the soft gate only applies to
  // classed attackers; monsters have no affinity list and use their stats in full.
  let relevantStat;
  let isAffinity;
  const affinityStats = attacker.affinityStats || null;
  const hasAffinity = (stat) => !affinityStats || affinityStats.includes(stat);

  if (damageType === 'melee') {
    relevantStat = attacker.stats.STR;
    isAffinity = hasAffinity('STR');
  } else if (damageType === 'ranged') {
    relevantStat = attacker.stats.DEX;
    isAffinity = hasAffinity('DEX');
  } else {
    relevantStat = attacker.stats.INT;
    isAffinity = hasAffinity('INT');
  }

  // Determine crit (lucky_strike doubles crit chance)
  let critChance = attacker.stats.LCK * 1.5;
  const luckyStrike = attacker.hasStatusEffect?.('lucky_strike');
  if (luckyStrike) critChance *= luckyStrike.value;
  if (attackerTreeEffects?.crit_bonus) critChance += attackerTreeEffects.crit_bonus;
  const isCrit = forceCrit !== null ? forceCrit : Math.random() * 100 < critChance;

  // Defense is CON for physical hits and WIS for magic (percentage mitigation)
  const defense = defender.stats.CON;

  let damage = calculateDamage({
    baseDamage,
    stat: relevantStat,
    isAffinity,
    weaponMultiplier,
    defense,
    isMagic,
    targetWIS: defender.stats.WIS,
  });

  // Skill tree damage type multipliers
  if (attackerTreeEffects) {
    if (damageType === 'melee' && attackerTreeEffects.melee_damage_mult > 1.0) {
      damage = Math.floor(damage * attackerTreeEffects.melee_damage_mult);
    } else if (damageType === 'ranged' && attackerTreeEffects.ranged_damage_mult > 1.0) {
      damage = Math.floor(damage * attackerTreeEffects.ranged_damage_mult);
    } else if (damageType === 'magic' && attackerTreeEffects.magic_damage_mult > 1.0) {
      damage = Math.floor(damage * attackerTreeEffects.magic_damage_mult);
    }
  }

  // caller-supplied multiplier (ambush, rush, overcharge, chain lightning ...)
  if (damageMultiplier !== 1) damage = Math.max(1, Math.floor(damage * damageMultiplier));

  // War Cry / Berserker Rage: attacker damage boost
  const warCry = attacker.hasStatusEffect?.('war_cry');
  if (warCry) damage = Math.floor(damage * warCry.value);
  const berserk = attacker.hasStatusEffect?.('berserk');
  if (berserk) damage = Math.floor(damage * berserk.value);

  // Tactical Advance: one-shot bonus granted by stepping next to an enemy
  const tactical = attacker.hasStatusEffect?.('tactical');
  if (tactical) {
    damage = Math.floor(damage * (1 + tactical.value));
    attacker.statusEffects = attacker.statusEffects.filter(e => e.type !== 'tactical');
  }

  if (isCrit) {
    let critMult = 2;
    if (attackerTreeEffects?.crit_damage_bonus) critMult += attackerTreeEffects.crit_damage_bonus;
    damage = Math.floor(damage * critMult);
  }

  // Berserker Rage on the defender: takes extra damage
  const defenderBerserk = defender.hasStatusEffect?.('berserk');
  if (defenderBerserk && defenderBerserk.defenseReduction) {
    damage = Math.floor(damage * (1 + defenderBerserk.defenseReduction));
  }

  // Fortify: defender damage reduction
  const fortify = defender.hasStatusEffect?.('fortify');
  if (fortify) damage = Math.max(1, Math.floor(damage * (1 - fortify.value)));

  // Iron Skin: defender damage reduction
  const ironSkin = defender.hasStatusEffect?.('iron_skin');
  if (ironSkin) damage = Math.max(1, Math.floor(damage * (1 - ironSkin.value)));

  // Skill tree damage reduction (Iron Hide), magic resistance (Arcane Barrier), passive absorb (Mana Shield)
  if (defenderTreeEffects?.damage_reduction > 0) {
    damage = Math.max(1, Math.floor(damage * (1 - defenderTreeEffects.damage_reduction)));
  }
  if (isMagic && defenderTreeEffects?.magic_resistance > 0) {
    damage = Math.max(1, Math.floor(damage * (1 - defenderTreeEffects.magic_resistance)));
  }
  if (defenderTreeEffects?.passive_absorb > 0) {
    damage = Math.max(1, Math.floor(damage * (1 - defenderTreeEffects.passive_absorb)));
  }

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
    blocked: false,
    countered: false,
    crit: isCrit,
    damage,
    thornsDamage,
    killed: !defender.isAlive(),
  };
}

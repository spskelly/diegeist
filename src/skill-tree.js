// src/skill-tree.js

// --- XP & Leveling ---

// XP required to reach each level (cumulative thresholds)
// Level 1 = 0 XP (starting), Level 2 = 100 XP, etc.
export const XP_TABLE = [
  0,     // Level 1
  100,   // Level 2
  225,   // Level 3
  375,   // Level 4
  550,   // Level 5
  800,   // Level 6
  1100,  // Level 7
  1450,  // Level 8
  1850,  // Level 9
  2350,  // Level 10
  2950,  // Level 11
  3650,  // Level 12
  4500,  // Level 13
  5500,  // Level 14
  6700,  // Level 15
  8200,  // Level 16
  10000, // Level 17
  12200, // Level 18
  14800, // Level 19
  18000, // Level 20
];

export const MAX_LEVEL = 20;

export function getLevelForXP(xp) {
  for (let i = XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= XP_TABLE[i]) return i + 1;
  }
  return 1;
}

export function getSkillPointsForLevel(level) {
  if (level < 1) return 0;
  let points = 0;
  for (let i = 2; i <= Math.min(level, MAX_LEVEL); i++) {
    points += i >= 16 ? 2 : 1;
  }
  return points;
}

export function getXPForNextLevel(currentLevel) {
  if (currentLevel >= MAX_LEVEL) return null;
  return XP_TABLE[currentLevel]; // XP_TABLE[level-1] is threshold for that level; [currentLevel] = next
}

// --- Skill Tree Definitions ---

const FIGHTER_TREE = [
  // Warfare branch
  {
    id: 'fighter_heavy_strike', name: 'Heavy Strike', branch: 'warfare', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Melee damage +8% per rank.',
    effectPerRank: [
      { type: 'melee_damage_mult', value: 1.08 },
      { type: 'melee_damage_mult', value: 1.16 },
      { type: 'melee_damage_mult', value: 1.24 },
    ],
  },
  {
    id: 'fighter_conditioning', name: 'Conditioning', branch: 'warfare', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Max HP +6% per rank.',
    effectPerRank: [
      { type: 'max_hp_mult', value: 1.06 },
      { type: 'max_hp_mult', value: 1.12 },
      { type: 'max_hp_mult', value: 1.18 },
    ],
  },
  {
    id: 'fighter_cleave', name: 'Cleave', branch: 'warfare', tier: 2,
    maxRank: 3, prerequisites: [{ skillId: 'fighter_heavy_strike', minRank: 1 }],
    skillType: 'passive', cooldown: null,
    description: '15/25/35% chance melee hits splash to adjacent enemy.',
    effectPerRank: [
      { type: 'cleave_chance', value: 0.15 },
      { type: 'cleave_chance', value: 0.25 },
      { type: 'cleave_chance', value: 0.35 },
    ],
  },
  {
    id: 'fighter_staggering_blow', name: 'Staggering Blow', branch: 'warfare', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'fighter_heavy_strike', minRank: 2 }],
    skillType: 'passive', cooldown: null,
    description: 'Melee crits stun target for 1/2 turn(s).',
    effectPerRank: [
      { type: 'stun_on_crit', value: 1 },
      { type: 'stun_on_crit', value: 2 },
    ],
  },
  {
    id: 'fighter_berserker_rage', name: 'Berserker Rage', branch: 'warfare', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'fighter_cleave', minRank: 2 },
      { skillId: 'fighter_conditioning', minRank: 2 },
    ],
    skillType: 'active', cooldown: 15,
    description: '+40% damage, -20% defense for 5 turns.',
    effectPerRank: [
      { type: 'self_buff', damageBonus: 1.4, defenseReduction: 0.2, duration: 5 },
    ],
  },

  // Bulwark branch
  {
    id: 'fighter_iron_hide', name: 'Iron Hide', branch: 'bulwark', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Damage taken reduced by 3%/6%/9%.',
    effectPerRank: [
      { type: 'damage_reduction', value: 0.03 },
      { type: 'damage_reduction', value: 0.06 },
      { type: 'damage_reduction', value: 0.09 },
    ],
  },
  {
    id: 'fighter_regeneration', name: 'Regeneration', branch: 'bulwark', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Passive regen: heal 1 HP every 20/15/10 turns.',
    effectPerRank: [
      { type: 'passive_regen', interval: 20 },
      { type: 'passive_regen', interval: 15 },
      { type: 'passive_regen', interval: 10 },
    ],
  },
  {
    id: 'fighter_shield_wall', name: 'Shield Wall', branch: 'bulwark', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'fighter_iron_hide', minRank: 1 }],
    skillType: 'passive', cooldown: null,
    description: '10/18% block chance when stationary (negates hit).',
    effectPerRank: [
      { type: 'block_chance', value: 0.10 },
      { type: 'block_chance', value: 0.18 },
    ],
  },
  {
    id: 'fighter_retaliation', name: 'Retaliation', branch: 'bulwark', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'fighter_iron_hide', minRank: 2 }],
    skillType: 'passive', cooldown: null,
    description: '20/35% chance to counter-attack for 50% damage when hit in melee.',
    effectPerRank: [
      { type: 'retaliation_chance', value: 0.20 },
      { type: 'retaliation_chance', value: 0.35 },
    ],
  },
  {
    id: 'fighter_unbreakable', name: 'Unbreakable', branch: 'bulwark', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'fighter_shield_wall', minRank: 2 },
      { skillId: 'fighter_regeneration', minRank: 2 },
    ],
    skillType: 'passive', cooldown: null,
    description: 'Survive one killing blow per floor at 1 HP.',
    effectPerRank: [
      { type: 'death_save', value: 1 },
    ],
  },

  // Vanguard branch
  {
    id: 'fighter_rush', name: 'Rush', branch: 'vanguard', tier: 1,
    maxRank: 2, prerequisites: [], skillType: 'active',
    cooldown: 8,
    description: 'Move 2/3 tiles in a direction, damaging first enemy hit.',
    effectPerRank: [
      { type: 'rush', distance: 2, damage: 1.0 },
      { type: 'rush', distance: 3, damage: 1.0 },
    ],
  },
  {
    id: 'fighter_vigilance', name: 'Vigilance', branch: 'vanguard', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Dodge chance +5/+10/+15.',
    effectPerRank: [
      { type: 'dodge_bonus', value: 5 },
      { type: 'dodge_bonus', value: 10 },
      { type: 'dodge_bonus', value: 15 },
    ],
  },
  {
    id: 'fighter_war_shout', name: 'War Shout', branch: 'vanguard', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'fighter_rush', minRank: 1 }],
    skillType: 'active', cooldown: 12,
    description: 'Slow all visible enemies by 15/25% for 4 turns.',
    effectPerRank: [
      { type: 'aoe_slow', speedReduction: 0.15, duration: 4 },
      { type: 'aoe_slow', speedReduction: 0.25, duration: 4 },
    ],
  },
  {
    id: 'fighter_tactical_advance', name: 'Tactical Advance', branch: 'vanguard', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'fighter_vigilance', minRank: 2 }],
    skillType: 'passive', cooldown: null,
    description: 'Moving next to an enemy grants +15/25% damage on next attack.',
    effectPerRank: [
      { type: 'tactical_advance', value: 0.15 },
      { type: 'tactical_advance', value: 0.25 },
    ],
  },
  {
    id: 'fighter_warlord', name: 'Warlord', branch: 'vanguard', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'fighter_war_shout', minRank: 1 },
      { skillId: 'fighter_tactical_advance', minRank: 1 },
    ],
    skillType: 'passive', cooldown: null,
    description: 'Companions deal +30% damage and gain +20% HP.',
    effectPerRank: [
      { type: 'companion_buff', damageBonus: 0.30, hpBonus: 0.20 },
    ],
  },
];

const ARCHER_TREE = [
  // Marksmanship branch
  {
    id: 'archer_steady_aim', name: 'Steady Aim', branch: 'marksmanship', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Ranged damage +8% per rank.',
    effectPerRank: [
      { type: 'ranged_damage_mult', value: 1.08 },
      { type: 'ranged_damage_mult', value: 1.16 },
      { type: 'ranged_damage_mult', value: 1.24 },
    ],
  },
  {
    id: 'archer_eagle_eye', name: 'Eagle Eye', branch: 'marksmanship', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Crit chance +5/+10/+15%.',
    effectPerRank: [
      { type: 'crit_bonus', value: 5 },
      { type: 'crit_bonus', value: 10 },
      { type: 'crit_bonus', value: 15 },
    ],
  },
  {
    id: 'archer_piercing_shot', name: 'Piercing Shot', branch: 'marksmanship', tier: 2,
    maxRank: 3, prerequisites: [{ skillId: 'archer_steady_aim', minRank: 1 }],
    skillType: 'passive', cooldown: null,
    description: '15/25/35% chance ranged attacks pierce to a second target.',
    effectPerRank: [
      { type: 'piercing_chance', value: 0.15 },
      { type: 'piercing_chance', value: 0.25 },
      { type: 'piercing_chance', value: 0.35 },
    ],
  },
  {
    id: 'archer_lethal_focus', name: 'Lethal Focus', branch: 'marksmanship', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'archer_eagle_eye', minRank: 2 }],
    skillType: 'passive', cooldown: null,
    description: 'Crit damage +25/+50%.',
    effectPerRank: [
      { type: 'crit_damage_bonus', value: 0.25 },
      { type: 'crit_damage_bonus', value: 0.50 },
    ],
  },
  {
    id: 'archer_deadeye', name: 'Deadeye', branch: 'marksmanship', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'archer_piercing_shot', minRank: 2 },
      { skillId: 'archer_lethal_focus', minRank: 1 },
    ],
    skillType: 'active', cooldown: 18,
    description: 'Next 3 ranged attacks auto-crit.',
    effectPerRank: [
      { type: 'auto_crit_charges', value: 3 },
    ],
  },

  // Survival branch
  {
    id: 'archer_evasion', name: 'Evasion', branch: 'survival', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Dodge chance +5/+10/+15.',
    effectPerRank: [
      { type: 'dodge_bonus', value: 5 },
      { type: 'dodge_bonus', value: 10 },
      { type: 'dodge_bonus', value: 15 },
    ],
  },
  {
    id: 'archer_quick_recovery', name: 'Quick Recovery', branch: 'survival', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Potion healing +10/+20/+30%.',
    effectPerRank: [
      { type: 'potion_healing_mult', value: 1.10 },
      { type: 'potion_healing_mult', value: 1.20 },
      { type: 'potion_healing_mult', value: 1.30 },
    ],
  },
  {
    id: 'archer_disengage', name: 'Disengage', branch: 'survival', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'archer_evasion', minRank: 1 }],
    skillType: 'active', cooldown: 6,
    description: 'Leap away from nearest enemy.',
    effectPerRank: [
      { type: 'leap', distance: 2 },
      { type: 'leap', distance: 3 },
    ],
  },
  {
    id: 'archer_vital_strike', name: 'Vital Strike', branch: 'survival', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'archer_quick_recovery', minRank: 1 }],
    skillType: 'passive', cooldown: null,
    description: 'Killing an enemy heals 3/6% of max HP.',
    effectPerRank: [
      { type: 'kill_heal', value: 0.03 },
      { type: 'kill_heal', value: 0.06 },
    ],
  },
  {
    id: 'archer_shadow_step', name: 'Shadow Step', branch: 'survival', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'archer_disengage', minRank: 2 },
      { skillId: 'archer_vital_strike', minRank: 1 },
    ],
    skillType: 'active', cooldown: 20,
    description: 'Become invisible for 3 turns. Attacking breaks invisibility but guarantees crit.',
    effectPerRank: [
      { type: 'invisibility', duration: 3, breakCrit: true },
    ],
  },

  // Trapper branch
  {
    id: 'archer_trap_mastery', name: 'Trap Mastery', branch: 'trapper', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Trap damage reduced 50/75/100%. Rank 3 disarms traps.',
    effectPerRank: [
      { type: 'trap_resistance', value: 0.50 },
      { type: 'trap_resistance', value: 0.75 },
      { type: 'trap_resistance', value: 1.00 },
    ],
  },
  {
    id: 'archer_scavenger', name: 'Scavenger', branch: 'trapper', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Enemy item drop rate +10/+20/+30%.',
    effectPerRank: [
      { type: 'drop_rate_bonus', value: 0.10 },
      { type: 'drop_rate_bonus', value: 0.20 },
      { type: 'drop_rate_bonus', value: 0.30 },
    ],
  },
  {
    id: 'archer_caltrops', name: 'Caltrops', branch: 'trapper', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'archer_trap_mastery', minRank: 1 }],
    skillType: 'active', cooldown: 10,
    description: 'Place 3x3 caltrops: 30/50% slow for 3 turns.',
    effectPerRank: [
      { type: 'caltrops', slowAmount: 0.30, duration: 3 },
      { type: 'caltrops', slowAmount: 0.50, duration: 3 },
    ],
  },
  {
    id: 'archer_salvage', name: 'Salvage', branch: 'trapper', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'archer_scavenger', minRank: 2 }],
    skillType: 'passive', cooldown: null,
    description: 'Break down gear for 1/2 material(s) each.',
    effectPerRank: [
      { type: 'salvage', materialsPerItem: 1 },
      { type: 'salvage', materialsPerItem: 2 },
    ],
  },
  {
    id: 'archer_ambush_predator', name: 'Ambush Predator', branch: 'trapper', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'archer_caltrops', minRank: 1 },
      { skillId: 'archer_salvage', minRank: 1 },
    ],
    skillType: 'passive', cooldown: null,
    description: 'First attack on an unaware enemy deals 3x damage.',
    effectPerRank: [
      { type: 'ambush_damage', value: 3.0 },
    ],
  },
];

const MAGE_TREE = [
  // Destruction branch
  {
    id: 'mage_arcane_power', name: 'Arcane Power', branch: 'destruction', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Magic damage +8% per rank.',
    effectPerRank: [
      { type: 'magic_damage_mult', value: 1.08 },
      { type: 'magic_damage_mult', value: 1.16 },
      { type: 'magic_damage_mult', value: 1.24 },
    ],
  },
  {
    id: 'mage_mana_surge', name: 'Mana Surge', branch: 'destruction', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Skill cooldowns reduced by 1/1/2 turn(s).',
    effectPerRank: [
      { type: 'cooldown_reduction', value: 1 },
      { type: 'cooldown_reduction', value: 1 },
      { type: 'cooldown_reduction', value: 2 },
    ],
  },
  {
    id: 'mage_chain_lightning', name: 'Chain Lightning', branch: 'destruction', tier: 2,
    maxRank: 3, prerequisites: [{ skillId: 'mage_arcane_power', minRank: 1 }],
    skillType: 'passive', cooldown: null,
    description: '15/25/35% chance magic attacks chain to second target (50% dmg).',
    effectPerRank: [
      { type: 'chain_chance', value: 0.15 },
      { type: 'chain_chance', value: 0.25 },
      { type: 'chain_chance', value: 0.35 },
    ],
  },
  {
    id: 'mage_overcharge', name: 'Overcharge', branch: 'destruction', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'mage_mana_surge', minRank: 2 }],
    skillType: 'passive', cooldown: null,
    description: 'Active skills deal +20/+35% damage but cost 5% HP.',
    effectPerRank: [
      { type: 'overcharge', damageBonus: 0.20, hpCost: 0.05 },
      { type: 'overcharge', damageBonus: 0.35, hpCost: 0.05 },
    ],
  },
  {
    id: 'mage_meteor', name: 'Meteor', branch: 'destruction', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'mage_chain_lightning', minRank: 2 },
      { skillId: 'mage_overcharge', minRank: 1 },
    ],
    skillType: 'active', cooldown: 25,
    description: 'Deal 15 base damage (INT scaling) to a 3x3 area.',
    effectPerRank: [
      { type: 'aoe_damage', damage: 15, radius: 1, statScaling: 'INT' },
    ],
  },

  // Warding branch
  {
    id: 'mage_arcane_barrier', name: 'Arcane Barrier', branch: 'warding', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Magic damage resistance +5/+10/+15%.',
    effectPerRank: [
      { type: 'magic_resistance', value: 0.05 },
      { type: 'magic_resistance', value: 0.10 },
      { type: 'magic_resistance', value: 0.15 },
    ],
  },
  {
    id: 'mage_enchanted_flesh', name: 'Enchanted Flesh', branch: 'warding', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Max HP +4/+8/+12%.',
    effectPerRank: [
      { type: 'max_hp_mult', value: 1.04 },
      { type: 'max_hp_mult', value: 1.08 },
      { type: 'max_hp_mult', value: 1.12 },
    ],
  },
  {
    id: 'mage_mana_shield', name: 'Mana Shield', branch: 'warding', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'mage_arcane_barrier', minRank: 2 }],
    skillType: 'passive', cooldown: null,
    description: 'Passively absorb a percentage of incoming damage.',
    effectPerRank: [
      { type: 'passive_absorb', value: 0.15 },
      { type: 'passive_absorb', value: 0.25 },
    ],
  },
  {
    id: 'mage_counterspell', name: 'Counterspell', branch: 'warding', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'mage_arcane_barrier', minRank: 1 }],
    skillType: 'passive', cooldown: null,
    description: 'Chance to negate a magic-type enemy attack entirely.',
    effectPerRank: [
      { type: 'counterspell_chance', value: 0.15 },
      { type: 'counterspell_chance', value: 0.25 },
    ],
  },
  {
    id: 'mage_temporal_stasis', name: 'Temporal Stasis', branch: 'warding', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'mage_mana_shield', minRank: 1 },
      { skillId: 'mage_counterspell', minRank: 1 },
    ],
    skillType: 'active', cooldown: 30,
    description: 'Freeze all enemies in FOV for 2 turns.',
    effectPerRank: [
      { type: 'aoe_freeze', duration: 2 },
    ],
  },

  // Mysticism branch
  {
    id: 'mage_insight', name: 'Insight', branch: 'mysticism', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'XP gained +10/+20/+30%.',
    effectPerRank: [
      { type: 'xp_bonus', value: 0.10 },
      { type: 'xp_bonus', value: 0.20 },
      { type: 'xp_bonus', value: 0.30 },
    ],
  },
  {
    id: 'mage_transmutation', name: 'Transmutation', branch: 'mysticism', tier: 1,
    maxRank: 3, prerequisites: [], skillType: 'passive',
    cooldown: null,
    description: 'Material drops +10/+20/+30%.',
    effectPerRank: [
      { type: 'material_bonus', value: 0.10 },
      { type: 'material_bonus', value: 0.20 },
      { type: 'material_bonus', value: 0.30 },
    ],
  },
  {
    id: 'mage_identify', name: 'Identify', branch: 'mysticism', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'mage_insight', minRank: 1 }],
    skillType: 'passive', cooldown: null,
    description: 'Gear drops generate at higher effective floor level.',
    effectPerRank: [
      { type: 'gear_level_bonus', value: 1 },
      { type: 'gear_level_bonus', value: 2 },
    ],
  },
  {
    id: 'mage_enchant', name: 'Enchant', branch: 'mysticism', tier: 2,
    maxRank: 2, prerequisites: [{ skillId: 'mage_transmutation', minRank: 1 }],
    skillType: 'active', cooldown: 1, // once per floor (cooldown managed by floor logic, not turns)
    description: 'Buff a piece of equipped gear for the rest of the run.',
    effectPerRank: [
      { type: 'gear_enchant', statBonus: 2 },
      { type: 'gear_enchant', statBonus: 4 },
    ],
  },
  {
    id: 'mage_archmage', name: 'Archmage', branch: 'mysticism', tier: 3,
    maxRank: 1,
    prerequisites: [
      { skillId: 'mage_identify', minRank: 1 },
      { skillId: 'mage_enchant', minRank: 1 },
    ],
    skillType: 'passive', cooldown: null,
    description: 'All active skill cooldowns reduced by 3. Skill damage +15%.',
    effectPerRank: [
      { type: 'archmage', cooldownReduction: 3, damageBonus: 0.15 },
    ],
  },
];

export const SKILL_TREES = {
  fighter: FIGHTER_TREE,
  archer: ARCHER_TREE,
  mage: MAGE_TREE,
};

export function getClassSkillTree(classKey) {
  return SKILL_TREES[classKey] || [];
}

export function getSkillNode(classKey, skillId) {
  const tree = SKILL_TREES[classKey];
  if (!tree) return undefined;
  return tree.find(n => n.id === skillId);
}

// --- Skill Point Investment ---

export function canInvestSkill(classKey, skillId, currentInvestments) {
  const node = getSkillNode(classKey, skillId);
  if (!node) return false;

  const currentRank = currentInvestments[skillId] || 0;
  if (currentRank >= node.maxRank) return false;

  for (const prereq of node.prerequisites) {
    const prereqRank = currentInvestments[prereq.skillId] || 0;
    if (prereqRank < prereq.minRank) return false;
  }

  return true;
}

export function investSkill(classKey, skillId, currentInvestments) {
  if (!canInvestSkill(classKey, skillId, currentInvestments)) return false;
  currentInvestments[skillId] = (currentInvestments[skillId] || 0) + 1;
  return true;
}

export function getTotalInvestedPoints(investments) {
  let total = 0;
  for (const rank of Object.values(investments)) {
    total += rank;
  }
  return total;
}

// --- Effect Resolution ---

export function resolvePassiveEffects(classKey, investments) {
  const effects = {
    melee_damage_mult: 1.0,
    ranged_damage_mult: 1.0,
    magic_damage_mult: 1.0,
    max_hp_mult: 1.0,
    damage_reduction: 0,
    dodge_bonus: 0,
    crit_bonus: 0,
    crit_damage_bonus: 0,
    block_chance: 0,
    retaliation_chance: 0,
    cleave_chance: 0,
    stun_on_crit: 0,
    death_save: false,
    passive_regen: 0, // interval (0 = off)
    piercing_chance: 0,
    chain_chance: 0,
    kill_heal: 0,
    trap_resistance: 0,
    drop_rate_bonus: 0,
    xp_bonus: 0,
    material_bonus: 0,
    gear_level_bonus: 0,
    cooldown_reduction: 0,
    potion_healing_mult: 1.0,
    magic_resistance: 0,
    passive_absorb: 0,
    counterspell_chance: 0,
    ambush_damage: 0,
    companion_buff: null,
    tactical_advance: 0,
    salvage: 0,
    overcharge: null,
    archmage: null,
  };

  const tree = getClassSkillTree(classKey);
  for (const node of tree) {
    const rank = investments[node.id] || 0;
    if (rank === 0) continue;

    const effect = node.effectPerRank[rank - 1];
    if (!effect) continue;

    switch (effect.type) {
      case 'melee_damage_mult':
        effects.melee_damage_mult = effect.value;
        break;
      case 'ranged_damage_mult':
        effects.ranged_damage_mult = effect.value;
        break;
      case 'magic_damage_mult':
        effects.magic_damage_mult = effect.value;
        break;
      case 'max_hp_mult':
        effects.max_hp_mult *= effect.value;
        break;
      case 'damage_reduction':
        effects.damage_reduction = effect.value;
        break;
      case 'dodge_bonus':
        effects.dodge_bonus += effect.value;
        break;
      case 'crit_bonus':
        effects.crit_bonus += effect.value;
        break;
      case 'crit_damage_bonus':
        effects.crit_damage_bonus = effect.value;
        break;
      case 'block_chance':
        effects.block_chance = effect.value;
        break;
      case 'retaliation_chance':
        effects.retaliation_chance = effect.value;
        break;
      case 'cleave_chance':
        effects.cleave_chance = effect.value;
        break;
      case 'stun_on_crit':
        effects.stun_on_crit = effect.value;
        break;
      case 'death_save':
        effects.death_save = true;
        break;
      case 'passive_regen':
        effects.passive_regen = effect.interval;
        break;
      case 'piercing_chance':
        effects.piercing_chance = effect.value;
        break;
      case 'chain_chance':
        effects.chain_chance = effect.value;
        break;
      case 'kill_heal':
        effects.kill_heal = effect.value;
        break;
      case 'trap_resistance':
        effects.trap_resistance = effect.value;
        break;
      case 'drop_rate_bonus':
        effects.drop_rate_bonus = effect.value;
        break;
      case 'xp_bonus':
        effects.xp_bonus = effect.value;
        break;
      case 'material_bonus':
        effects.material_bonus = effect.value;
        break;
      case 'gear_level_bonus':
        effects.gear_level_bonus = effect.value;
        break;
      case 'cooldown_reduction':
        effects.cooldown_reduction += effect.value;
        break;
      case 'potion_healing_mult':
        effects.potion_healing_mult = effect.value;
        break;
      case 'magic_resistance':
        effects.magic_resistance = effect.value;
        break;
      case 'passive_absorb':
        effects.passive_absorb = effect.value;
        break;
      case 'counterspell_chance':
        effects.counterspell_chance = effect.value;
        break;
      case 'ambush_damage':
        effects.ambush_damage = effect.value;
        break;
      case 'companion_buff':
        effects.companion_buff = effect;
        break;
      case 'tactical_advance':
        effects.tactical_advance = effect.value;
        break;
      case 'salvage':
        effects.salvage = effect.materialsPerItem;
        break;
      case 'overcharge':
        effects.overcharge = effect;
        break;
      case 'archmage':
        effects.archmage = effect;
        if (effect.cooldownReduction) effects.cooldown_reduction += effect.cooldownReduction;
        break;
    }
  }

  return effects;
}

// Get the list of active (non-passive) skills a player has invested in
export function getActiveTreeSkills(classKey, investments) {
  const tree = getClassSkillTree(classKey);
  const active = [];
  for (const node of tree) {
    const rank = investments[node.id] || 0;
    if (rank === 0 || node.skillType !== 'active') continue;
    active.push({
      ...node,
      currentRank: rank,
      currentEffect: node.effectPerRank[rank - 1],
      currentCooldown: 0,
      isTreeSkill: true,
    });
  }
  return active;
}

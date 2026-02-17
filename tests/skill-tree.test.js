import { describe, it, expect } from 'vitest';
import {
  SKILL_TREES,
  getSkillNode,
  getClassSkillTree,
  XP_TABLE,
  getLevelForXP,
  getSkillPointsForLevel,
  canInvestSkill,
  investSkill,
  getTotalInvestedPoints,
  resolvePassiveEffects,
  getActiveTreeSkills,
} from '../src/skill-tree.js';

describe('SKILL_TREES', () => {
  it('defines trees for all 3 classes', () => {
    expect(SKILL_TREES.fighter).toBeDefined();
    expect(SKILL_TREES.archer).toBeDefined();
    expect(SKILL_TREES.mage).toBeDefined();
  });

  it('each class has 3 branches', () => {
    for (const classKey of ['fighter', 'archer', 'mage']) {
      const tree = SKILL_TREES[classKey];
      const branches = [...new Set(tree.map(n => n.branch))];
      expect(branches.length).toBe(3);
    }
  });

  it('each class has 15-18 skill nodes', () => {
    for (const classKey of ['fighter', 'archer', 'mage']) {
      const tree = SKILL_TREES[classKey];
      expect(tree.length).toBeGreaterThanOrEqual(15);
      expect(tree.length).toBeLessThanOrEqual(18);
    }
  });

  it('all skill nodes have required fields', () => {
    for (const classKey of ['fighter', 'archer', 'mage']) {
      for (const node of SKILL_TREES[classKey]) {
        expect(node.id).toBeDefined();
        expect(node.name).toBeDefined();
        expect(node.branch).toBeDefined();
        expect(node.tier).toBeGreaterThanOrEqual(1);
        expect(node.tier).toBeLessThanOrEqual(3);
        expect(node.maxRank).toBeGreaterThanOrEqual(1);
        expect(node.maxRank).toBeLessThanOrEqual(3);
        expect(node.prerequisites).toBeDefined();
        expect(node.effectPerRank).toBeDefined();
        expect(node.effectPerRank.length).toBe(node.maxRank);
        expect(node.description).toBeDefined();
        expect(['passive', 'active']).toContain(node.skillType);
        if (node.skillType === 'active') {
          expect(node.cooldown).toBeGreaterThan(0);
        }
      }
    }
  });

  it('skill IDs are unique within each class', () => {
    for (const classKey of ['fighter', 'archer', 'mage']) {
      const ids = SKILL_TREES[classKey].map(n => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('prerequisites reference valid skill IDs within the same class', () => {
    for (const classKey of ['fighter', 'archer', 'mage']) {
      const ids = new Set(SKILL_TREES[classKey].map(n => n.id));
      for (const node of SKILL_TREES[classKey]) {
        for (const prereq of node.prerequisites) {
          expect(ids.has(prereq.skillId)).toBe(true);
        }
      }
    }
  });
});

describe('getSkillNode', () => {
  it('returns a skill node by class and ID', () => {
    const node = getSkillNode('fighter', 'fighter_heavy_strike');
    expect(node).toBeDefined();
    expect(node.name).toBe('Heavy Strike');
  });

  it('returns undefined for invalid ID', () => {
    expect(getSkillNode('fighter', 'nonexistent')).toBeUndefined();
  });
});

describe('getClassSkillTree', () => {
  it('returns all nodes for a class', () => {
    const tree = getClassSkillTree('fighter');
    expect(tree.length).toBeGreaterThanOrEqual(15);
  });

  it('returns empty array for invalid class', () => {
    expect(getClassSkillTree('invalid')).toEqual([]);
  });
});

describe('XP_TABLE', () => {
  it('has 20 entries (one per level)', () => {
    expect(XP_TABLE.length).toBe(20);
  });

  it('starts at 0 for level 1', () => {
    expect(XP_TABLE[0]).toBe(0);
  });

  it('values are monotonically increasing', () => {
    for (let i = 1; i < XP_TABLE.length; i++) {
      expect(XP_TABLE[i]).toBeGreaterThan(XP_TABLE[i - 1]);
    }
  });
});

describe('getLevelForXP', () => {
  it('returns 1 for 0 XP', () => {
    expect(getLevelForXP(0)).toBe(1);
  });

  it('returns 2 at XP threshold', () => {
    expect(getLevelForXP(100)).toBe(2);
  });

  it('returns 1 for XP just below level 2', () => {
    expect(getLevelForXP(99)).toBe(1);
  });

  it('returns 20 at max XP', () => {
    expect(getLevelForXP(18000)).toBe(20);
  });

  it('returns 20 for XP above max', () => {
    expect(getLevelForXP(999999)).toBe(20);
  });
});

describe('getSkillPointsForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(getSkillPointsForLevel(1)).toBe(0);
  });

  it('returns 1 for level 2 (1 point per level 2-15)', () => {
    expect(getSkillPointsForLevel(2)).toBe(1);
  });

  it('returns 14 total points at level 15', () => {
    expect(getSkillPointsForLevel(15)).toBe(14);
  });

  it('returns 24 total points at level 20 (2 per level 16-20)', () => {
    // Levels 2-15 = 14 points, levels 16-20 = 10 points = 24 total
    expect(getSkillPointsForLevel(20)).toBe(24);
  });
});

describe('canInvestSkill', () => {
  it('allows investing in a tier-1 skill with no prereqs', () => {
    expect(canInvestSkill('fighter', 'fighter_heavy_strike', {})).toBe(true);
  });

  it('prevents investing past max rank', () => {
    expect(canInvestSkill('fighter', 'fighter_heavy_strike', { fighter_heavy_strike: 3 })).toBe(false);
  });

  it('prevents investing when prerequisites unmet', () => {
    expect(canInvestSkill('fighter', 'fighter_cleave', {})).toBe(false);
  });

  it('allows investing when prerequisites are met', () => {
    expect(canInvestSkill('fighter', 'fighter_cleave', { fighter_heavy_strike: 1 })).toBe(true);
  });

  it('prevents investing when prereq rank is insufficient', () => {
    // Staggering Blow requires Heavy Strike rank 2
    expect(canInvestSkill('fighter', 'fighter_staggering_blow', { fighter_heavy_strike: 1 })).toBe(false);
  });

  it('returns false for invalid class/skill', () => {
    expect(canInvestSkill('invalid', 'whatever', {})).toBe(false);
    expect(canInvestSkill('fighter', 'nonexistent', {})).toBe(false);
  });
});

describe('investSkill', () => {
  it('increments rank and returns true on valid investment', () => {
    const inv = {};
    expect(investSkill('fighter', 'fighter_heavy_strike', inv)).toBe(true);
    expect(inv.fighter_heavy_strike).toBe(1);
  });

  it('returns false when investment is invalid', () => {
    const inv = { fighter_heavy_strike: 3 };
    expect(investSkill('fighter', 'fighter_heavy_strike', inv)).toBe(false);
  });

  it('supports multiple investments', () => {
    const inv = {};
    investSkill('fighter', 'fighter_heavy_strike', inv);
    investSkill('fighter', 'fighter_heavy_strike', inv);
    expect(inv.fighter_heavy_strike).toBe(2);
  });
});

describe('getTotalInvestedPoints', () => {
  it('returns 0 for empty investments', () => {
    expect(getTotalInvestedPoints({})).toBe(0);
  });

  it('sums all invested ranks', () => {
    expect(getTotalInvestedPoints({ a: 2, b: 3 })).toBe(5);
  });
});

describe('resolvePassiveEffects', () => {
  it('returns default values with no investments', () => {
    const effects = resolvePassiveEffects('fighter', {});
    expect(effects.melee_damage_mult).toBe(1.0);
    expect(effects.dodge_bonus).toBe(0);
    expect(effects.death_save).toBe(false);
  });

  it('resolves Heavy Strike rank 2 to 1.16x melee damage', () => {
    const effects = resolvePassiveEffects('fighter', { fighter_heavy_strike: 2 });
    expect(effects.melee_damage_mult).toBe(1.16);
  });

  it('resolves Conditioning rank 3 to 1.18x max HP', () => {
    const effects = resolvePassiveEffects('fighter', { fighter_conditioning: 3 });
    expect(effects.max_hp_mult).toBeCloseTo(1.18);
  });

  it('resolves multiple passives correctly', () => {
    const effects = resolvePassiveEffects('fighter', {
      fighter_heavy_strike: 1,
      fighter_iron_hide: 2,
      fighter_vigilance: 1,
    });
    expect(effects.melee_damage_mult).toBe(1.08);
    expect(effects.damage_reduction).toBe(0.06);
    expect(effects.dodge_bonus).toBe(5);
  });

  it('resolves Archer Eagle Eye crit bonus', () => {
    const effects = resolvePassiveEffects('archer', { archer_eagle_eye: 3 });
    expect(effects.crit_bonus).toBe(15);
  });

  it('resolves Mage Insight XP bonus', () => {
    const effects = resolvePassiveEffects('mage', { mage_insight: 2 });
    expect(effects.xp_bonus).toBe(0.20);
  });
});

describe('getActiveTreeSkills', () => {
  it('returns empty array with no investments', () => {
    expect(getActiveTreeSkills('fighter', {})).toEqual([]);
  });

  it('returns invested active skills', () => {
    const skills = getActiveTreeSkills('fighter', { fighter_rush: 1 });
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('Rush');
    expect(skills[0].isTreeSkill).toBe(true);
    expect(skills[0].currentCooldown).toBe(0);
  });

  it('does not return passive skills', () => {
    const skills = getActiveTreeSkills('fighter', { fighter_heavy_strike: 3 });
    expect(skills.length).toBe(0);
  });
});

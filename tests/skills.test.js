import { describe, it, expect } from 'vitest';
import { updateActiveSkills, syncClassSkillCooldown, tickCooldowns, canUseSkill, useSkill } from '../src/skills.js';
import { createTreeActiveSkills } from '../src/skill-tree.js';
import { Entity } from '../src/entity.js';

function makePlayer(playerClass = 'fighter') {
  const classStats = {
    fighter: { stats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 }, affinity: ['STR', 'CON'] },
    archer: { stats: { STR: 4, DEX: 8, CON: 5, INT: 3, WIS: 4, LCK: 6 }, affinity: ['DEX', 'LCK'] },
    mage: { stats: { STR: 3, DEX: 4, CON: 4, INT: 8, WIS: 7, LCK: 4 }, affinity: ['INT', 'WIS'] },
  };
  const cfg = classStats[playerClass];
  const p = new Entity({
    id: 'player', type: 'player', x: 5, y: 5,
    stats: cfg.stats,
    maxHp: 15, speed: 100,
  });
  p.playerClass = playerClass;
  p.affinityStats = cfg.affinity;
  p.activeSkills = [];
  return p;
}

function makeWeapon(attackType, skill = null) {
  return {
    id: `item_${attackType}`,
    name: `Test ${attackType} Weapon`,
    type: 'weapon',
    rarity: 'common',
    slot: 'leftHand',
    attackType,
    statBonuses: {},
    skill,
    floorLevel: 1,
  };
}

function makeSkillItem(skillName, cooldown) {
  return {
    id: 'item_skill_test',
    name: 'Test Weapon',
    type: 'weapon',
    rarity: 'rare',
    slot: 'leftHand',
    statBonuses: { STR: 3 },
    skill: {
      name: skillName,
      description: 'Test skill',
      cooldown,
      currentCooldown: 0,
      range: 1,
      area: { type: 'single', size: 1 },
      damage: 5,
      statScaling: 'STR',
    },
    floorLevel: 1,
  };
}

describe('updateActiveSkills', () => {
  it('adds skills from equipped gear', () => {
    const p = makePlayer();
    const item = makeSkillItem('Cleave', 4);
    p.equipment.leftHand = item;
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(4);
    expect(p.activeSkills[0].name).toBe('Cleave');
    expect(p.activeSkills[1]).toBeNull();
    expect(p.activeSkills[2]).toBeNull();
    expect(p.activeSkills[3]).toBeNull();
  });

  it('removes skills when gear is unequipped', () => {
    const p = makePlayer();
    const item = makeSkillItem('Cleave', 4);
    p.equipment.leftHand = item;
    updateActiveSkills(p);
    expect(p.activeSkills[0].name).toBe('Cleave');
    p.equipment.leftHand = null;
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(4);
    expect(p.activeSkills.every(s => s === null)).toBe(true);
  });

  it('collects skills from multiple equipped items', () => {
    const p = makePlayer();
    p.equipment.leftHand = makeSkillItem('Cleave', 4);
    p.equipment.rightHand = { ...makeSkillItem('Shield Bash', 5), slot: 'rightHand', id: 'item_2' };
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(4);
    expect(p.activeSkills.filter(s => s !== null)).toHaveLength(2);
  });

  it('ignores equipment without skills', () => {
    const p = makePlayer();
    p.equipment.head = { id: 'helm', slot: 'head', statBonuses: { CON: 2 }, skill: null };
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(4);
    expect(p.activeSkills.every(s => s === null)).toBe(true);
  });
});

describe('tickCooldowns', () => {
  it('reduces cooldowns by 1 each turn', () => {
    const p = makePlayer();
    p.activeSkills = [{ name: 'Cleave', cooldown: 4, currentCooldown: 3 }];
    tickCooldowns(p);
    expect(p.activeSkills[0].currentCooldown).toBe(2);
  });

  it('does not go below 0', () => {
    const p = makePlayer();
    p.activeSkills = [{ name: 'Cleave', cooldown: 4, currentCooldown: 0 }];
    tickCooldowns(p);
    expect(p.activeSkills[0].currentCooldown).toBe(0);
  });

  it('can skip the used skill so it does not tick immediately', () => {
    const p = makePlayer();
    const used = { name: 'Cleave', cooldown: 4, currentCooldown: 4 };
    const other = { name: 'Shield Bash', cooldown: 5, currentCooldown: 2 };
    p.activeSkills = [used, other];
    tickCooldowns(p, used);
    expect(used.currentCooldown).toBe(4);
    expect(other.currentCooldown).toBe(1);
  });
});

describe('canUseSkill', () => {
  it('returns true when off cooldown', () => {
    const skill = { name: 'Cleave', cooldown: 4, currentCooldown: 0 };
    expect(canUseSkill(skill)).toBe(true);
  });

  it('returns false when on cooldown', () => {
    const skill = { name: 'Cleave', cooldown: 4, currentCooldown: 2 };
    expect(canUseSkill(skill)).toBe(false);
  });
});

describe('useSkill', () => {
  it('sets currentCooldown to cooldown value', () => {
    const skill = { name: 'Cleave', cooldown: 4, currentCooldown: 0, damage: 5, statScaling: 'STR', range: 1 };
    const result = useSkill(skill);
    expect(result).toBe(true);
    expect(skill.currentCooldown).toBe(4);
  });

  it('fails if on cooldown', () => {
    const skill = { name: 'Cleave', cooldown: 4, currentCooldown: 2, damage: 5 };
    const result = useSkill(skill);
    expect(result).toBe(false);
    expect(skill.currentCooldown).toBe(2); // unchanged
  });
});

describe('class skills', () => {
  it('archer gets Quick Shot in slot 0 when ranged weapon equipped', () => {
    const p = makePlayer('archer');
    p.equipment.leftHand = makeWeapon('ranged');
    updateActiveSkills(p);
    expect(p.activeSkills[0]).not.toBeNull();
    expect(p.activeSkills[0].name).toBe('Quick Shot');
    expect(p.activeSkills[0].isClassSkill).toBe(true);
  });

  it('mage gets Arc Bolt in slot 0 when magic weapon equipped', () => {
    const p = makePlayer('mage');
    p.equipment.leftHand = makeWeapon('magic');
    updateActiveSkills(p);
    expect(p.activeSkills[0]).not.toBeNull();
    expect(p.activeSkills[0].name).toBe('Arc Bolt');
    expect(p.activeSkills[0].isClassSkill).toBe(true);
  });

  it('fighter gets no class skill', () => {
    const p = makePlayer('fighter');
    p.equipment.leftHand = makeWeapon('melee');
    updateActiveSkills(p);
    expect(p.activeSkills.every(s => s === null)).toBe(true);
  });

  it('class skill disappears when no qualifying weapon equipped', () => {
    const p = makePlayer('archer');
    p.equipment.leftHand = makeWeapon('ranged');
    updateActiveSkills(p);
    expect(p.activeSkills[0].name).toBe('Quick Shot');

    p.equipment.leftHand = makeWeapon('melee');
    updateActiveSkills(p);
    expect(p.activeSkills[0]).toBeNull();
  });

  it('item skills fill slots 1-2 when class skill occupies slot 0', () => {
    const p = makePlayer('archer');
    const itemSkill = {
      name: 'Power Shot', description: 'Test', cooldown: 4,
      currentCooldown: 0, range: 6, area: { type: 'line', size: 6 },
      damage: 5, statScaling: 'DEX',
    };
    p.equipment.leftHand = makeWeapon('ranged', itemSkill);
    updateActiveSkills(p);
    expect(p.activeSkills[0].name).toBe('Quick Shot');
    expect(p.activeSkills[0].isClassSkill).toBe(true);
    expect(p.activeSkills[1].name).toBe('Power Shot');
    expect(p.activeSkills[2]).toBeNull();
  });

  it('class skill cooldown persists via entity.classSkillCooldown', () => {
    const p = makePlayer('mage');
    p.equipment.leftHand = makeWeapon('magic');
    p.classSkillCooldown = 3;
    updateActiveSkills(p);
    expect(p.activeSkills[0].currentCooldown).toBe(3);
  });

  it('syncClassSkillCooldown writes cooldown back to entity', () => {
    const p = makePlayer('archer');
    p.equipment.leftHand = makeWeapon('ranged');
    updateActiveSkills(p);
    p.activeSkills[0].currentCooldown = 5;
    syncClassSkillCooldown(p);
    expect(p.classSkillCooldown).toBe(5);
  });
});

describe('skill tree actives in the hotbar', () => {
  it('fills empty slots after the class skill and gear skills', () => {
    const p = makePlayer('archer');
    p.equipment.leftHand = makeWeapon('ranged');
    p.treeActiveSkills = createTreeActiveSkills('archer', { archer_disengage: 1, archer_deadeye: 1 });
    updateActiveSkills(p);
    expect(p.activeSkills[0].name).toBe('Quick Shot');
    // tree actives follow tree order: marksmanship before survival
    expect(p.activeSkills[1].name).toBe('Deadeye');
    expect(p.activeSkills[1].skillType).toBe('tree');
    expect(p.activeSkills[2].name).toBe('Disengage');
    expect(p.activeSkills[3]).toBeNull();
  });

  it('keeps tree skill cooldowns across rebuilds and ticks them', () => {
    const p = makePlayer('fighter');
    p.treeActiveSkills = createTreeActiveSkills('fighter', { fighter_rush: 2 });
    updateActiveSkills(p);
    const rush = p.activeSkills[0];
    expect(rush.treeEffect.distance).toBe(3);
    useSkill(rush);
    expect(rush.currentCooldown).toBe(8);
    p.equipment.head = { id: 'h', slot: 'head', statBonuses: {}, skill: null };
    updateActiveSkills(p);
    expect(p.activeSkills[0]).toBe(rush);
    tickCooldowns(p);
    expect(rush.currentCooldown).toBe(7);
  });

  it('restores saved cooldowns and applies cooldown reduction', () => {
    const skills = createTreeActiveSkills('mage', { mage_meteor: 1 }, { mage_meteor: 5 });
    expect(skills[0].currentCooldown).toBe(5);
    skills[0].currentCooldown = 0;
    useSkill(skills[0], 4);
    expect(skills[0].currentCooldown).toBe(21);
  });
});

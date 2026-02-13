import { describe, it, expect } from 'vitest';
import { updateActiveSkills, tickCooldowns, canUseSkill, useSkill } from '../src/skills.js';
import { Entity } from '../src/entity.js';

function makePlayer() {
  const p = new Entity({
    id: 'player', type: 'player', x: 5, y: 5,
    stats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 },
    maxHp: 15, speed: 100,
  });
  p.playerClass = 'fighter';
  p.affinityStats = ['STR', 'CON'];
  p.activeSkills = [];
  return p;
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
    expect(p.activeSkills).toHaveLength(1);
    expect(p.activeSkills[0].name).toBe('Cleave');
  });

  it('removes skills when gear is unequipped', () => {
    const p = makePlayer();
    const item = makeSkillItem('Cleave', 4);
    p.equipment.leftHand = item;
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(1);
    p.equipment.leftHand = null;
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(0);
  });

  it('collects skills from multiple equipped items', () => {
    const p = makePlayer();
    p.equipment.leftHand = makeSkillItem('Cleave', 4);
    p.equipment.rightHand = { ...makeSkillItem('Shield Bash', 5), slot: 'rightHand', id: 'item_2' };
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(2);
  });

  it('ignores equipment without skills', () => {
    const p = makePlayer();
    p.equipment.head = { id: 'helm', slot: 'head', statBonuses: { CON: 2 }, skill: null };
    updateActiveSkills(p);
    expect(p.activeSkills).toHaveLength(0);
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

// src/skills.js
import { CLASS_SKILLS, SKILL_SLOT_COUNT } from './constants.js';

export const SKILL_SLOT_KEYS = ['Q', 'E', 'R', 'F'];

function emptySlots() {
  return new Array(SKILL_SLOT_COUNT).fill(null);
}

// rebuilds entity.activeSkills from three sources, in priority order:
//   slot 0: the class skill, when a qualifying weapon is equipped
//   bound gear skills (entity.skillSlotBindings), then unbound gear skills
//   skill tree actives (entity.treeActiveSkills) fill whatever is left
// tree skill objects are persistent so their cooldowns survive rebuilds.
export function updateActiveSkills(entity) {
  const bindings = entity.skillSlotBindings || emptySlots();
  while (bindings.length < SKILL_SLOT_COUNT) bindings.push(null);
  const newActive = emptySlots();
  const boundSlots = new Set();

  // Check for class skill — reserve slot 0 if a qualifying weapon is equipped
  const classSkillDef = CLASS_SKILLS[entity.playerClass];
  let hasClassSkill = false;
  if (classSkillDef) {
    for (const item of Object.values(entity.equipment)) {
      if (item && item.attackType === classSkillDef.requiredAttackType) {
        hasClassSkill = true;
        break;
      }
    }
  }

  if (hasClassSkill) {
    newActive[0] = {
      name: classSkillDef.name,
      description: classSkillDef.description,
      cooldown: classSkillDef.cooldown,
      currentCooldown: entity.classSkillCooldown || 0,
      range: classSkillDef.range,
      area: { ...classSkillDef.area },
      damage: classSkillDef.damage,
      statScaling: classSkillDef.statScaling,
      isClassSkill: true,
    };
    // Clear slot 0 binding since it's reserved for class skill
    bindings[0] = null;
  }

  // First pass: honor existing bindings if the skill still exists
  const startSlot = hasClassSkill ? 1 : 0;
  for (let i = startSlot; i < SKILL_SLOT_COUNT; i++) {
    const eqSlot = bindings[i];
    if (eqSlot) {
      const item = entity.equipment[eqSlot];
      if (item && item.skill) {
        newActive[i] = item.skill;
        boundSlots.add(eqSlot);
      } else {
        bindings[i] = null;
      }
    }
  }

  // Second pass: auto-assign unbound skills to empty slots
  for (const eqSlot of Object.keys(entity.equipment)) {
    if (boundSlots.has(eqSlot)) continue;
    const item = entity.equipment[eqSlot];
    if (!item || !item.skill) continue;
    const emptyIdx = newActive.findIndex((s, idx) => s === null && idx >= startSlot);
    if (emptyIdx === -1) break;
    newActive[emptyIdx] = item.skill;
    bindings[emptyIdx] = eqSlot;
    boundSlots.add(eqSlot);
  }

  // Third pass: skill tree actives take the remaining slots
  for (const treeSkill of entity.treeActiveSkills || []) {
    const emptyIdx = newActive.findIndex((s, idx) => s === null && idx >= startSlot);
    if (emptyIdx === -1) break;
    newActive[emptyIdx] = treeSkill;
  }

  entity.activeSkills = newActive;
  entity.skillSlotBindings = bindings;
}

export function syncClassSkillCooldown(entity) {
  const skill = entity.activeSkills[0];
  if (skill && skill.isClassSkill) {
    entity.classSkillCooldown = skill.currentCooldown;
  }
}

export function assignSkillToSlot(entity, equipmentSlotKey, skillSlotIndex) {
  if (skillSlotIndex < 0 || skillSlotIndex >= SKILL_SLOT_COUNT) return false;
  // Don't allow overwriting the class skill slot
  if (entity.activeSkills[0]?.isClassSkill && skillSlotIndex === 0) return false;
  const item = entity.equipment[equipmentSlotKey];
  if (!item || !item.skill) return false;

  const bindings = entity.skillSlotBindings || emptySlots();
  while (bindings.length < SKILL_SLOT_COUNT) bindings.push(null);

  // Clear any existing binding for this equipment slot
  for (let i = 0; i < SKILL_SLOT_COUNT; i++) {
    if (bindings[i] === equipmentSlotKey) {
      bindings[i] = null;
    }
  }

  bindings[skillSlotIndex] = equipmentSlotKey;
  entity.skillSlotBindings = bindings;
  updateActiveSkills(entity);
  return true;
}

export function tickCooldowns(entity, excludeSkill = null) {
  // tree skills tick even when they did not fit into a slot
  const all = new Set([...(entity.activeSkills || []), ...(entity.treeActiveSkills || [])]);
  for (const skill of all) {
    if (!skill) continue;
    if (skill === excludeSkill) continue;
    if (skill.currentCooldown > 0) {
      skill.currentCooldown--;
    }
  }
  syncClassSkillCooldown(entity);
}

export function canUseSkill(skill) {
  return skill.currentCooldown === 0;
}

// cooldownReduction comes from tree passives (Mana Surge, Archmage)
export function useSkill(skill, cooldownReduction = 0) {
  if (skill.currentCooldown > 0) return false;
  const reduced = Math.max(0, skill.cooldown - cooldownReduction);
  // a skill with a real cooldown always waits at least one turn
  skill.currentCooldown = skill.cooldown > 0 ? Math.max(1, reduced) : 0;
  return true;
}

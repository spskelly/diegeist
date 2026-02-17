// src/skills.js
import { CLASS_SKILLS } from './constants.js';

export function updateActiveSkills(entity) {
  const bindings = entity.skillSlotBindings || [null, null, null];
  const newActive = [null, null, null];
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
  for (let i = startSlot; i < 3; i++) {
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
  if (skillSlotIndex < 0 || skillSlotIndex > 2) return false;
  // Don't allow overwriting the class skill slot
  if (entity.activeSkills[0]?.isClassSkill && skillSlotIndex === 0) return false;
  const item = entity.equipment[equipmentSlotKey];
  if (!item || !item.skill) return false;

  const bindings = entity.skillSlotBindings || [null, null, null];

  // Clear any existing binding for this equipment slot
  for (let i = 0; i < 3; i++) {
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
  for (const skill of entity.activeSkills) {
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

export function useSkill(skill) {
  if (skill.currentCooldown > 0) return false;
  skill.currentCooldown = skill.cooldown;
  return true;
}

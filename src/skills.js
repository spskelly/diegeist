// src/skills.js

export function updateActiveSkills(entity) {
  const bindings = entity.skillSlotBindings || [null, null, null];
  const newActive = [null, null, null];
  const boundSlots = new Set();

  // First pass: honor existing bindings if the skill still exists
  for (let i = 0; i < 3; i++) {
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
    const emptyIdx = newActive.findIndex(s => s === null);
    if (emptyIdx === -1) break;
    newActive[emptyIdx] = item.skill;
    bindings[emptyIdx] = eqSlot;
    boundSlots.add(eqSlot);
  }

  entity.activeSkills = newActive;
  entity.skillSlotBindings = bindings;
}

export function assignSkillToSlot(entity, equipmentSlotKey, skillSlotIndex) {
  if (skillSlotIndex < 0 || skillSlotIndex > 2) return false;
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
}

export function canUseSkill(skill) {
  return skill.currentCooldown === 0;
}

export function useSkill(skill) {
  if (skill.currentCooldown > 0) return false;
  skill.currentCooldown = skill.cooldown;
  return true;
}

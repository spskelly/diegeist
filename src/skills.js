// src/skills.js

export function updateActiveSkills(entity) {
  entity.activeSkills = [];
  for (const slot of Object.keys(entity.equipment)) {
    const item = entity.equipment[slot];
    if (item && item.skill) {
      entity.activeSkills.push(item.skill);
    }
  }
}

export function tickCooldowns(entity, excludeSkill = null) {
  for (const skill of entity.activeSkills) {
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

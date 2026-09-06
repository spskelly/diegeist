import { PLAYER_CLASSES, REGEN_FRACTION } from './constants.js';
import { getEquippedStats } from './inventory.js';
import { computePlayerMaxHp, getLevelStatBonuses } from './player.js';
import { ACHIEVEMENTS, persistSaveData } from './progression.js';
import { SKILL_TREES, getLevelForXP, getSkillPointsForLevel, resolvePassiveEffects } from './skill-tree.js';
import { applyBlessingToEffects, getLibraryXpBonus } from './town-buildings.js';
import { BASE_SPEED } from './constants.js';

// Pure utility functions

export function isDirectionalAction(action) {
  return action.type === 'move' || action.type === 'attack';
}

export function getRarityDamageBonus(rarity) {
  const table = {
    common: 0,
    uncommon: 0.06,
    rare: 0.14,
    epic: 0.24,
    legendary: 0.38,
  };
  return table[rarity] || 0;
}

export function getRarityColor(rarity, fallback = '#c3cbd4') {
  const colors = {
    common: '#c3cbd4',
    uncommon: '#79d27e',
    rare: '#6fb4ff',
    epic: '#ff8f5b',
    legendary: '#ffd36a',
  };
  return colors[rarity] || fallback;
}

export function cloneItem(item) {
  if (!item) return null;
  return {
    ...item,
    statBonuses: { ...(item.statBonuses || {}) },
    skill: item.skill
      ? {
        ...item.skill,
        area: item.skill.area ? { ...item.skill.area } : null,
      }
      : null,
  };
}

export function formatSlotName(slot) {
  if (slot === 'leftHand') return 'Left Hand';
  if (slot === 'rightHand') return 'Right Hand';
  if (slot === 'accessory1') return 'Accessory 1';
  if (slot === 'accessory2') return 'Accessory 2';
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function getClassLabel(classKey) {
  return PLAYER_CLASSES[classKey]?.name || classKey;
}

export function getInventoryCapacity() {
  return 12;
}

export function getInventoryGridColumns() {
  return 4;
}

export function truncateLabel(text, maxChars = 12) {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}.`;
}

export function wrapTextLines(text, maxChars) {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }
    if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function getHubMenuOptions() {
  return ['Start Run', 'Shop', 'Skill Tree', 'Stash', 'Achievements', 'Back to Class Select'];
}

export function clampScrollOffset(cursor, scrollOffset, maxVisible) {
  if (cursor < scrollOffset) return cursor;
  if (cursor >= scrollOffset + maxVisible) return cursor - maxVisible + 1;
  return scrollOffset;
}

export function getScrollView(cursor, scrollOffset, totalItems, maxVisible) {
  const clamped = clampScrollOffset(cursor, scrollOffset, maxVisible);
  return {
    scrollOffset: clamped,
    startIdx: clamped,
    endIdx: Math.min(totalItems, clamped + maxVisible),
    showUpArrow: clamped > 0,
    showDownArrow: clamped + maxVisible < totalItems,
  };
}

export function drawScrollIndicators(ctx, x, topY, bottomY, showUp, showDown, uiScale) {
  ctx.fillStyle = '#7d8e9f';
  ctx.font = `${Math.round(10 * uiScale)}px monospace`;
  if (showUp) ctx.fillText('\u25B2 more', x, topY);
  if (showDown) ctx.fillText('\u25BC more', x, bottomY);
}

export function getItemSellValue(item) {
  const prices = { common: 5, uncommon: 15, rare: 40, epic: 100, legendary: 250 };
  return prices[item?.rarity] || 5;
}

// Functions that need entity or game parameter

export function getEntityStatsWithEquipment(entity) {
  const stats = { ...entity.stats };
  const bonuses = getEquippedStats(entity);
  for (const [stat, value] of Object.entries(bonuses)) {
    stats[stat] = (stats[stat] || 0) + value;
  }
  return stats;
}

export function getPlayerWeaponMultiplier(player, damageType) {
  if (!player) return 1.0;
  const statByType = {
    melee: 'STR',
    ranged: 'DEX',
    magic: 'INT',
  };
  const relevantStat = statByType[damageType] || 'STR';
  const weapons = [player.equipment.leftHand, player.equipment.rightHand]
    .filter(item => item && item.type === 'weapon');
  if (weapons.length === 0) return 1.0;

  const bestWeapon = weapons.reduce((best, current) => {
    if (!best) return current;
    const bestScore = (best.statBonuses?.[relevantStat] || 0) + getRarityDamageBonus(best.rarity);
    const currentScore = (current.statBonuses?.[relevantStat] || 0) + getRarityDamageBonus(current.rarity);
    return currentScore > bestScore ? current : best;
  }, null);

  const statBonus = bestWeapon?.statBonuses?.[relevantStat] || 0;
  const rarityBonus = getRarityDamageBonus(bestWeapon?.rarity);
  return 1 + statBonus * 0.03 + rarityBonus;
}

export function getPlayerAttackType(player) {
  const weapon = player?.equipment?.leftHand;
  if (weapon && weapon.type === 'weapon' && weapon.attackType) {
    return weapon.attackType;
  }
  return 'melee';
}

export function getEquipmentRows(player) {
  const slotOrder = ['head', 'torso', 'legs', 'leftHand', 'rightHand', 'accessory1', 'accessory2'];
  return slotOrder.map(slot => ({
    slot,
    item: player.equipment[slot],
  }));
}

export function getNaturalRegenInterval(player) {
  const stats = getEntityStatsWithEquipment(player);
  const regenFactor = Math.floor(((stats.CON || 0) + (stats.WIS || 0)) / 4);
  return Math.max(6, 16 - regenFactor);
}

// regeneration heals a fraction of max hp so it keeps pace with hp growth
export function getRegenAmount(player, fraction = REGEN_FRACTION) {
  return Math.max(1, Math.round((player?.maxHp || 0) * fraction));
}

export function getPlayerLevel(game) {
  const classKey = game.player?.playerClass;
  return (classKey && game.saveData?.classLevels?.[classKey]) || game.player?.level || 1;
}

// tree passives plus whatever the town granted for this run (shrine blessing,
// library xp bonus). every place that used to call resolvePassiveEffects for
// the player goes through here so the town bonuses are never dropped.
export function rebuildPassiveEffects(game) {
  const classKey = game.player?.playerClass || game.selectedClass;
  const investments = game.saveData?.skillInvestments?.[classKey] || {};
  const effects = resolvePassiveEffects(classKey, investments);
  applyBlessingToEffects(effects, game.runBlessing || null);
  effects.xp_bonus = (effects.xp_bonus || 0) + getLibraryXpBonus(game.saveData);
  game.treePassiveEffects = effects;
  if (game.player) game.player.speed = BASE_SPEED + (effects.speed_bonus || 0);
  return effects;
}

// recompute max hp from class, level, con (with gear) and tree passives.
// gaining max hp heals the difference; losing it just clamps current hp.
export function recalcPlayerMaxHp(game) {
  const player = game.player;
  if (!player || !player.playerClass) return;
  const level = getPlayerLevel(game);
  const stats = getEntityStatsWithEquipment(player);
  const newMax = computePlayerMaxHp(player.playerClass, stats, level, game.treePassiveEffects);
  const delta = newMax - player.maxHp;
  player.maxHp = newMax;
  player.level = level;
  if (delta > 0) player.hp = Math.min(newMax, player.hp + delta);
  else player.hp = Math.min(player.hp, newMax);
}

// called when a character level changes mid-run: grant affinity stat points and hp
export function applyLevelUpGrowth(game, oldLevel, newLevel) {
  const player = game.player;
  if (!player || !player.playerClass) return;
  const before = getLevelStatBonuses(player.playerClass, oldLevel);
  const after = getLevelStatBonuses(player.playerClass, newLevel);
  for (const stat of Object.keys(after)) {
    const gained = (after[stat] || 0) - (before[stat] || 0);
    if (gained > 0) player.stats[stat] = (player.stats[stat] || 0) + gained;
  }
  recalcPlayerMaxHp(game);
}

export function getSelectedAchievement(game) {
  if (ACHIEVEMENTS.length === 0) return null;
  const idx = Math.max(0, Math.min(game.hubAchievementsCursor, ACHIEVEMENTS.length - 1));
  return ACHIEVEMENTS[idx];
}

export function getSkillTreeNodes(game) {
  const classKey = game.player?.playerClass || game.selectedClass;
  if (!classKey) return [];
  const tree = SKILL_TREES[classKey] || [];
  const branches = [...new Set(tree.map(n => n.branch))];
  const sorted = [];
  for (const branch of branches) {
    const branchNodes = tree.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
    sorted.push(...branchNodes);
  }
  return sorted;
}

export function getStashPaneItems(game) {
  if (game.hubStashPane === 'stash') return game.saveData.stash || [];
  return game.hubRunCarryover || [];
}

export function persistLastClassSelection(game) {
  if (!game.saveData) return;
  if (!game.saveData.settings) game.saveData.settings = { volume: 0.7 };
  game.saveData.settings.lastClass = game.selectedClass;
  persistSaveData(game.saveData);
}

// VFX functions (operate on game.combatVfx)

function getNowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function clearCombatVfx(game) {
  game.combatVfx.floatingTexts.length = 0;
  game.combatVfx.projectiles.length = 0;
  if (game.combatVfx.swings) game.combatVfx.swings.length = 0;
}

export function addFloatingText(game, tileX, tileY, text, color = '#ffffff', durationMs = 900) {
  // texts that land on the same tile while earlier ones are still alive are
  // stacked upward instead of drawn on top of each other
  const now = getNowMs();
  const stackIndex = game.combatVfx.floatingTexts.filter(v =>
    v.tileX === tileX && v.tileY === tileY && now - v.startMs < v.durationMs
  ).length;
  game.combatVfx.floatingTexts.push({
    tileX,
    tileY,
    text,
    color,
    startMs: now,
    durationMs,
    stackIndex,
  });
}

export function addProjectile(game, fromX, fromY, toX, toY, spriteKey, durationMs = 180) {
  game.combatVfx.projectiles.push({
    fromX,
    fromY,
    toX,
    toY,
    spriteKey,
    startMs: getNowMs(),
    durationMs,
  });
}

export function addHitFeedback(game, defender, result, source = 'player') {
  if (result.dodged) {
    addFloatingText(game, defender.position.x, defender.position.y, 'DODGE', '#8fd9ff', 760);
    return;
  }
  const critSuffix = result.crit ? '!' : '';
  const color = source === 'enemy'
    ? '#ff7f7f'
    : result.crit
      ? '#ffd86b'
      : '#ffc18a';
  addFloatingText(game, defender.position.x, defender.position.y, `${result.damage}${critSuffix}`, color, 700);
  // the renderer flashes the defender's sprite while this window is open
  defender.vfxHit = { startMs: getNowMs(), durationMs: result.crit ? 200 : 140 };
}

export function addProjectileForDamageType(game, fromEntity, toEntity, damageType) {
  if (!fromEntity || !toEntity) return;
  if (damageType === 'ranged') {
    addProjectile(game,
      fromEntity.position.x,
      fromEntity.position.y,
      toEntity.position.x,
      toEntity.position.y,
      'arrow_projectile',
      170
    );
  } else if (damageType === 'magic') {
    addProjectile(game,
      fromEntity.position.x,
      fromEntity.position.y,
      toEntity.position.x,
      toEntity.position.y,
      'arcbolt_projectile',
      210
    );
  }
}

export function updateCombatVfx(game, nowMs) {
  game.combatVfx.floatingTexts = game.combatVfx.floatingTexts.filter(vfx => nowMs - vfx.startMs < vfx.durationMs);
  game.combatVfx.projectiles = game.combatVfx.projectiles.filter(vfx => nowMs - vfx.startMs < vfx.durationMs);
  if (game.combatVfx.swings) {
    game.combatVfx.swings = game.combatVfx.swings.filter(vfx => nowMs - vfx.startMs < vfx.durationMs);
  }
}

// Weapon swing animations. a swing is a short-lived overlay of the attacker's
// weapon sprite pivoting at the attacker's hand toward the target, plus a
// lunge on the attacker itself (see getEntityVfxOffset in renderer.js).

// ordered so that more specific names win: 'Crossbow' before 'Bow', etc.
export const WEAPON_SPRITE_BY_NAME = [
  ['Greataxe', 'weapon_greataxe'],
  ['Axe', 'weapon_greataxe'],
  ['Sword', 'weapon_sword'],
  ['Dagger', 'weapon_dagger'],
  ['Crossbow', 'weapon_crossbow'],
  ['Bow', 'weapon_longbow'],
  ['Staff', 'weapon_staff'],
  ['Wand', 'weapon_wand'],
  ['Shield', 'weapon_shield'],
  ['Orb', 'weapon_orb'],
];

export const SWING_STYLE_BY_SPRITE = {
  weapon_sword: 'slash',
  weapon_greataxe: 'chop',
  weapon_dagger: 'thrust',
  weapon_longbow: 'shoot',
  weapon_crossbow: 'shoot',
  weapon_staff: 'cast',
  weapon_wand: 'cast',
  weapon_shield: 'bash',
  weapon_orb: 'cast',
  weapon_fist: 'thrust',
  weapon_claw: 'slash',
};

// glow colour drawn at the tip of casting implements
export const CAST_GLOW_BY_SPRITE = {
  weapon_staff: '#b070ff',
  weapon_wand: '#40d0ff',
  weapon_orb: '#e0f0ff',
};

export function getWeaponSpriteKey(attacker, damageType = 'melee') {
  const weapon = attacker?.equipment?.leftHand;
  if (weapon && typeof weapon.name === 'string') {
    for (const [needle, key] of WEAPON_SPRITE_BY_NAME) {
      if (weapon.name.includes(needle)) return key;
    }
  }
  if (damageType === 'ranged') return 'weapon_longbow';
  if (damageType === 'magic') return 'weapon_wand';
  // unarmed player punches, everything else claws
  return attacker?.type === 'player' ? 'weapon_fist' : 'weapon_claw';
}

export function addWeaponSwing(game, attacker, target, damageType = 'melee', durationMs = null) {
  if (!game?.combatVfx || !attacker?.position || !target?.position) return null;
  if (!game.combatVfx.swings) game.combatVfx.swings = [];
  const now = getNowMs();
  // several hits resolved in one turn (cleave, chain lightning) share one swing
  const last = game.combatVfx.swings[game.combatVfx.swings.length - 1];
  if (last && last.x === attacker.position.x && last.y === attacker.position.y && now - last.startMs < 30) {
    return last;
  }
  const rawX = target.position.x - attacker.position.x;
  const rawY = target.position.y - attacker.position.y;
  const len = Math.hypot(rawX, rawY) || 1;
  const dirX = rawX / len;
  const dirY = rawY / len;
  const spriteKey = getWeaponSpriteKey(attacker, damageType);
  const style = SWING_STYLE_BY_SPRITE[spriteKey] || 'slash';
  const isReach = style === 'shoot' || style === 'cast';
  const dur = durationMs ?? (isReach ? 220 : 260);
  const swing = {
    x: attacker.position.x,
    y: attacker.position.y,
    dirX,
    dirY,
    spriteKey,
    style,
    startMs: now,
    durationMs: dur,
    source: attacker.type === 'player' ? 'player' : 'enemy',
  };
  game.combatVfx.swings.push(swing);
  // melee attackers lunge toward the target, shooters and casters recoil a touch
  attacker.vfxLunge = { dx: dirX, dy: dirY, amount: isReach ? -0.08 : 0.28, startMs: now, durationMs: dur };
  return swing;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// pose of a swing at progress t in [0, 1]: where the hand pivot sits along
// the attack direction (in tiles), how far the weapon is rotated off that
// direction (radians), sprite scale, alpha, and glow strength for casters
export function getSwingPose(style, t) {
  const p = Math.max(0, Math.min(1, t));
  const arc = Math.sin(Math.PI * p);
  const alpha = p < 0.65 ? 1 : Math.max(0, (1 - p) / 0.35);
  switch (style) {
    case 'chop':
      return { offset: 0.2 + 0.15 * arc, angle: -1.7 + 2.2 * easeOutCubic(p), scale: 1.15, alpha, glow: 0 };
    case 'thrust':
      return { offset: 0.1 + 0.5 * arc, angle: 0, scale: 0.95, alpha, glow: 0 };
    case 'bash':
      return { offset: 0.1 + 0.4 * arc, angle: 0, scale: 1.05, alpha, glow: 0 };
    case 'shoot':
      return { offset: 0.3 - 0.1 * arc, angle: 0, scale: 1, alpha, glow: 0 };
    case 'cast':
      return { offset: 0.3, angle: 0, scale: 1, alpha, glow: arc };
    case 'slash':
    default:
      return { offset: 0.15 + 0.1 * arc, angle: -1.2 + 2.4 * easeOutCubic(p), scale: 1, alpha, glow: 0 };
  }
}

// Achievement & XP functions

export function ensureAchievementRecord(game, achievementId) {
  if (!game.saveData.achievements[achievementId]) {
    game.saveData.achievements[achievementId] = { progress: 0, unlocked: false };
  }
  return game.saveData.achievements[achievementId];
}

export function applyAchievementBonus(game, achievement) {
  if (!achievement || !achievement.bonus || !game.saveData) return;
  const bonus = achievement.bonus;
  if (bonus.type === 'stat' && bonus.stat && bonus.value) {
    game.saveData.addPermanentStat(bonus.stat, bonus.value);
    return;
  }
  if (bonus.type === 'unlock' && bonus.item) {
    if (!Array.isArray(game.saveData.shopPurchases)) game.saveData.shopPurchases = [];
    if (!game.saveData.shopPurchases.includes(`unlock:${bonus.item}`)) {
      game.saveData.shopPurchases.push(`unlock:${bonus.item}`);
    }
  }
}

export function addAchievementProgress(game, achievementId, amount = 1) {
  if (!game.saveData) return;
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return;
  const record = ensureAchievementRecord(game, achievementId);
  const current = record.progress || 0;
  const next = Math.max(current, current + Math.max(0, amount));
  record.progress = next;
  if (!record.unlocked && next >= (achievement.condition?.count || 1)) {
    record.unlocked = true;
    applyAchievementBonus(game, achievement);
    if (game.state === 'playing') {
      game.messageLog.add(`Achievement unlocked: ${achievement.name}`, game.turnCount);
    } else {
      game.hubNotice = `Achievement unlocked: ${achievement.name}`;
    }
  }
}

export function setAchievementProgress(game, achievementId, value) {
  if (!game.saveData) return;
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return;
  const record = ensureAchievementRecord(game, achievementId);
  const next = Math.max(record.progress || 0, Math.max(0, value));
  record.progress = next;
  if (!record.unlocked && next >= (achievement.condition?.count || 1)) {
    record.unlocked = true;
    applyAchievementBonus(game, achievement);
    game.hubNotice = `Achievement unlocked: ${achievement.name}`;
  }
}

export function syncMilestoneAchievements(game) {
  if (!game.saveData) return;
  if (game.floorNumber >= 5) {
    setAchievementProgress(game, 'descent', game.floorNumber);
  }
  if (game.floorNumber >= 10) {
    setAchievementProgress(game, 'deep_dweller', game.floorNumber);
  }
}

export function awardXP(game, amount) {
  if (!game.player || !game.saveData) return;
  const classKey = game.player.playerClass;

  const xpBonus = game.treePassiveEffects?.xp_bonus || 0;
  const finalAmount = Math.floor(amount * (1 + xpBonus));

  game.saveData.classXP[classKey] = (game.saveData.classXP[classKey] || 0) + finalAmount;

  const oldLevel = game.saveData.classLevels[classKey] || 1;
  const newLevel = getLevelForXP(game.saveData.classXP[classKey]);

  if (newLevel > oldLevel) {
    game.saveData.classLevels[classKey] = newLevel;
    const oldPoints = getSkillPointsForLevel(oldLevel);
    const newPoints = getSkillPointsForLevel(newLevel);
    const pointsGained = newPoints - oldPoints;
    game.saveData.skillPoints[classKey] = (game.saveData.skillPoints[classKey] || 0) + pointsGained;
    const hpBefore = game.player.maxHp;
    applyLevelUpGrowth(game, oldLevel, newLevel);
    const hpGained = game.player.maxHp - hpBefore;
    game.messageLog.add(`Level up! ${classKey.charAt(0).toUpperCase() + classKey.slice(1)} is now level ${newLevel}. +${pointsGained} skill point${pointsGained > 1 ? 's' : ''}, +${hpGained} max HP.`, game.turnCount, '#ffd700');
    addFloatingText(game, game.player.position.x, game.player.position.y, `LEVEL ${newLevel}!`, '#ffd700', 1200);
    if (game.audio) game.audio.uiClick();
  }
}

export function getEnemyXP(game, enemy) {
  const rank = game.currentRank || 1;
  const baseXP = enemy.isFloorBoss ? 200 : (enemy.isElite ? 40 : 20);
  return Math.floor(baseXP * (1 + (rank - 1) * 0.20));
}

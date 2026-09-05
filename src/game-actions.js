import { TILE, getBiome, PLAYER_BASE_ATTACK, ENEMY_BASE_ATTACK } from './constants.js';
import { Entity } from './entity.js';
import { resolveAttack, getTrapDamage } from './combat.js';
import { getAIAction } from './ai.js';
import {
  addToInventory,
  assignToBelt,
  autoEquipIfSlotEmpty,
  equipItem,
  removeFromInventory,
  unequipItem,
  useBeltSlot,
  refillBeltSlotWithMatchingConsumable
} from './inventory.js';
import { assignSkillToSlot, canUseSkill, syncClassSkillCooldown, updateActiveSkills, useSkill } from './skills.js';
import { generateItem, generateConsumable } from './items.js';
import { rollMaterialDrop, getBossKillMaterials, MATERIAL_COLORS, BIOME_MATERIALS } from './resources.js';
import { SKILL_SLOT_KEYS } from './skills.js';
import {
  isDirectionalAction,
  getEntityStatsWithEquipment,
  getPlayerWeaponMultiplier,
  getPlayerAttackType,
  getRarityColor,
  formatSlotName,
  getEquipmentRows,
  getInventoryCapacity,
  getInventoryGridColumns,
  addFloatingText,
  addHitFeedback,
  addProjectileForDamageType,
  addProjectile,
  addAchievementProgress,
  awardXP,
  getEnemyXP,
  recalcPlayerMaxHp,
} from './game-utils.js';
import { finalizeRun } from './game-save.js';

export function resolveCombat(game, attacker, defender, options) {
  const originalAttackerStats = attacker.stats;
  const originalDefenderStats = defender.stats;

  attacker.stats = getEntityStatsWithEquipment(attacker);
  defender.stats = getEntityStatsWithEquipment(defender);

  // Inject skill tree effects for player
  if (attacker.type === 'player' && game.treePassiveEffects) {
    options.attackerTreeEffects = game.treePassiveEffects;
  }
  if (defender.type === 'player' && game.treePassiveEffects) {
    options.defenderTreeEffects = game.treePassiveEffects;
  }

  if (attacker.type === 'player') {
    // deadeye: guaranteed crits on the next few ranged attacks
    const deadeye = attacker.hasStatusEffect('deadeye');
    if (deadeye && options.damageType === 'ranged') {
      options.forceCrit = true;
      deadeye.value -= 1;
      if (deadeye.value <= 0) attacker.statusEffects = attacker.statusEffects.filter(e => e.type !== 'deadeye');
    }
    // shadow step: the attack that breaks invisibility is a guaranteed crit
    const invisible = attacker.hasStatusEffect('invisible');
    if (invisible) {
      if (invisible.breakCrit) options.forceCrit = true;
      attacker.statusEffects = attacker.statusEffects.filter(e => e.type !== 'invisible');
      game.messageLog.add('You step out of the shadows.', game.turnCount);
    }
    // ambush predator: unaware enemies take multiplied damage
    if (defender.type === 'enemy' && !defender.alerted && game.treePassiveEffects?.ambush_damage > 0) {
      options.damageMultiplier = (options.damageMultiplier || 1) * game.treePassiveEffects.ambush_damage;
      game.messageLog.add(`Ambush! The ${defender.name} never saw you coming.`, game.turnCount, '#ffd86b');
    }
    if (defender.type === 'enemy') defender.alerted = true;
  }

  try {
    return resolveAttack(attacker, defender, options);
  } finally {
    attacker.stats = originalAttackerStats;
    defender.stats = originalDefenderStats;
  }
}

export function findRangedTarget(game, dx, dy, maxRange = 6) {
  const px = game.player.position.x;
  const py = game.player.position.y;
  for (let step = 1; step <= maxRange; step++) {
    const x = px + dx * step;
    const y = py + dy * step;
    if (game.map.blocksLOS(x, y)) return null;
    const enemy = game.map.entities.find(e =>
      e.type === 'enemy' && e.isAlive() && e.position.x === x && e.position.y === y
    );
    if (enemy) return enemy;
  }
  return null;
}

export function findRangedTrap(game, dx, dy, maxRange = 6) {
  const px = game.player.position.x;
  const py = game.player.position.y;
  for (let step = 1; step <= maxRange; step++) {
    const x = px + dx * step;
    const y = py + dy * step;
    if (game.map.blocksLOS(x, y)) return null;
    if (game.map.getTile(x, y) === TILE.TRAP) return { x, y, distance: step };
  }
  return null;
}

export function getGroundItemIndexAt(game, x, y) {
  return game.map.items.findIndex(i => i.position.x === x && i.position.y === y);
}

export function handlePickupAction(game) {
  const x = game.player.position.x;
  const y = game.player.position.y;
  const itemIndex = getGroundItemIndexAt(game, x, y);
  if (itemIndex === -1) {
    game.messageLog.add('There is nothing here to pick up.', game.turnCount);
    return false;
  }

  const groundItem = game.map.items[itemIndex];
  const { position: _position, ...item } = groundItem;
  if (!addToInventory(game.player, item)) {
    game.messageLog.add('Your inventory is full.', game.turnCount);
    return false;
  }

  game.map.items.splice(itemIndex, 1);
  game.messageLog.add(`You pick up ${item.name}.`, game.turnCount);
  addFloatingText(game, x, y, item.name, getRarityColor(item.rarity, '#d6dce3'), 1050);
  if (game.audio) game.audio.itemPickup();

  if (item.slot && autoEquipIfSlotEmpty(game.player, item.id)) {
    updateActiveSkills(game.player);
    recalcPlayerMaxHp(game);
    game.messageLog.add(`${item.name} auto-equipped to ${formatSlotName(item.slot)}.`, game.turnCount);
    if (game.audio) game.audio.uiClick();
    return true;
  }

  if (item.type === 'consumable') {
    // a stackable pickup may have merged into an existing stack; only loose items get a belt slot
    const stillLoose = game.player.inventory.some(i => i.id === item.id);
    const freeBeltSlot = game.player.belt.findIndex(s => s === null);
    if (stillLoose && freeBeltSlot !== -1) {
      assignToBelt(game.player, item.id, freeBeltSlot);
      game.messageLog.add(`${item.name} assigned to belt slot ${freeBeltSlot + 1}.`, game.turnCount);
    } else if (!stillLoose) {
      game.messageLog.add(`${item.name} added to your stack.`, game.turnCount);
    }
  }

  return true;
}

export function clampInventoryCursor(game) {
  const maxInv = getInventoryCapacity() - 1;
  const curInv = game.inventoryCursorByTab.inventory || 0;
  game.inventoryCursorByTab.inventory = Math.max(0, Math.min(curInv, maxInv));

  const rows = getEquipmentRows(game.player);
  const maxEq = Math.max(0, rows.length - 1);
  const curEq = game.inventoryCursorByTab.equipment || 0;
  game.inventoryCursorByTab.equipment = Math.max(0, Math.min(curEq, maxEq));
}

export function moveEquipmentCursor(game, delta) {
  const rows = getEquipmentRows(game.player);
  if (rows.length === 0) return;
  const current = game.inventoryCursorByTab.equipment || 0;
  const next = current + delta;
  if (next < 0) return;
  if (next > rows.length - 1) {
    game.inventorySection = 'items';
    game.inventoryCursorByTab.inventory = 0;
    if (game.audio) game.audio.uiClick();
    return;
  }
  game.inventoryCursorByTab.equipment = next;
  if (game.audio) game.audio.uiClick();
}

export function moveInventoryGridCursor(game, dx, dy) {
  const cols = getInventoryGridColumns();
  const capacity = getInventoryCapacity();
  const gridRows = Math.ceil(capacity / cols);
  const current = game.inventoryCursorByTab.inventory || 0;
  let row = Math.floor(current / cols);
  let col = current % cols;

  if (dy < 0 && row === 0) {
    game.inventorySection = 'equipment';
    const eqRows = getEquipmentRows(game.player);
    game.inventoryCursorByTab.equipment = eqRows.length - 1;
    if (game.audio) game.audio.uiClick();
    return;
  }

  row = Math.max(0, Math.min(gridRows - 1, row + (dy || 0)));
  col = Math.max(0, Math.min(cols - 1, col + (dx || 0)));

  let next = row * cols + col;
  if (next >= capacity) next = capacity - 1;
  game.inventoryCursorByTab.inventory = next;
  if ((dx || 0) !== 0 || (dy || 0) !== 0) {
    if (game.audio) game.audio.uiClick();
  }
}

export function dropItemAtPlayer(game, item) {
  game.map.items.push({
    ...item,
    position: { x: game.player.position.x, y: game.player.position.y },
  });
  game.messageLog.add(`You drop ${item.name}.`, game.turnCount);
}

export function tryAssignSelectedInventoryItemToBelt(game, slot = null) {
  if (game.inventorySection !== 'items') {
    game.messageLog.add('Select an item in the Items section to assign belt slots.', game.turnCount);
    return false;
  }

  const idx = game.inventoryCursorByTab.inventory || 0;
  const item = game.player.inventory[idx];
  if (!item) return false;
  if (item.type !== 'consumable') {
    game.messageLog.add('Only consumables can go in the belt.', game.turnCount);
    return false;
  }

  let beltSlot = Number.isInteger(slot) ? slot : game.player.belt.findIndex(s => s === null);
  if (beltSlot === -1) beltSlot = 0;
  if (!assignToBelt(game.player, item.id, beltSlot)) return false;

  game.messageLog.add(`${item.name} assigned to belt slot ${beltSlot + 1}.`, game.turnCount);
  clampInventoryCursor(game);
  if (game.audio) game.audio.uiClick();
  return true;
}

export function handleInventoryOverlayAction(game, action) {
  if (action.type === 'inventory' || action.type === 'close' || action.type === 'inventoryTab') {
    game.inventoryOpen = false;
    if (game.audio) game.audio.uiClick();
    return;
  }

  if (isDirectionalAction(action)) {
    if (game.inventorySection === 'items') {
      moveInventoryGridCursor(game, action.dx, action.dy);
    } else {
      if (action.dy !== 0) {
        moveEquipmentCursor(game, action.dy);
      }
    }
    return;
  }

  if (action.type === 'belt') {
    tryAssignSelectedInventoryItemToBelt(game, action.slot);
    return;
  }

  if (action.type === 'skill') {
    if (game.inventorySection !== 'equipment') {
      game.messageLog.add('Select an equipment slot to assign skills.', game.turnCount);
      return;
    }
    const equipmentRows = getEquipmentRows(game.player);
    const idx = game.inventoryCursorByTab.equipment || 0;
    const selected = equipmentRows[idx];
    if (!selected || !selected.item || !selected.item.skill) {
      game.messageLog.add('Selected item has no skill to assign.', game.turnCount);
      return;
    }
    const slotLabel = action.slot === 0 ? 'Q' : action.slot === 1 ? 'E' : 'R';
    if (assignSkillToSlot(game.player, selected.slot, action.slot)) {
      game.messageLog.add(`${selected.item.skill.name} assigned to ${slotLabel}.`, game.turnCount);
      if (game.audio) game.audio.uiClick();
    }
    return;
  }

  if (game.inventorySection === 'items') {
    const idx = game.inventoryCursorByTab.inventory || 0;
    const item = game.player.inventory[idx];
    if (!item) return;

    if (action.type === 'inventoryConfirm') {
      if (!item.slot) {
        game.messageLog.add(`${item.name} cannot be equipped.`, game.turnCount);
        return;
      }
      if (equipItem(game.player, item.id)) {
        updateActiveSkills(game.player);
        recalcPlayerMaxHp(game);
        game.messageLog.add(`You equip ${item.name}.`, game.turnCount);
        clampInventoryCursor(game);
        if (game.audio) game.audio.uiClick();
      }
      return;
    }

    if (action.type === 'inventoryBelt') {
      tryAssignSelectedInventoryItemToBelt(game);
      return;
    }

    if (action.type === 'inventoryDrop') {
      const removed = removeFromInventory(game.player, item.id);
      if (removed) {
        if (!trySalvage(game, removed)) dropItemAtPlayer(game, removed);
        clampInventoryCursor(game);
        if (game.audio) game.audio.uiClick();
      }
    }
    return;
  }

  const equipmentRows = getEquipmentRows(game.player);
  const idx = game.inventoryCursorByTab.equipment || 0;
  const selected = equipmentRows[idx];
  if (!selected) return;
  if (!selected.item) {
    if (action.type === 'inventoryConfirm' || action.type === 'inventoryUnequip' || action.type === 'inventoryDrop') {
      game.messageLog.add(`No item equipped in ${formatSlotName(selected.slot)}.`, game.turnCount);
    }
    return;
  }

  if (action.type === 'inventoryConfirm' || action.type === 'inventoryUnequip') {
    const itemName = selected.item.name;
    if (unequipItem(game.player, selected.slot)) {
      updateActiveSkills(game.player);
      recalcPlayerMaxHp(game);
      game.messageLog.add(`You unequip ${itemName}.`, game.turnCount);
      clampInventoryCursor(game);
      if (game.audio) game.audio.uiClick();
    } else {
      game.messageLog.add('Inventory full. Cannot unequip.', game.turnCount);
    }
    return;
  }

  if (action.type === 'inventoryDrop') {
    const item = selected.item;
    game.player.equipment[selected.slot] = null;
    updateActiveSkills(game.player);
    recalcPlayerMaxHp(game);
    if (!trySalvage(game, item)) dropItemAtPlayer(game, item);
    if (game.audio) game.audio.uiClick();
  }
}

// salvage (archer tree): dropped gear turns into the biome's primary material
export function trySalvage(game, item) {
  const perItem = game.treePassiveEffects?.salvage || 0;
  if (perItem <= 0 || !item || item.type === 'consumable' || !game.runMaterials) return false;
  const biome = getBiome(game.floorNumber);
  const type = (BIOME_MATERIALS[biome] || BIOME_MATERIALS.wilds).primary;
  game.runMaterials[type] += perItem;
  game.messageLog.add(`You salvage ${item.name} for +${perItem} ${type}.`, game.turnCount, MATERIAL_COLORS[type]);
  addFloatingText(game, game.player.position.x, game.player.position.y, `+${perItem} ${type}`, MATERIAL_COLORS[type], 900);
  return true;
}

export function applyConsumable(game, item) {
  switch (item.effect) {
    case 'heal': {
      const before = game.player.hp;
      const potionMult = game.treePassiveEffects?.potion_healing_mult || 1;
      const amount = Math.max(1, Math.floor(game.player.maxHp * item.magnitude * potionMult));
      game.player.heal(amount);
      const healed = game.player.hp - before;
      if (healed > 0) {
        addFloatingText(game, game.player.position.x, game.player.position.y, `+${healed} HP`, '#73e38e', 820);
      }
      return `You drink ${item.name} and recover ${healed} HP.`;
    }
    case 'reveal_map': {
      for (let y = 0; y < game.map.height; y++) {
        for (let x = 0; x < game.map.width; x++) {
          game.map.setExplored(x, y, true);
        }
      }
      return `${item.name} reveals the map.`;
    }
    case 'aoe_damage': {
      const radius = 2;
      let hitCount = 0;
      for (const enemy of game.map.entities) {
        if (enemy.type !== 'enemy' || !enemy.isAlive()) continue;
        const dist = Math.abs(enemy.position.x - game.player.position.x) + Math.abs(enemy.position.y - game.player.position.y);
        if (dist <= radius) {
          enemy.takeDamage(item.magnitude);
          hitCount++;
          if (!enemy.isAlive()) {
            handleEnemyDeath(game, enemy);
          }
        }
      }
      return `The ${item.name} explodes and hits ${hitCount} enemy${hitCount === 1 ? '' : 'ies'}.`;
    }
    case 'teleport': {
      const candidates = [];
      for (let y = 1; y < game.map.height - 1; y++) {
        for (let x = 1; x < game.map.width - 1; x++) {
          if (!game.map.isWalkable(x, y)) continue;
          const blocked = game.map.entities.some(e => e.isAlive() && e.position.x === x && e.position.y === y);
          if (!blocked) candidates.push({ x, y });
        }
      }
      if (candidates.length === 0) return `${item.name} fizzles.`;
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      game.player.moveTo(target.x, target.y);
      return `${item.name} teleports you through the dungeon.`;
    }
    case 'speed_boost': {
      game.player.energy += 50;
      return `${item.name} surges through you.`;
    }
    case 'invisibility':
      game.player.addStatusEffect({ type: 'invisible', duration: Math.max(1, Math.round(item.magnitude || 8)), value: 1, breakCrit: false });
      return `${item.name} shrouds you. Enemies lose track of you.`;
    default:
      return `You use ${item.name}.`;
  }
}

export function handleBeltAction(game, slot) {
  const item = useBeltSlot(game.player, slot);
  if (!item) {
    game.messageLog.add('That belt slot is empty.', game.turnCount);
    return false;
  }

  const message = applyConsumable(game, item);
  game.messageLog.add(message, game.turnCount);
  const replacement = refillBeltSlotWithMatchingConsumable(game.player, slot, item);
  if (replacement) {
    game.messageLog.add(`Belt slot ${slot + 1} refilled with ${replacement.name}.`, game.turnCount);
  }
  if (game.audio) {
    if (item.effect === 'heal' || item.effect === 'speed_boost') game.audio.blessing();
    else if (item.effect === 'aoe_damage') game.audio.enemyHit();
    else game.audio.uiClick();
  }
  return true;
}

export function getSkillTargets(game, skill) {
  const maxRange = skill.range > 0 ? skill.range : Math.max(1, skill.area?.size || 1);
  const enemies = game.map.entities
    .filter(e => e.type === 'enemy' && e.isAlive() && game.map.isVisible(e.position.x, e.position.y))
    .map(e => ({ enemy: e, dist: Math.abs(e.position.x - game.player.position.x) + Math.abs(e.position.y - game.player.position.y) }))
    .filter(r => r.dist <= maxRange)
    .sort((a, b) => a.dist - b.dist)
    .map(r => r.enemy);

  if (enemies.length === 0) return [];
  const areaType = skill.area?.type || 'single';
  if (areaType === 'single' || areaType === 'line') return enemies.slice(0, 1);
  if (areaType === 'circle' || areaType === 'cone') {
    const maxTargets = Math.max(1, Math.min(4, skill.area?.size || 2));
    return enemies.slice(0, maxTargets);
  }
  return enemies.slice(0, 1);
}

export function handleSkillAction(game, slot) {
  const skill = game.player.activeSkills[slot];
  if (!skill) {
    game.messageLog.add('No skill is bound to that slot.', game.turnCount);
    return false;
  }
  if (!canUseSkill(skill)) {
    const label = skill.currentCooldown >= 900 ? 'already used this floor' : `on cooldown (${skill.currentCooldown})`;
    game.messageLog.add(`${skill.name} is ${label}.`, game.turnCount);
    return false;
  }

  const tree = game.treePassiveEffects || {};
  const cooldownReduction = tree.cooldown_reduction || 0;

  if (skill.skillType === 'tree') {
    return useTreeSkill(game, skill, cooldownReduction);
  }

  // Self-targeted skills (buffs/heals) don't need enemy targets
  if (skill.skillType === 'self') {
    if (!useSkill(skill, cooldownReduction)) return false;
    syncClassSkillCooldown(game.player);

    if (skill.effect.type === 'heal') {
      const amount = Math.max(1, Math.floor(game.player.maxHp * skill.effect.value));
      const before = game.player.hp;
      game.player.heal(amount);
      game.messageLog.add(`${skill.name}: healed ${game.player.hp - before} HP.`, game.turnCount);
    } else if (skill.effect.type === 'mana_shield') {
      game.player.addStatusEffect({ type: 'mana_shield', duration: 999, value: skill.effect.value });
      game.messageLog.add(`${skill.name}: absorbing next ${skill.effect.value} damage.`, game.turnCount);
    } else {
      game.player.addStatusEffect({ ...skill.effect });
      game.messageLog.add(`${skill.name} activated for ${skill.effect.duration} turns.`, game.turnCount);
    }
    if (game.audio) game.audio.uiClick();
    return true;
  }

  const targets = getSkillTargets(game, skill);
  if (targets.length === 0) {
    game.messageLog.add(`No targets in range for ${skill.name}.`, game.turnCount);
    return false;
  }

  if (!useSkill(skill, cooldownReduction)) return false;
  syncClassSkillCooldown(game.player);

  let totalDamage = 0;
  let killCount = 0;
  let dodgeCount = 0;
  const damageType = skill.statScaling === 'DEX' ? 'ranged' : skill.statScaling === 'INT' ? 'magic' : 'melee';
  const weaponMultiplier = getPlayerWeaponMultiplier(game.player, damageType);
  const skillDamageMult = getSkillDamageMultiplier(game);
  payOverchargeCost(game);

  for (const enemy of targets) {
    addProjectileForDamageType(game, game.player, enemy, damageType);
    const result = resolveCombat(game, game.player, enemy, {
      baseDamage: skill.damage,
      damageType,
      weaponMultiplier,
      damageMultiplier: skillDamageMult,
    });
    addHitFeedback(game, enemy, result, 'player');
    if (!result.dodged && damageType === 'magic') {
      addAchievementProgress(game, 'arcane_mastery', result.damage);
    }
    if (game.player.playerClass === 'archer' && result.crit) {
      addAchievementProgress(game, 'sharpshooter', 1);
    }
    if (result.dodged) {
      dodgeCount++;
      continue;
    }
    totalDamage += result.damage;
    if (result.killed) {
      killCount++;
      handleEnemyDeath(game, enemy);
    }
  }

  game.messageLog.add(
    `${skill.name} hits ${targets.length} target${targets.length === 1 ? '' : 's'} for ${totalDamage} total damage.` +
    (killCount > 0 ? ` (${killCount} kill${killCount === 1 ? '' : 's'})` : '') +
    (dodgeCount > 0 ? ` (${dodgeCount} dodged)` : ''),
    game.turnCount
  );

  if (game.audio) {
    if (damageType === 'magic') game.audio.magicCast();
    else if (damageType === 'ranged') game.audio.rangedShot();
    else game.audio.meleeHit();
  }
  return true;
}

// overcharge and archmage boost every active skill's damage
export function getSkillDamageMultiplier(game) {
  const tree = game.treePassiveEffects || {};
  return 1 + (tree.overcharge?.damageBonus || 0) + (tree.archmage?.damageBonus || 0);
}

// overcharge: skills cost a slice of max hp (never lethal)
export function payOverchargeCost(game) {
  const cost = game.treePassiveEffects?.overcharge?.hpCost || 0;
  if (cost <= 0) return;
  const amount = Math.min(game.player.hp - 1, Math.max(1, Math.floor(game.player.maxHp * cost)));
  if (amount > 0) {
    game.player.takeDamage(amount);
    addFloatingText(game, game.player.position.x, game.player.position.y, `-${amount}`, '#ff8a6a', 700);
  }
}

const DIRS4 = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

function isTileFree(game, x, y) {
  return game.map.isWalkable(x, y) && !game.map.entities.some(e => e.isAlive() && e.position.x === x && e.position.y === y);
}

function visibleEnemies(game) {
  return game.map.entities.filter(e => e.type === 'enemy' && e.isAlive() && game.map.isVisible(e.position.x, e.position.y));
}

function manhattan(a, b) {
  return Math.abs(a.position.x - b.position.x) + Math.abs(a.position.y - b.position.y);
}

// finds the first enemy along a straight line from the player, within range,
// and the free tile just before it
function findLineTarget(game, distance) {
  const px = game.player.position.x;
  const py = game.player.position.y;
  for (const d of DIRS4) {
    for (let step = 1; step <= distance + 1; step++) {
      const x = px + d.dx * step;
      const y = py + d.dy * step;
      const enemy = game.map.entities.find(e => e.type === 'enemy' && e.isAlive() && e.position.x === x && e.position.y === y);
      if (enemy) {
        return { enemy, dir: d, stopX: px + d.dx * (step - 1), stopY: py + d.dy * (step - 1) };
      }
      if (!game.map.isWalkable(x, y) || game.map.blocksLOS(x, y)) break;
    }
  }
  return null;
}

// skill tree actives: each has a treeEffect describing what it does
export function useTreeSkill(game, skill, cooldownReduction = 0) {
  const eff = skill.treeEffect || {};
  const player = game.player;
  const px = player.position.x;
  const py = player.position.y;
  const enemies = visibleEnemies(game);
  const skillDamageMult = getSkillDamageMultiplier(game);
  const hitEnemy = (enemy, baseDamage, damageType, extraMult = 1) => {
    addProjectileForDamageType(game, player, enemy, damageType);
    const result = resolveCombat(game, player, enemy, {
      baseDamage,
      damageType,
      weaponMultiplier: getPlayerWeaponMultiplier(game.player, damageType),
      damageMultiplier: skillDamageMult * extraMult,
    });
    addHitFeedback(game, enemy, result, 'player');
    if (result.killed) handleEnemyDeath(game, enemy);
    return result;
  };
  const commit = () => {
    useSkill(skill, cooldownReduction);
    payOverchargeCost(game);
    if (game.audio) game.audio.uiClick();
    return true;
  };

  switch (eff.type) {
    case 'self_buff': {
      player.addStatusEffect({ type: 'berserk', duration: eff.duration, value: eff.damageBonus, defenseReduction: eff.defenseReduction });
      game.messageLog.add(`${skill.name}: +${Math.round((eff.damageBonus - 1) * 100)}% damage, +${Math.round(eff.defenseReduction * 100)}% damage taken for ${eff.duration} turns.`, game.turnCount, '#ff9f43');
      return commit();
    }
    case 'rush': {
      const target = findLineTarget(game, eff.distance);
      if (!target) {
        game.messageLog.add(`${skill.name}: no enemy within ${eff.distance} tiles in a straight line.`, game.turnCount);
        return false;
      }
      if (target.stopX !== px || target.stopY !== py) player.moveTo(target.stopX, target.stopY);
      game.messageLog.add(`You rush the ${target.enemy.name}!`, game.turnCount, '#ff9f43');
      const result = hitEnemy(target.enemy, PLAYER_BASE_ATTACK, 'melee', 1.5);
      if (result.hit) game.messageLog.add(`Rush hits the ${target.enemy.name} for ${result.damage}.`, game.turnCount);
      if (game.audio) game.audio.meleeHit();
      return commit();
    }
    case 'aoe_slow': {
      if (enemies.length === 0) { game.messageLog.add(`${skill.name}: no enemies in sight.`, game.turnCount); return false; }
      for (const e of enemies) e.addStatusEffect({ type: 'slowed', duration: eff.duration, value: eff.speedReduction });
      game.messageLog.add(`${skill.name}: ${enemies.length} enem${enemies.length === 1 ? 'y' : 'ies'} slowed by ${Math.round(eff.speedReduction * 100)}%.`, game.turnCount, '#ff9f43');
      if (game.audio) game.audio.bossEntrance();
      return commit();
    }
    case 'auto_crit_charges': {
      player.addStatusEffect({ type: 'deadeye', duration: 99, value: eff.value });
      game.messageLog.add(`${skill.name}: your next ${eff.value} ranged attacks will crit.`, game.turnCount, '#ff9f43');
      return commit();
    }
    case 'leap': {
      if (enemies.length === 0) { game.messageLog.add(`${skill.name}: nothing to leap away from.`, game.turnCount); return false; }
      // bfs over free tiles up to `distance` steps, pick the one farthest from the nearest enemy
      const nearestDist = (x, y) => Math.min(...enemies.map(e => Math.abs(e.position.x - x) + Math.abs(e.position.y - y)));
      const seen = new Set([`${px},${py}`]);
      let frontier = [{ x: px, y: py }];
      let best = { x: px, y: py, d: nearestDist(px, py) };
      for (let step = 0; step < eff.distance; step++) {
        const next = [];
        for (const t of frontier) {
          for (const d of DIRS4) {
            const nx = t.x + d.dx, ny = t.y + d.dy;
            const key = `${nx},${ny}`;
            if (seen.has(key) || !isTileFree(game, nx, ny)) continue;
            seen.add(key);
            next.push({ x: nx, y: ny });
            const dist = nearestDist(nx, ny);
            if (dist > best.d) best = { x: nx, y: ny, d: dist };
          }
        }
        frontier = next;
      }
      if (best.x === px && best.y === py) { game.messageLog.add(`${skill.name}: no room to leap.`, game.turnCount); return false; }
      player.moveTo(best.x, best.y);
      game.messageLog.add('You leap clear of the fight.', game.turnCount, '#ff9f43');
      if (game.audio) game.audio.footstep();
      return commit();
    }
    case 'invisibility': {
      player.addStatusEffect({ type: 'invisible', duration: eff.duration, value: 1, breakCrit: !!eff.breakCrit });
      game.messageLog.add(`${skill.name}: you melt into the shadows for ${eff.duration} turns.`, game.turnCount, '#ff9f43');
      return commit();
    }
    case 'caltrops': {
      const near = enemies.filter(e => Math.abs(e.position.x - px) <= 1 && Math.abs(e.position.y - py) <= 1);
      for (const e of near) e.addStatusEffect({ type: 'slowed', duration: eff.duration, value: eff.slowAmount });
      game.messageLog.add(`${skill.name}: ${near.length} nearby enem${near.length === 1 ? 'y' : 'ies'} slowed.`, game.turnCount, '#ff9f43');
      return commit();
    }
    case 'aoe_damage': {
      if (enemies.length === 0) { game.messageLog.add(`${skill.name}: no target in sight.`, game.turnCount); return false; }
      const center = enemies.slice().sort((a, b) => manhattan(a, player) - manhattan(b, player))[0];
      const radius = eff.radius || 1;
      const hit = game.map.entities.filter(e => e.type === 'enemy' && e.isAlive() &&
        Math.abs(e.position.x - center.position.x) <= radius && Math.abs(e.position.y - center.position.y) <= radius);
      let total = 0;
      for (const e of hit) {
        const result = hitEnemy(e, eff.damage, 'magic');
        if (result.hit) total += result.damage;
      }
      game.messageLog.add(`${skill.name} strikes ${hit.length} enem${hit.length === 1 ? 'y' : 'ies'} for ${total} total damage.`, game.turnCount, '#ff9f43');
      if (game.audio) game.audio.magicCast();
      return commit();
    }
    case 'aoe_freeze': {
      if (enemies.length === 0) { game.messageLog.add(`${skill.name}: no enemies in sight.`, game.turnCount); return false; }
      for (const e of enemies) e.addStatusEffect({ type: 'stunned', duration: eff.duration, value: 1 });
      game.messageLog.add(`${skill.name}: time stops for ${enemies.length} enem${enemies.length === 1 ? 'y' : 'ies'}.`, game.turnCount, '#ff9f43');
      if (game.audio) game.audio.magicCast();
      return commit();
    }
    case 'gear_enchant': {
      const candidates = ['leftHand', 'rightHand', 'torso', 'head', 'legs', 'accessory1', 'accessory2']
        .map(slot => player.equipment[slot]).filter(Boolean);
      const item = candidates[0];
      if (!item) { game.messageLog.add(`${skill.name}: nothing equipped to enchant.`, game.turnCount); return false; }
      const bonuses = item.statBonuses || (item.statBonuses = {});
      let bestStat = null;
      for (const [stat, val] of Object.entries(bonuses)) if (bestStat === null || val > bonuses[bestStat]) bestStat = stat;
      if (!bestStat) bestStat = player.affinityStats?.[0] || 'STR';
      bonuses[bestStat] = (bonuses[bestStat] || 0) + eff.statBonus;
      recalcPlayerMaxHp(game);
      game.messageLog.add(`${skill.name}: ${item.name} gains +${eff.statBonus} ${bestStat} for this run.`, game.turnCount, '#ff9f43');
      if (game.audio) game.audio.blessing();
      return commit();
    }
    default:
      game.messageLog.add(`${skill.name} has no effect yet.`, game.turnCount);
      return false;
  }
}

// death with a safety net: unbreakable saves the player once per floor
export function handlePlayerDeath(game, cause) {
  if (game.treePassiveEffects?.death_save && !game.deathSaveUsedThisFloor) {
    game.deathSaveUsedThisFloor = true;
    game.player.hp = 1;
    game.messageLog.add('Unbreakable! You refuse to fall.', game.turnCount, '#ffd700');
    addFloatingText(game, game.player.position.x, game.player.position.y, 'UNBREAKABLE', '#ffd700', 1200);
    return false;
  }
  finalizeRun(game, cause);
  game.captureRunItemsForHub(false);
  game.deathSplashFrames = 0;
  game.state = 'deathSplash';
  if (game.audio) game.audio.stopAmbient();
  return true;
}

export function handleEnemyDeath(game, enemy) {
  game.turnSystem.removeEntity(enemy.id);
  game.runSummary.enemiesKilled++;
  // the bone lord can raise anything that dies on his floor, except things he already raised
  if (!enemy.isFloorBoss && !enemy.isSummonedMinion) {
    game.corpses = game.corpses || [];
    game.corpses.push({ x: enemy.position.x, y: enemy.position.y, name: enemy.name });
  }
  if (enemy.name === 'Rat' || enemy.name === 'Elite Rat') {
    addAchievementProgress(game, 'rat_slayer', 1);
  }

  const killCurrency = (enemy.isElite ? 6 : 3) + Math.floor(Math.random() * (enemy.isElite ? 6 : 3));
  game.player.gold += killCurrency;
  game.runSummary.currencyEarned += killCurrency;

  if (enemy.isFloorBoss) {
    const luck = getEntityStatsWithEquipment(game.player).LCK;
    const bossDrop = generateItem({ floorLevel: game.floorNumber, luck, context: 'boss' });
    game.map.items.push({
      ...bossDrop,
      position: { x: enemy.position.x, y: enemy.position.y },
    });
    game.messageLog.add(`The ${enemy.name} drops ${bossDrop.name}!`, game.turnCount);

    if (game.floorNumber >= 10) {
      const victoryBonus = 120;
      game.player.gold += victoryBonus;
      game.runSummary.currencyEarned += victoryBonus;
      addAchievementProgress(game, 'vanquisher', 1);
      game.messageLog.add('The Void Tyrant falls. Descend the stairs to claim victory.', game.turnCount);
    }
  } else if (Math.random() < 0.45 * (1 + (game.treePassiveEffects?.drop_rate_bonus || 0))) {
    const luck = getEntityStatsWithEquipment(game.player).LCK;
    const drop = Math.random() < 0.35
      ? generateConsumable(game.floorNumber)
      : generateItem({ floorLevel: game.floorNumber + (game.treePassiveEffects?.gear_level_bonus || 0), luck, context: 'drop' });
    game.map.items.push({
      ...drop,
      position: { x: enemy.position.x, y: enemy.position.y },
    });
    game.messageLog.add(`The ${enemy.name} drops ${drop.name}.`, game.turnCount);
  }

  // Material drops
  const biome = getBiome(game.floorNumber);
  if (enemy.isFloorBoss) {
    const bossMats = getBossKillMaterials(biome, game.currentRank || 1);
    for (const drop of bossMats) {
      game.runMaterials[drop.type] += drop.quantity;
      game.messageLog.add(`+${drop.quantity} ${drop.type}`, game.turnCount, MATERIAL_COLORS[drop.type]);
      addFloatingText(game, enemy.position.x, enemy.position.y, `+${drop.quantity} ${drop.type}`, MATERIAL_COLORS[drop.type], 900);
    }
  } else {
    const matDrop = rollMaterialDrop(biome, game.currentRank || 1);
    if (matDrop) {
      matDrop.quantity = Math.ceil(matDrop.quantity * (1 + (game.treePassiveEffects?.material_bonus || 0)));
      game.runMaterials[matDrop.type] += matDrop.quantity;
      game.messageLog.add(`+${matDrop.quantity} ${matDrop.type}`, game.turnCount, MATERIAL_COLORS[matDrop.type]);
      addFloatingText(game, enemy.position.x, enemy.position.y, `+${matDrop.quantity} ${matDrop.type}`, MATERIAL_COLORS[matDrop.type], 900);
    }
  }

  // XP award
  const xpAmount = getEnemyXP(game, enemy);
  awardXP(game, xpAmount);

  // Vital Strike: heal on kill
  if (game.treePassiveEffects?.kill_heal > 0) {
    const healAmount = Math.max(1, Math.floor(game.player.maxHp * game.treePassiveEffects.kill_heal));
    game.player.heal(healAmount);
    game.messageLog.add(`Vital Strike: healed ${healAmount} HP.`, game.turnCount, '#56d26d');
  }

  if (game.audio) game.audio.enemyDeath();
}

export function checkTrapTile(game, x, y) {
  if (game.map.getTile(x, y) !== TILE.TRAP) return;
  const resist = game.treePassiveEffects?.trap_resistance || 0;
  const damage = Math.round(getTrapDamage(game.floorNumber) * (1 - resist));

  // DEX dodge roll
  let dodgeChance = game.player.stats.DEX * 1.0;
  if (game.treePassiveEffects?.dodge_bonus) dodgeChance += game.treePassiveEffects.dodge_bonus;
  const dodged = Math.random() * 100 < dodgeChance;

  game.map.setTile(x, y, TILE.FLOOR);
  if (dodged || damage <= 0) {
    game.messageLog.add(damage <= 0 ? 'Trap Mastery: you disarm the trap harmlessly.' : 'You dodge a trap!', game.turnCount);
    if (game.audio) game.audio.uiClick();
    return;
  }

  game.player.takeDamage(damage);
  game.messageLog.add(`You trigger a trap! ${damage} damage.`, game.turnCount);
  if (game.audio) game.audio.playerHurt();
  if (!game.player.isAlive()) {
    game.messageLog.add('You have been slain by a trap!', game.turnCount);
    handlePlayerDeath(game, 'a trap');
  }
}

export function processPlayerAction(game, action) {
  if (action.type === 'move') {
    const nx = game.player.position.x + action.dx;
    const ny = game.player.position.y + action.dy;

    if (game.map.getTile(nx, ny) === TILE.DOOR) {
      game.map.setTile(nx, ny, TILE.DOOR_OPEN);
      game.player.moveTo(nx, ny);
      game.messageLog.add('You open the door.', game.turnCount);
      if (game.audio) game.audio.doorOpen();
      return true;
    }

    const enemy = game.map.entities.find(e =>
      e.type === 'enemy' && e.isAlive() && e.position.x === nx && e.position.y === ny
    );
    if (enemy) {
      game.messageLog.add(`The ${enemy.name} blocks your path.`, game.turnCount);
      return false;
    }

    if (game.map.isWalkable(nx, ny)) {
      game.player.moveTo(nx, ny);
      const dirs = { '0,-1': 'north', '0,1': 'south', '-1,0': 'west', '1,0': 'east' };
      game.messageLog.add(`You move ${dirs[`${action.dx},${action.dy}`]}.`, game.turnCount);
      if (game.audio) game.audio.footstep();
      // tactical advance: stepping next to an enemy primes the next attack
      const ta = game.treePassiveEffects?.tactical_advance || 0;
      if (ta > 0 && game.map.entities.some(e => e.type === 'enemy' && e.isAlive() && Math.abs(e.position.x - nx) + Math.abs(e.position.y - ny) === 1)) {
        game.player.addStatusEffect({ type: 'tactical', duration: 2, value: ta });
      }
      checkTrapTile(game, nx, ny);
      return true;
    } else {
      game.messageLog.add('You bump into a wall.', game.turnCount);
      return false;
    }
  }
  if (action.type === 'attack') {
    const attackType = getPlayerAttackType(game.player);
    let enemy;
    let damageType;

    if (attackType === 'melee') {
      damageType = 'melee';
      const nx = game.player.position.x + action.dx;
      const ny = game.player.position.y + action.dy;
      enemy = game.map.entities.find(e =>
        e.type === 'enemy' && e.isAlive() && e.position.x === nx && e.position.y === ny
      );
      if (!enemy) {
        if (game.map.getTile(nx, ny) === TILE.TRAP) {
          const resist = game.treePassiveEffects?.trap_resistance || 0;
          const damage = Math.max(0, Math.floor(getTrapDamage(game.floorNumber) * 0.5 * (1 - resist)));
          game.player.takeDamage(damage);
          game.map.setTile(nx, ny, TILE.FLOOR);
          game.messageLog.add(`You disarm the trap, taking ${damage} damage.`, game.turnCount);
          if (game.audio) game.audio.playerHurt();
          if (!game.player.isAlive()) {
            game.messageLog.add('You have been slain by a trap!', game.turnCount);
            handlePlayerDeath(game, 'a trap');
          }
          return true;
        }
        game.messageLog.add('You swing at empty air.', game.turnCount);
        return false;
      }
    } else {
      damageType = attackType;
      enemy = findRangedTarget(game, action.dx, action.dy);
      if (!enemy) {
        const trap = findRangedTrap(game, action.dx, action.dy);
        if (trap) {
          const spriteKey = damageType === 'ranged' ? 'arrow_projectile' : 'arcbolt_projectile';
          const dur = damageType === 'ranged' ? 170 : 210;
          addProjectile(game, game.player.position.x, game.player.position.y, trap.x, trap.y, spriteKey, dur);
          game.map.setTile(trap.x, trap.y, TILE.FLOOR);
          if (trap.distance <= 1) {
            const resist = game.treePassiveEffects?.trap_resistance || 0;
            const damage = Math.max(0, Math.floor(getTrapDamage(game.floorNumber) * 0.5 * (1 - resist)));
            game.player.takeDamage(damage);
            game.messageLog.add(`You disarm the trap, taking ${damage} damage.`, game.turnCount);
            if (game.audio) game.audio.playerHurt();
            if (!game.player.isAlive()) {
              game.messageLog.add('You have been slain by a trap!', game.turnCount);
              handlePlayerDeath(game, 'a trap');
            }
          } else {
            game.messageLog.add('You disarm the trap from a distance!', game.turnCount);
            if (game.audio) game.audio.uiClick();
          }
          return true;
        }
        const missMsg = damageType === 'ranged'
          ? 'Your shot hits nothing.'
          : 'Your bolt fizzles into the darkness.';
        game.messageLog.add(missMsg, game.turnCount);
        return false;
      }
      addProjectileForDamageType(game, game.player, enemy, damageType);
    }

    const result = resolveCombat(game, game.player, enemy, {
      baseDamage: PLAYER_BASE_ATTACK,
      damageType,
      weaponMultiplier: getPlayerWeaponMultiplier(game.player, damageType),
    });
    addHitFeedback(game, enemy, result, 'player');
    if (game.player.playerClass === 'archer' && result.crit) {
      addAchievementProgress(game, 'sharpshooter', 1);
    }
    if (!result.dodged && damageType === 'magic') {
      addAchievementProgress(game, 'arcane_mastery', result.damage);
    }
    if (result.dodged) {
      game.messageLog.add(`The ${enemy.name} dodges your attack!`, game.turnCount);
    } else if (result.killed) {
      game.messageLog.add(`You killed the ${enemy.name}!`, game.turnCount);
      handleEnemyDeath(game, enemy);
    } else {
      const critMsg = result.crit ? ' (CRITICAL!)' : '';
      game.messageLog.add(`You hit the ${enemy.name} for ${result.damage} damage!${critMsg}`, game.turnCount);
    }

    // Skill tree combat hooks (only on hit)
    if (result.hit && !result.dodged && !result.blocked) {
      if (damageType === 'melee' && game.treePassiveEffects?.cleave_chance > 0) {
        if (Math.random() < game.treePassiveEffects.cleave_chance) {
          const adjacentEnemy = game.map.entities.find(e =>
            e.type === 'enemy' && e.isAlive() && e.id !== enemy.id &&
            Math.abs(e.position.x - enemy.position.x) <= 1 &&
            Math.abs(e.position.y - enemy.position.y) <= 1
          );
          if (adjacentEnemy) {
            const cleaveResult = resolveCombat(game, game.player, adjacentEnemy, {
              baseDamage: Math.floor(PLAYER_BASE_ATTACK * 0.5),
              damageType: 'melee',
              weaponMultiplier: getPlayerWeaponMultiplier(game.player, 'melee'),
            });
            addHitFeedback(game, adjacentEnemy, cleaveResult, 'player');
            if (cleaveResult.killed) {
              game.messageLog.add(`Cleave kills ${adjacentEnemy.name}!`, game.turnCount);
              handleEnemyDeath(game, adjacentEnemy);
            } else if (cleaveResult.hit) {
              game.messageLog.add(`Cleave hits ${adjacentEnemy.name} for ${cleaveResult.damage}!`, game.turnCount);
            }
          }
        }
      }

      if (damageType === 'melee' && result.crit && !result.killed && game.treePassiveEffects?.stun_on_crit > 0) {
        enemy.addStatusEffect({ type: 'stunned', duration: game.treePassiveEffects.stun_on_crit, value: 1 });
        game.messageLog.add(`${enemy.name} is stunned!`, game.turnCount);
      }

      // piercing shot: the arrow continues to the next enemy on the same line
      if (damageType === 'ranged' && game.treePassiveEffects?.piercing_chance > 0 && Math.random() < game.treePassiveEffects.piercing_chance) {
        let second = null;
        for (let step = 1; step <= 6 && !second; step++) {
          const x = enemy.position.x + action.dx * step;
          const y = enemy.position.y + action.dy * step;
          if (game.map.blocksLOS(x, y)) break;
          second = game.map.entities.find(e => e.type === 'enemy' && e.isAlive() && e.position.x === x && e.position.y === y) || null;
        }
        if (second) {
          addProjectileForDamageType(game, enemy, second, 'ranged');
          const pr = resolveCombat(game, game.player, second, { baseDamage: PLAYER_BASE_ATTACK, damageType: 'ranged', weaponMultiplier: getPlayerWeaponMultiplier(game.player, 'ranged') });
          addHitFeedback(game, second, pr, 'player');
          game.messageLog.add(`Piercing Shot: the arrow also hits the ${second.name}${pr.hit ? ` for ${pr.damage}` : ''}!`, game.turnCount);
          if (pr.killed) handleEnemyDeath(game, second);
        }
      }

      // chain lightning: magic arcs to another nearby enemy for half damage
      if (damageType === 'magic' && game.treePassiveEffects?.chain_chance > 0 && Math.random() < game.treePassiveEffects.chain_chance) {
        const other = game.map.entities.find(e => e.type === 'enemy' && e.isAlive() && e.id !== enemy.id &&
          Math.abs(e.position.x - enemy.position.x) + Math.abs(e.position.y - enemy.position.y) <= 3 &&
          game.map.isVisible(e.position.x, e.position.y));
        if (other) {
          addProjectileForDamageType(game, enemy, other, 'magic');
          const cr = resolveCombat(game, game.player, other, { baseDamage: PLAYER_BASE_ATTACK, damageType: 'magic', weaponMultiplier: getPlayerWeaponMultiplier(game.player, 'magic'), damageMultiplier: 0.5 });
          addHitFeedback(game, other, cr, 'player');
          game.messageLog.add(`Chain Lightning arcs to the ${other.name}${cr.hit ? ` for ${cr.damage}` : ''}!`, game.turnCount);
          if (cr.killed) handleEnemyDeath(game, other);
        }
      }
    }

    if (game.audio) {
      if (damageType === 'magic') game.audio.magicCast();
      else if (damageType === 'ranged') game.audio.rangedShot();
      else game.audio.meleeHit();
    }
    return true;
  }
  if (action.type === 'wait') {
    game.messageLog.add('You wait.', game.turnCount);
    return true;
  }
  if (action.type === 'descend') {
    return game.handleFloorTransition();
  }
  if (action.type === 'pickup') {
    return handlePickupAction(game);
  }
  if (action.type === 'belt') {
    return handleBeltAction(game, action.slot);
  }
  if (action.type === 'skill') {
    return handleSkillAction(game, action.slot);
  }
  return false;
}

// boss signature moves. returns true when the boss spent its turn on one.
export function runBossMechanic(game, boss) {
  const player = game.player;
  const dist = Math.abs(boss.position.x - player.position.x) + Math.abs(boss.position.y - player.position.y);
  const cheb = Math.max(Math.abs(boss.position.x - player.position.x), Math.abs(boss.position.y - player.position.y));
  const hpRatio = boss.hp / boss.maxHp;
  boss.bossTurnCounter = (boss.bossTurnCounter || 0) + 1;

  switch (boss.bossKey) {
    case 'brood_mother': {
      if (hpRatio < 0.25 && !boss.enrageStage) {
        boss.enrageStage = 1;
        boss.speed = Math.floor(boss.speed * 1.3);
        game.messageLog.add('The Brood Mother shrieks and skitters faster!', game.turnCount, '#ff6a6a');
        if (game.audio) game.audio.bossEntrance();
      }
      return false;
    }
    case 'rat_king': {
      if (boss.bossTurnCounter % 4 === 0 && cheb <= 2) {
        game.messageLog.add('The Rat King hurls his crown in a whirling arc!', game.turnCount, '#ff6a6a');
        const result = resolveCombat(game, boss, player, { baseDamage: ENEMY_BASE_ATTACK, damageType: 'magic', weaponMultiplier: 1.4 });
        addHitFeedback(game, player, result, 'enemy');
        if (result.killed) {
          game.messageLog.add('You have been slain by the Rat King!', game.turnCount);
          if (handlePlayerDeath(game, boss.name)) return true;
        } else if (!result.dodged && !result.blocked) {
          game.messageLog.add(`The crown strikes you for ${result.damage} damage!`, game.turnCount);
        }
        if (game.audio) game.audio.playerHurt();
        return true;
      }
      return false;
    }
    case 'bone_lord': {
      const corpses = game.corpses || [];
      const idx = corpses.findIndex(c => Math.abs(c.x - boss.position.x) + Math.abs(c.y - boss.position.y) <= 6 && isTileFree(game, c.x, c.y));
      const minions = game.map.entities.filter(e => e.type === 'enemy' && e.isAlive() && e.isSummonedMinion).length;
      if (idx !== -1 && minions < 8) {
        const corpse = corpses.splice(idx, 1)[0];
        const st = boss.summonTemplate || { name: 'Skeleton', spriteKey: 'skeleton', stats: { STR: 5, DEX: 4, CON: 4, INT: 2, WIS: 2, LCK: 2 }, maxHp: 28 };
        const risen = new Entity({
          id: `risen_${Date.now()}_${Math.random()}`, type: 'enemy', x: corpse.x, y: corpse.y,
          stats: { ...st.stats }, maxHp: st.maxHp, speed: 100, behavior: 'rushdown', name: 'Bone Minion',
        });
        risen.spriteKey = st.spriteKey;
        risen.isSummonedMinion = true;
        risen.summonedBy = boss.id;
        risen.alerted = true;
        game.map.entities.push(risen);
        game.turnSystem.addEntity(risen);
        game.messageLog.add(`The Bone Lord raises the fallen ${corpse.name} as a Bone Minion!`, game.turnCount, '#ff6a6a');
        if (game.audio) game.audio.magicCast();
        return true;
      }
      return false;
    }
    case 'void_tyrant': {
      const stage = hpRatio <= 0.33 ? 2 : hpRatio <= 0.66 ? 1 : 0;
      if (stage > (boss.enrageStage || 0)) {
        boss.enrageStage = stage;
        boss.speed = Math.floor(boss.speed * 1.15);
        game.messageLog.add(stage === 1 ? 'The Void Tyrant roars. The air tears around it.' : 'The Void Tyrant is unleashed!', game.turnCount, '#ff6a6a');
        if (game.audio) game.audio.bossEntrance();
      }
      // charge: straight line, 2-4 tiles, clear path
      if (dist >= 2 && dist <= 4 && (boss.position.x === player.position.x || boss.position.y === player.position.y)) {
        const dx = Math.sign(player.position.x - boss.position.x);
        const dy = Math.sign(player.position.y - boss.position.y);
        let clear = true;
        for (let step = 1; step < dist; step++) {
          if (!isTileFree(game, boss.position.x + dx * step, boss.position.y + dy * step)) { clear = false; break; }
        }
        if (clear) {
          boss.moveTo(player.position.x - dx, player.position.y - dy);
          game.messageLog.add('The Void Tyrant charges!', game.turnCount, '#ff6a6a');
          const result = resolveCombat(game, boss, player, { baseDamage: ENEMY_BASE_ATTACK, damageType: 'melee', weaponMultiplier: 1.5 });
          addHitFeedback(game, player, result, 'enemy');
          if (result.killed) {
            game.messageLog.add('You have been slain by the Void Tyrant!', game.turnCount);
            if (handlePlayerDeath(game, boss.name)) return true;
          } else if (result.dodged) {
            game.messageLog.add('You sidestep the charge!', game.turnCount);
          } else {
            game.messageLog.add(`The charge slams you for ${result.damage} damage!`, game.turnCount);
          }
          if (game.audio) game.audio.playerHurt();
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

export function processEnemyTurn(game, entity) {
  // Stun: skip turn
  if (entity.hasStatusEffect?.('stunned')) {
    entity.spendTurn();
    return;
  }

  // an enemy standing where the player can see it knows the player is there
  if (!entity.hidden && game.map.isVisible(entity.position.x, entity.position.y)) entity.alerted = true;

  if (entity.isFloorBoss && entity.bossKey) {
    if (runBossMechanic(game, entity)) {
      entity.spendTurn();
      return;
    }
    if (game.state !== 'playing') return;
  }

  // an invisible player cannot be targeted: enemies wander instead
  let action;
  if (game.player.hasStatusEffect?.('invisible')) {
    const behavior = entity.behavior;
    entity.behavior = 'wander';
    action = getAIAction(entity, game.player, game.map, game.map.entities);
    entity.behavior = behavior;
  } else {
    action = getAIAction(entity, game.player, game.map, game.map.entities);
  }

  if (action.type === 'move') {
    entity.moveTo(action.x, action.y);
  } else if (action.type === 'attack') {
    addProjectileForDamageType(game, entity, game.player, action.damageType || 'melee');
    const result = resolveCombat(game, entity, game.player, {
      baseDamage: ENEMY_BASE_ATTACK,
      damageType: action.damageType || 'melee',
      weaponMultiplier: 1.0
    });
    addHitFeedback(game, game.player, result, 'enemy');

    if (result.dodged) {
      game.messageLog.add(`You dodge the ${entity.name}'s attack!`, game.turnCount);
    } else if (result.countered) {
      game.messageLog.add(`Counterspell! You negate the ${entity.name}'s spell.`, game.turnCount, '#7ad1d1');
    } else if (result.blocked) {
      game.messageLog.add(`You block the ${entity.name}'s attack!`, game.turnCount);
    } else if (result.killed) {
      game.messageLog.add(`You have been slain by the ${entity.name}!`, game.turnCount);
      handlePlayerDeath(game, entity.name);
    } else {
      const critMsg = result.crit ? ' (CRITICAL!)' : '';
      game.messageLog.add(`The ${entity.name} hits you for ${result.damage} damage!${critMsg}`, game.turnCount);
    }
    if (result.thornsDamage > 0) {
      game.messageLog.add(`Thorns reflect ${result.thornsDamage} damage back to ${entity.name}!`, game.turnCount);
      if (!entity.isAlive()) {
        game.messageLog.add(`${entity.name} was killed by thorns!`, game.turnCount);
        handleEnemyDeath(game, entity);
      }
    }

    // Retaliation
    if (result.hit && !result.killed && (action.damageType || 'melee') === 'melee' &&
        game.treePassiveEffects?.retaliation_chance > 0 && entity.isAlive()) {
      if (Math.random() < game.treePassiveEffects.retaliation_chance) {
        const retResult = resolveCombat(game, game.player, entity, {
          baseDamage: PLAYER_BASE_ATTACK,
          damageType: 'melee',
          weaponMultiplier: getPlayerWeaponMultiplier(game.player, 'melee') * 0.5,
        });
        if (retResult.hit) {
          game.messageLog.add(`You retaliate for ${retResult.damage} damage!`, game.turnCount);
          addHitFeedback(game, entity, retResult, 'player');
          if (retResult.killed) {
            handleEnemyDeath(game, entity);
          }
        }
      }
    }

    if (game.audio) game.audio.playerHurt();
  } else if (action.type === 'summon') {
    const st = entity.summonTemplate || { name: 'Minion', spriteKey: 'rat', stats: { STR: 2, DEX: 2, CON: 2, INT: 1, WIS: 1, LCK: 1 }, maxHp: 12 };
    const minionId = `minion_${Date.now()}_${Math.random()}`;
    const minion = new Entity({
      id: minionId,
      type: 'enemy',
      x: action.spawnX,
      y: action.spawnY,
      stats: { ...st.stats },
      maxHp: st.maxHp,
      speed: 100,
      behavior: 'rushdown',
      name: st.name,
    });
    minion.spriteKey = st.spriteKey;
    minion.isSummonedMinion = true;
    minion.summonedBy = entity.id;
    game.map.entities.push(minion);
    game.turnSystem.addEntity(minion);
    game.messageLog.add(`The ${entity.name} summons a ${minion.name}!`, game.turnCount);
    if (game.audio) game.audio.magicCast();
  }

  entity.spendTurn();
}

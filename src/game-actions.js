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
import { rollMaterialDrop, getBossKillMaterials, MATERIAL_COLORS } from './resources.js';
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
        dropItemAtPlayer(game, removed);
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
    dropItemAtPlayer(game, item);
    if (game.audio) game.audio.uiClick();
  }
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
      return `${item.name} shrouds you briefly.`;
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
    game.messageLog.add(`${skill.name} is on cooldown (${skill.currentCooldown}).`, game.turnCount);
    return false;
  }

  // Self-targeted skills (buffs/heals) don't need enemy targets
  if (skill.skillType === 'self') {
    if (!useSkill(skill)) return false;
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

  if (!useSkill(skill)) return false;
  syncClassSkillCooldown(game.player);

  let totalDamage = 0;
  let killCount = 0;
  let dodgeCount = 0;
  const damageType = skill.statScaling === 'DEX' ? 'ranged' : skill.statScaling === 'INT' ? 'magic' : 'melee';
  const weaponMultiplier = getPlayerWeaponMultiplier(game.player, damageType);

  for (const enemy of targets) {
    addProjectileForDamageType(game, game.player, enemy, damageType);
    const result = resolveCombat(game, game.player, enemy, {
      baseDamage: skill.damage,
      damageType,
      weaponMultiplier,
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

export function handleEnemyDeath(game, enemy) {
  game.turnSystem.removeEntity(enemy.id);
  game.runSummary.enemiesKilled++;
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
  } else if (Math.random() < 0.45) {
    const luck = getEntityStatsWithEquipment(game.player).LCK;
    const drop = Math.random() < 0.35
      ? generateConsumable(game.floorNumber)
      : generateItem({ floorLevel: game.floorNumber, luck, context: 'drop' });
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
    finalizeRun(game, 'a trap');
    game.captureRunItemsForHub(false);
    game.deathSplashFrames = 0;
    game.state = 'deathSplash';
    if (game.audio) game.audio.stopAmbient();
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
            finalizeRun(game, 'a trap');
            game.captureRunItemsForHub(false);
            game.deathSplashFrames = 0;
            game.state = 'deathSplash';
            if (game.audio) game.audio.stopAmbient();
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
              finalizeRun(game, 'a trap');
              game.captureRunItemsForHub(false);
              game.deathSplashFrames = 0;
              game.state = 'deathSplash';
              if (game.audio) game.audio.stopAmbient();
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

export function processEnemyTurn(game, entity) {
  // Stun: skip turn
  if (entity.hasStatusEffect?.('stunned')) {
    entity.spendTurn();
    return;
  }

  const action = getAIAction(entity, game.player, game.map, game.map.entities);

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
    } else if (result.killed) {
      game.messageLog.add(`You have been slain by the ${entity.name}!`, game.turnCount);
      finalizeRun(game, entity.name);
      game.captureRunItemsForHub(false);
      game.deathSplashFrames = 0;
      game.state = 'deathSplash';
      if (game.audio) game.audio.stopAmbient();
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

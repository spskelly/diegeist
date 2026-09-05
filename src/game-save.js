import { Entity } from './entity.js';
import { GameMap } from './game-map.js';
import { TurnSystem } from './turn-system.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { MessageLog } from './message-log.js';
import { createPlayer } from './player.js';
import { computeFOV } from './fov.js';
import { FOV_RADIUS } from './constants.js';
import { updateActiveSkills } from './skills.js';
import { addToInventory, autoEquipIfSlotEmpty, assignToBelt } from './inventory.js';
import { createStarterWeapon } from './items.js';
import { persistSaveData } from './progression.js';
import { createEmptyMaterials, scaleMaterials } from './resources.js';
import { resolvePassiveEffects } from './skill-tree.js';
import { cloneItem, clearCombatVfx, persistLastClassSelection, syncMilestoneAchievements, recalcPlayerMaxHp } from './game-utils.js';

function serializeItemSkill(skill) {
  if (!skill) return null;
  return { ...skill, area: skill.area ? { ...skill.area } : null };
}

export function serializeEntity(entity) {
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    position: { ...entity.position },
    stats: { ...entity.stats },
    hp: entity.hp,
    maxHp: entity.maxHp,
    speed: entity.speed,
    energy: entity.energy,
    behavior: entity.behavior,
    equipment: Object.fromEntries(
      Object.entries(entity.equipment).map(([slot, item]) => [slot, item ? { ...item, skill: serializeItemSkill(item.skill) } : null])
    ),
    inventory: entity.inventory.map(i => ({ ...i, skill: serializeItemSkill(i.skill) })),
    belt: entity.belt.map(i => i ? { ...i } : null),
    skillSlotBindings: [...(entity.skillSlotBindings || [null, null, null])],
    activeBlessings: [...(entity.activeBlessings || [])],
    statusEffects: (entity.statusEffects || []).map(e => ({ ...e })),
    // Player-specific
    playerClass: entity.playerClass || null,
    affinityStats: entity.affinityStats ? [...entity.affinityStats] : null,
    gold: entity.gold || 0,
    floorNumber: entity.floorNumber || 1,
    classSkillCooldown: entity.classSkillCooldown || 0,
    // Enemy-specific
    spriteKey: entity.spriteKey || null,
    isElite: entity.isElite || false,
    summonCooldown: entity.summonCooldown ?? null,
    isFloorBoss: entity.isFloorBoss || false,
    isSummonedMinion: entity.isSummonedMinion || false,
    summonedBy: entity.summonedBy || null,
    renderScale: entity.renderScale || null,
    auraColor: entity.auraColor || null,
    summonTemplate: entity.summonTemplate || null,
  };
}

export function deserializeEntity(data) {
  const entity = new Entity({
    id: data.id,
    type: data.type,
    x: data.position.x,
    y: data.position.y,
    stats: { ...data.stats },
    maxHp: data.maxHp,
    speed: data.speed,
    behavior: data.behavior,
    name: data.name,
  });
  entity.hp = data.hp;
  entity.energy = data.energy;
  entity.equipment = {};
  for (const [slot, item] of Object.entries(data.equipment)) {
    entity.equipment[slot] = item ? { ...item, skill: serializeItemSkill(item.skill) } : null;
  }
  entity.inventory = (data.inventory || []).map(i => ({ ...i, skill: serializeItemSkill(i.skill) }));
  entity.belt = (data.belt || [null, null, null]).map(i => i ? { ...i } : null);
  entity.skillSlotBindings = data.skillSlotBindings || [null, null, null];
  entity.activeBlessings = data.activeBlessings || [];
  entity.statusEffects = (data.statusEffects || []).map(e => ({ ...e }));
  if (data.playerClass) {
    entity.playerClass = data.playerClass;
    entity.affinityStats = data.affinityStats || [];
    entity.gold = data.gold || 0;
    entity.floorNumber = data.floorNumber || 1;
    entity.classSkillCooldown = data.classSkillCooldown || 0;
  }
  if (data.spriteKey) entity.spriteKey = data.spriteKey;
  if (data.isElite) entity.isElite = data.isElite;
  if (data.summonCooldown != null) entity.summonCooldown = data.summonCooldown;
  if (data.isFloorBoss) entity.isFloorBoss = data.isFloorBoss;
  if (data.isSummonedMinion) entity.isSummonedMinion = data.isSummonedMinion;
  if (data.summonedBy) entity.summonedBy = data.summonedBy;
  if (data.renderScale) entity.renderScale = data.renderScale;
  if (data.auraColor) entity.auraColor = data.auraColor;
  if (data.summonTemplate) entity.summonTemplate = data.summonTemplate;
  return entity;
}

export function saveRunState(game) {
  const snapshot = {
    version: 1,
    player: serializeEntity(game.player),
    map: {
      width: game.map.width,
      height: game.map.height,
      tiles: game.map.tiles,
      explored: game.map.explored,
      rooms: game.map.rooms,
      entities: game.map.entities.filter(e => e.type !== 'player' && e.isAlive()).map(e => serializeEntity(e)),
      items: game.map.items.map(i => ({ ...i })),
    },
    floorNumber: game.floorNumber,
    turnCount: game.turnCount,
    regenCounter: game.regenCounter,
    runSummary: { ...game.runSummary },
    runMaterials: game.runMaterials ? { ...game.runMaterials } : createEmptyMaterials(),
    currentRank: game.currentRank || 1,
    selectedClass: game.selectedClass,
    messageLog: game.messageLog.messages.slice(),
  };
  localStorage.setItem('diegeist.run.v1', JSON.stringify(snapshot));
}

export function loadRunState(game) {
  const raw = localStorage.getItem('diegeist.run.v1');
  if (!raw) return false;
  localStorage.removeItem('diegeist.run.v1');

  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (_e) {
    return false;
  }

  // Rebuild map
  game.map = new GameMap(snapshot.map.width, snapshot.map.height);
  game.map.tiles = snapshot.map.tiles;
  game.map.explored = snapshot.map.explored;
  game.map.rooms = snapshot.map.rooms || [];
  game.map.items = snapshot.map.items || [];

  // Rebuild player
  game.player = deserializeEntity(snapshot.player);
  updateActiveSkills(game.player);

  // Rebuild enemies
  game.map.entities = [game.player];
  game.turnSystem = new TurnSystem();
  game.turnSystem.addEntity(game.player);
  for (const eData of snapshot.map.entities) {
    const enemy = deserializeEntity(eData);
    game.map.entities.push(enemy);
    game.turnSystem.addEntity(enemy);
  }

  // Restore game state
  game.floorNumber = snapshot.floorNumber;
  game.turnCount = snapshot.turnCount;
  game.regenCounter = snapshot.regenCounter || 0;
  game.runSummary = snapshot.runSummary || { classKey: game.selectedClass, floorsReached: 1, enemiesKilled: 0, currencyEarned: 0, causeOfDeath: null };
  game.selectedClass = snapshot.selectedClass;
  game.runFinalized = false;
  game.inventoryOpen = false;
  game.statsOpen = false;
  game.mapOpen = false;
  // run-scoped state that older saves did not carry
  game.runMaterials = { ...createEmptyMaterials(), ...(snapshot.runMaterials || {}) };
  game.currentRank = snapshot.currentRank || 1;
  game.treeRegenCounter = 0;
  const investments = game.saveData?.skillInvestments?.[game.player.playerClass] || {};
  game.treePassiveEffects = resolvePassiveEffects(game.player.playerClass, investments);
  recalcPlayerMaxHp(game);
  clearCombatVfx(game);

  // Restore message log
  game.messageLog = new MessageLog();
  for (const msg of (snapshot.messageLog || [])) {
    game.messageLog.add(msg.text, msg.turn);
  }
  game.messageLog.add('Run resumed.', game.turnCount);

  // Rebuild visuals
  game.camera = new Camera(game.canvas.width, game.canvas.height - game.hud.hudHeight, game.getCameraZoom());
  game.renderer = new Renderer(game.canvas, game.sprites, game.camera);
  computeFOV(game.map, game.player.position.x, game.player.position.y, FOV_RADIUS);
  game.state = 'playing';
  game.resizeCanvas();
  return true;
}

export function hasSavedRun() {
  return localStorage.getItem('diegeist.run.v1') !== null;
}

export function startNewRun(game) {
  persistLastClassSelection(game);
  game.messageLog = new MessageLog();
  game.turnSystem = new TurnSystem();
  clearCombatVfx(game);
  game.player = null;
  game.map = null;
  game.turnCount = 0;
  game.floorNumber = 1;
  game.regenCounter = 0;
  game.runFinalized = false;
  game.inventoryOpen = false;
  game.statsOpen = false;
  game.mapOpen = false;
  game.inventorySection = 'equipment';
  game.inventoryCursorByTab = { inventory: 0, equipment: 0 };
  game.deathSplashFrames = 0;
  game.postDeathMenuIndex = 0;
  game.hubRunCarryover = [];
  game.hubCanStashMultipleFromRun = false;
  game.hubStashedFromRunCount = 0;
  game.runSummary = {
    classKey: game.selectedClass,
    floorsReached: 1,
    enemiesKilled: 0,
    currencyEarned: 0,
    causeOfDeath: null,
  };
  game.runMaterials = createEmptyMaterials();
  game.currentRank = 1;
  game.treePassiveEffects = null;
  game.treeRegenCounter = 0;
  game.startFloor();
  game.state = 'playing';
  if (game.audio) game.audio.uiClick();
}

export function finalizeRun(game, causeOfDeath) {
  if (game.runFinalized || !game.saveData) return;
  game.runFinalized = true;
  game.runSummary.causeOfDeath = causeOfDeath;
  game.runSummary.floorsReached = Math.max(game.runSummary.floorsReached, game.floorNumber);
  syncMilestoneAchievements(game);
  game.saveData.addCurrency(game.runSummary.currencyEarned);
  // Commit run materials: 100% on victory, 50% on death
  if (game.runMaterials) {
    const isVictory = causeOfDeath === 'Victory';
    const mats = isVictory ? game.runMaterials : scaleMaterials(game.runMaterials, 0.5);
    game.saveData.addMaterials(mats);
    game.committedMaterials = { ...mats };
    game.rawRunMaterials = { ...game.runMaterials };
  }
  game.saveData.addRunHistory({
    classKey: game.runSummary.classKey,
    floorsReached: game.runSummary.floorsReached,
    enemiesKilled: game.runSummary.enemiesKilled,
    currencyEarned: game.runSummary.currencyEarned,
    causeOfDeath: game.runSummary.causeOfDeath,
    materialsGained: game.runMaterials ? { ...game.runMaterials } : null,
  });
  persistSaveData(game.saveData);
}

export function applyStarterLoadout(game) {
  if (!game.player) return;
  const starterWeapon = createStarterWeapon(game.player.playerClass);
  if (!starterWeapon) return;

  game.player.equipment[starterWeapon.slot] = starterWeapon;
  game.messageLog.add(`You begin with ${starterWeapon.name}.`, game.turnCount);
}

export function applyPendingHubLoadout(game) {
  if (!game.player || !game.saveData) return;

  if (game.pendingStashLoadoutItem) {
    const stashItem = cloneItem(game.pendingStashLoadoutItem);
    stashItem.id = `stash_loadout_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    if (addToInventory(game.player, stashItem)) {
      if (stashItem.slot && autoEquipIfSlotEmpty(game.player, stashItem.id)) {
        updateActiveSkills(game.player);
        recalcPlayerMaxHp(game);
        game.messageLog.add(`Stash loadout equipped: ${stashItem.name}.`, game.turnCount);
      } else {
        game.messageLog.add(`Stash loadout added: ${stashItem.name}.`, game.turnCount);
      }
    }
    game.pendingStashLoadoutItem = null;
    game.saveData.pendingLoadoutItem = null;
  }

  if (!Array.isArray(game.saveData.pendingRunPurchases) || game.saveData.pendingRunPurchases.length === 0) return;

  const queued = game.saveData.pendingRunPurchases.slice();
  game.saveData.pendingRunPurchases = [];
  for (const purchaseId of queued) {
    if (purchaseId === 'starting_sword') {
      const sword = makeCommonSword();
      if (!addToInventory(game.player, sword)) continue;
      if (autoEquipIfSlotEmpty(game.player, sword.id)) {
        updateActiveSkills(game.player);
        recalcPlayerMaxHp(game);
      }
      game.messageLog.add('Shop bonus applied: Common Sword.', game.turnCount);
    } else if (purchaseId === 'starting_potions') {
      let granted = 0;
      for (let i = 0; i < 3; i++) {
        const potion = makeMinorHealthPotion();
        if (!addToInventory(game.player, potion)) break;
        granted++;
        const freeBeltSlot = game.player.belt.findIndex(s => s === null);
        if (freeBeltSlot !== -1) assignToBelt(game.player, potion.id, freeBeltSlot);
      }
      if (granted > 0) game.messageLog.add(`Shop bonus applied: ${granted}x Minor Health Potion.`, game.turnCount);
    }
  }
  persistSaveData(game.saveData);
}

export function makeCommonSword() {
  return {
    id: `shop_item_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name: 'Common Sword',
    type: 'weapon',
    rarity: 'common',
    slot: 'leftHand',
    statBonuses: { STR: 1 },
    skill: null,
    floorLevel: 1,
    description: 'A basic sword purchased from the hub.',
    sprite: 'sword',
  };
}

export function makeMinorHealthPotion() {
  return {
    id: `shop_item_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name: 'Minor Health Potion',
    type: 'consumable',
    rarity: 'common',
    slot: null,
    statBonuses: {},
    skill: null,
    effect: 'heal',
    magnitude: 0.25,
    floorLevel: 1,
    description: 'Minor Health Potion.',
    sprite: 'consumable',
    stackable: true,
  };
}

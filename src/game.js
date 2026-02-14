import { GameMap } from './game-map.js';
import { createPlayer } from './player.js';
import { TurnSystem } from './turn-system.js';
import { Camera } from './camera.js';
import { computeFOV } from './fov.js';
import { MessageLog } from './message-log.js';
import { InputHandler } from './input.js';
import { SpriteRegistry } from './sprites.js';
import { Renderer } from './renderer.js';
import { HUD } from './hud.js';
import { TILE, FOV_RADIUS, PLAYER_CLASSES, STAT_NAMES } from './constants.js';
import { Entity } from './entity.js';
import { generateDungeon } from './dungeon-gen.js';
import { resolveAttack } from './combat.js';
import { getAIAction } from './ai.js';
import { generateItem, generateConsumable, createStarterWeapon } from './items.js';
import {
  addToInventory,
  assignToBelt,
  autoEquipIfSlotEmpty,
  equipItem,
  getEquippedStats,
  refillBeltSlotWithMatchingConsumable,
  removeFromInventory,
  unequipItem,
  useBeltSlot
} from './inventory.js';
import { canUseSkill, tickCooldowns, updateActiveSkills, useSkill } from './skills.js';
import { ACHIEVEMENTS, HubShop, loadSaveData, persistSaveData } from './progression.js';
import { AudioManager } from './audio.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'init';
    this.messageLog = new MessageLog();
    this.input = new InputHandler();
    this.turnSystem = new TurnSystem();
    this.sprites = new SpriteRegistry();
    this.player = null;
    this.map = null;
    this.camera = null;
    this.renderer = null;
    this.hud = null;
    this.turnCount = 0;
    this.floorNumber = 1;
    this.saveData = null;
    this.audio = null;
    this.runSummary = null;
    this.runFinalized = false;
    this.inventoryOpen = false;
    this.statsOpen = false;
    this.inventoryTab = 'inventory';
    this.inventoryCursorByTab = { inventory: 0, equipment: 0 };
    this.regenCounter = 0;
    this.classOrder = Object.keys(PLAYER_CLASSES);
    this.selectedClass = this.classOrder[0] || 'fighter';
    this.startMenuIndex = 0;
    this.postDeathMenuIndex = 0;
    this.deathSplashFrames = 0;
    this.hubMenuIndex = 0;
    this.hubShopCursor = 0;
    this.hubStashCursor = 0;
    this.hubRunItemsCursor = 0;
    this.hubAchievementsCursor = 0;
    this.hubStashPane = 'stash';
    this.hubNotice = '';
    this.hubRunCarryover = [];
    this.hubCanStashMultipleFromRun = false;
    this.hubStashedFromRunCount = 0;
    this.pendingStashLoadoutItem = null;
    this.hubShop = new HubShop();
    this.combatVfx = { floatingTexts: [], projectiles: [] };
  }

  init() {
    this.saveData = loadSaveData();
    if (this.saveData?.settings?.lastClass && this.classOrder.includes(this.saveData.settings.lastClass)) {
      this.selectedClass = this.saveData.settings.lastClass;
    }
    this.startMenuIndex = Math.max(0, this.classOrder.indexOf(this.selectedClass));
    this.runSummary = {
      classKey: this.selectedClass,
      floorsReached: 1,
      enemiesKilled: 0,
      currencyEarned: 0,
      causeOfDeath: null,
    };

    this.audio = new AudioManager();
    this.audio.init();
    this.audio.setVolume(this.saveData.settings?.volume ?? 0.7);
    if (!Array.isArray(this.saveData.pendingRunPurchases)) this.saveData.pendingRunPurchases = [];
    this.refreshHubShop();

    this.resizeCanvas();
    this.sprites.init();
    this.hud = new HUD(this.ctx, this.canvas.width, this.canvas.height);
    this.camera = new Camera(this.canvas.width, this.canvas.height - this.hud.hudHeight, this.getCameraZoom());
    this.renderer = new Renderer(this.canvas, this.sprites, this.camera);
    this.input.start();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    this.state = 'startMenu';
    this.loop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.hud) this.hud.resize(this.canvas.width, this.canvas.height);
    if (this.camera) {
      this.camera.setZoom(this.getCameraZoom());
      this.camera.resize(this.canvas.width, this.canvas.height - (this.hud?.hudHeight || 80));
      if (this.map && this.player) {
        this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
      }
    }
  }

  getCameraZoom() {
    const usableHeight = this.canvas.height - (this.hud?.hudHeight || 80);
    const minDimension = Math.min(this.canvas.width, usableHeight);
    if (minDimension >= 900) return 3;
    if (minDimension >= 600) return 2;
    return 1;
  }

  getEntityStatsWithEquipment(entity) {
    const stats = { ...entity.stats };
    const bonuses = getEquippedStats(entity);
    for (const [stat, value] of Object.entries(bonuses)) {
      stats[stat] = (stats[stat] || 0) + value;
    }
    return stats;
  }

  resolveCombat(attacker, defender, options) {
    const originalAttackerStats = attacker.stats;
    const originalDefenderStats = defender.stats;

    attacker.stats = this.getEntityStatsWithEquipment(attacker);
    defender.stats = this.getEntityStatsWithEquipment(defender);

    try {
      return resolveAttack(attacker, defender, options);
    } finally {
      attacker.stats = originalAttackerStats;
      defender.stats = originalDefenderStats;
    }
  }

  getRarityDamageBonus(rarity) {
    const table = {
      common: 0,
      uncommon: 0.06,
      rare: 0.14,
      epic: 0.24,
      legendary: 0.38,
    };
    return table[rarity] || 0;
  }

  getRarityColor(rarity, fallback = '#c3cbd4') {
    const colors = {
      common: '#c3cbd4',
      uncommon: '#79d27e',
      rare: '#6fb4ff',
      epic: '#ff8f5b',
      legendary: '#ffd36a',
    };
    return colors[rarity] || fallback;
  }

  cloneItem(item) {
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

  refreshHubShop() {
    if (!this.hubShop) this.hubShop = new HubShop();
    this.hubShop.generate(this.saveData?.shopPurchases || []);
    this.hubShopCursor = 0;
  }

  enterHubMenu(notice = '') {
    this.state = 'hubMenu';
    this.hubMenuIndex = 0;
    this.hubStashPane = 'stash';
    this.hubStashCursor = 0;
    this.hubRunItemsCursor = 0;
    this.hubAchievementsCursor = 0;
    if (notice) this.hubNotice = notice;
    this.refreshHubShop();
    if (this.audio) this.audio.uiClick();
  }

  captureRunItemsForHub(victory = false) {
    const sourceItems = [];
    if (this.player) {
      for (const item of this.player.inventory) {
        sourceItems.push(this.cloneItem(item));
      }
      for (const item of Object.values(this.player.equipment)) {
        if (item) sourceItems.push(this.cloneItem(item));
      }
    }
    this.hubRunCarryover = sourceItems;
    this.hubCanStashMultipleFromRun = !!victory;
    this.hubStashedFromRunCount = 0;
    this.hubRunItemsCursor = 0;
  }

  ensureAchievementRecord(achievementId) {
    if (!this.saveData.achievements[achievementId]) {
      this.saveData.achievements[achievementId] = { progress: 0, unlocked: false };
    }
    return this.saveData.achievements[achievementId];
  }

  applyAchievementBonus(achievement) {
    if (!achievement || !achievement.bonus || !this.saveData) return;
    const bonus = achievement.bonus;
    if (bonus.type === 'stat' && bonus.stat && bonus.value) {
      this.saveData.addPermanentStat(bonus.stat, bonus.value);
      return;
    }
    if (bonus.type === 'unlock' && bonus.item) {
      if (!Array.isArray(this.saveData.shopPurchases)) this.saveData.shopPurchases = [];
      if (!this.saveData.shopPurchases.includes(`unlock:${bonus.item}`)) {
        this.saveData.shopPurchases.push(`unlock:${bonus.item}`);
      }
    }
  }

  addAchievementProgress(achievementId, amount = 1) {
    if (!this.saveData) return;
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;
    const record = this.ensureAchievementRecord(achievementId);
    const current = record.progress || 0;
    const next = Math.max(current, current + Math.max(0, amount));
    record.progress = next;
    if (!record.unlocked && next >= (achievement.condition?.count || 1)) {
      record.unlocked = true;
      this.applyAchievementBonus(achievement);
      if (this.state === 'playing') {
        this.messageLog.add(`Achievement unlocked: ${achievement.name}`, this.turnCount);
      } else {
        this.hubNotice = `Achievement unlocked: ${achievement.name}`;
      }
    }
  }

  setAchievementProgress(achievementId, value) {
    if (!this.saveData) return;
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;
    const record = this.ensureAchievementRecord(achievementId);
    const next = Math.max(record.progress || 0, Math.max(0, value));
    record.progress = next;
    if (!record.unlocked && next >= (achievement.condition?.count || 1)) {
      record.unlocked = true;
      this.applyAchievementBonus(achievement);
      this.hubNotice = `Achievement unlocked: ${achievement.name}`;
    }
  }

  syncMilestoneAchievements() {
    if (!this.saveData) return;
    if (this.floorNumber >= 5) {
      this.setAchievementProgress('descent', this.floorNumber);
    }
    if (this.floorNumber >= 10) {
      this.setAchievementProgress('deep_dweller', this.floorNumber);
    }
  }

  makeCommonSword() {
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

  makeMinorHealthPotion() {
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

  applyPendingHubLoadout() {
    if (!this.player || !this.saveData) return;

    if (this.pendingStashLoadoutItem) {
      const stashItem = this.cloneItem(this.pendingStashLoadoutItem);
      stashItem.id = `stash_loadout_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      if (addToInventory(this.player, stashItem)) {
        if (stashItem.slot && autoEquipIfSlotEmpty(this.player, stashItem.id)) {
          updateActiveSkills(this.player);
          this.messageLog.add(`Stash loadout equipped: ${stashItem.name}.`, this.turnCount);
        } else {
          this.messageLog.add(`Stash loadout added: ${stashItem.name}.`, this.turnCount);
        }
      }
      this.pendingStashLoadoutItem = null;
    }

    if (!Array.isArray(this.saveData.pendingRunPurchases) || this.saveData.pendingRunPurchases.length === 0) return;

    const queued = this.saveData.pendingRunPurchases.slice();
    this.saveData.pendingRunPurchases = [];
    for (const purchaseId of queued) {
      if (purchaseId === 'starting_sword') {
        const sword = this.makeCommonSword();
        if (!addToInventory(this.player, sword)) continue;
        if (autoEquipIfSlotEmpty(this.player, sword.id)) {
          updateActiveSkills(this.player);
        }
        this.messageLog.add('Shop bonus applied: Common Sword.', this.turnCount);
      } else if (purchaseId === 'starting_potions') {
        let granted = 0;
        for (let i = 0; i < 3; i++) {
          const potion = this.makeMinorHealthPotion();
          if (!addToInventory(this.player, potion)) break;
          granted++;
          const freeBeltSlot = this.player.belt.findIndex(s => s === null);
          if (freeBeltSlot !== -1) assignToBelt(this.player, potion.id, freeBeltSlot);
        }
        if (granted > 0) this.messageLog.add(`Shop bonus applied: ${granted}x Minor Health Potion.`, this.turnCount);
      }
    }
    persistSaveData(this.saveData);
  }

  getInventoryCapacity() {
    return 12;
  }

  getInventoryGridColumns() {
    return 4;
  }

  truncateLabel(text, maxChars = 12) {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(1, maxChars - 1))}.`;
  }

  drawInventoryItemIcon(ctx, item, x, y, size) {
    if (!item) return;

    const sprite = item.sprite ? this.sprites.get(item.sprite) : null;
    if (sprite) {
      ctx.drawImage(sprite, x, y, size, size);
      return;
    }

    const px = Math.floor(x);
    const py = Math.floor(y);
    const s = Math.floor(size);
    const inner = Math.max(2, Math.floor(s * 0.2));
    const w = s - inner * 2;
    const h = s - inner * 2;

    if (item.type === 'weapon') {
      ctx.fillStyle = '#e4c580';
      ctx.fillRect(px + inner + Math.floor(w * 0.52), py + inner, Math.max(2, Math.floor(w * 0.16)), h);
      ctx.fillStyle = '#7d5b3f';
      ctx.fillRect(px + inner + Math.floor(w * 0.45), py + inner + Math.floor(h * 0.58), Math.max(2, Math.floor(w * 0.3)), Math.max(2, Math.floor(h * 0.18)));
      return;
    }

    if (item.type === 'armor') {
      ctx.fillStyle = '#95b0c9';
      if (item.slot === 'head') {
        ctx.fillRect(px + inner + Math.floor(w * 0.2), py + inner + Math.floor(h * 0.2), Math.floor(w * 0.6), Math.floor(h * 0.45));
        ctx.fillRect(px + inner + Math.floor(w * 0.3), py + inner + Math.floor(h * 0.62), Math.floor(w * 0.4), Math.floor(h * 0.18));
      } else if (item.slot === 'legs') {
        ctx.fillRect(px + inner + Math.floor(w * 0.25), py + inner + Math.floor(h * 0.15), Math.floor(w * 0.2), Math.floor(h * 0.7));
        ctx.fillRect(px + inner + Math.floor(w * 0.55), py + inner + Math.floor(h * 0.15), Math.floor(w * 0.2), Math.floor(h * 0.7));
      } else {
        ctx.fillRect(px + inner + Math.floor(w * 0.18), py + inner + Math.floor(h * 0.12), Math.floor(w * 0.64), Math.floor(h * 0.76));
      }
      return;
    }

    if (item.type === 'accessory') {
      ctx.strokeStyle = '#e9d48e';
      ctx.lineWidth = Math.max(2, Math.floor(s * 0.09));
      ctx.beginPath();
      ctx.arc(px + Math.floor(s / 2), py + Math.floor(s / 2), Math.floor(w * 0.32), 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (item.type === 'consumable') {
      const effectColor = item.effect === 'heal'
        ? '#63d676'
        : item.effect === 'aoe_damage'
          ? '#ff9152'
          : item.effect === 'teleport'
            ? '#c092ff'
            : item.effect === 'speed_boost'
              ? '#ffd45a'
              : '#7dc9ff';
      ctx.fillStyle = effectColor;
      ctx.fillRect(px + inner + Math.floor(w * 0.3), py + inner + Math.floor(h * 0.15), Math.floor(w * 0.4), Math.floor(h * 0.62));
      ctx.fillStyle = '#d9e3ef';
      ctx.fillRect(px + inner + Math.floor(w * 0.38), py + inner, Math.floor(w * 0.24), Math.floor(h * 0.16));
      return;
    }

    ctx.fillStyle = '#8da1b5';
    ctx.fillRect(px + inner, py + inner, w, h);
  }

  getPlayerWeaponMultiplier(damageType) {
    if (!this.player) return 1.0;
    const statByType = {
      melee: 'STR',
      ranged: 'DEX',
      magic: 'INT',
    };
    const relevantStat = statByType[damageType] || 'STR';
    const weapons = [this.player.equipment.leftHand, this.player.equipment.rightHand]
      .filter(item => item && item.type === 'weapon');
    if (weapons.length === 0) return 1.0;

    const bestWeapon = weapons.reduce((best, current) => {
      if (!best) return current;
      const bestScore = (best.statBonuses?.[relevantStat] || 0) + this.getRarityDamageBonus(best.rarity);
      const currentScore = (current.statBonuses?.[relevantStat] || 0) + this.getRarityDamageBonus(current.rarity);
      return currentScore > bestScore ? current : best;
    }, null);

    const statBonus = bestWeapon?.statBonuses?.[relevantStat] || 0;
    const rarityBonus = this.getRarityDamageBonus(bestWeapon?.rarity);
    return 1 + statBonus * 0.03 + rarityBonus;
  }

  getEnemyBaseTemplatesForFloor() {
    const floor = this.floorNumber;
    return [
      {
        name: 'Rat',
        maxHp: 5,
        speed: 100,
        stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 },
        spriteKey: 'rat',
        behavior: 'rushdown',
        weight: Math.max(12, 52 - floor * 3),
      },
      {
        name: 'Bat',
        maxHp: 3,
        speed: 145,
        stats: { STR: 2, DEX: 3, CON: 2, INT: 1, WIS: 1, LCK: 3 },
        spriteKey: 'bat',
        behavior: 'rushdown',
        weight: 22 + floor * 1.2,
      },
      {
        name: 'Shade',
        maxHp: 6,
        speed: 120,
        stats: { STR: 4, DEX: 4, CON: 3, INT: 2, WIS: 2, LCK: 3 },
        spriteKey: 'trap',
        behavior: 'ambush',
        weight: 16 + floor * 1.8,
      },
      {
        name: 'Cultist',
        maxHp: 7,
        speed: 90,
        stats: { STR: 2, DEX: 2, CON: 4, INT: 5, WIS: 4, LCK: 2 },
        spriteKey: 'cultist',
        behavior: 'summoner',
        weight: 10 + floor * 1.9,
      },
    ];
  }

  chooseWeightedEnemyTemplate(templates) {
    const totalWeight = templates.reduce((sum, t) => sum + Math.max(1, t.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    for (const template of templates) {
      roll -= Math.max(1, template.weight || 1);
      if (roll <= 0) return template;
    }
    return templates[templates.length - 1];
  }

  scaleEnemyTemplate(template) {
    const floor = this.floorNumber;
    const statScale = 1 + Math.max(0, floor - 1) * 0.06;
    const hpScale = 1 + Math.max(0, floor - 1) * 0.11;
    const speedScale = 1 + Math.max(0, floor - 1) * 0.01;
    const scaledStats = {};
    for (const [stat, value] of Object.entries(template.stats)) {
      scaledStats[stat] = Math.max(1, Math.floor(value * statScale));
    }

    const enemy = {
      ...template,
      stats: scaledStats,
      maxHp: Math.max(template.maxHp + floor - 1, Math.floor(template.maxHp * hpScale)),
      speed: Math.max(70, Math.floor(template.speed * speedScale)),
      isElite: false,
    };

    const eliteChance = Math.min(0.32, 0.03 + floor * 0.014);
    if (Math.random() < eliteChance) {
      enemy.isElite = true;
      enemy.name = `Elite ${enemy.name}`;
      enemy.maxHp = Math.floor(enemy.maxHp * 1.55);
      enemy.speed = Math.floor(enemy.speed * 1.08);
      for (const stat of Object.keys(enemy.stats)) {
        enemy.stats[stat] += 2 + Math.floor(floor / 6);
      }
    }

    return enemy;
  }

  spawnFloor10Boss() {
    const bossRoom = this.map.rooms.find(r => r.type === 'boss');
    if (!bossRoom) return false;
    const centerX = Math.floor(bossRoom.x + bossRoom.width / 2);
    const centerY = Math.floor(bossRoom.y + bossRoom.height / 2);
    const candidates = [
      { x: centerX, y: centerY },
      { x: centerX + 1, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX, y: centerY + 1 },
      { x: centerX, y: centerY - 1 },
      { x: centerX + 1, y: centerY + 1 },
      { x: centerX - 1, y: centerY - 1 },
    ];

    const spot = candidates.find(c =>
      this.map.isWalkable(c.x, c.y) &&
      !this.map.entities.some(e => e.isAlive() && e.position.x === c.x && e.position.y === c.y)
    );
    if (!spot) return false;

    const finalBoss = new Entity({
      id: `floor10_boss_${Date.now()}`,
      type: 'enemy',
      x: spot.x,
      y: spot.y,
      stats: { STR: 18, DEX: 10, CON: 16, INT: 12, WIS: 10, LCK: 8 },
      maxHp: 180,
      speed: 125,
      behavior: 'rushdown',
      name: 'Void Tyrant',
    });
    finalBoss.spriteKey = 'boss_tyrant';
    finalBoss.isFloorBoss = true;
    this.map.entities.push(finalBoss);
    this.turnSystem.addEntity(finalBoss);
    this.messageLog.add('A Void Tyrant rises in the boss chamber.', this.turnCount);
    if (this.audio) this.audio.bossEntrance();
    return true;
  }

  spawnFloorItems(rooms) {
    const itemCount = 2 + Math.floor(Math.random() * 3); // 2-4 items
    let spawned = 0;
    let attempts = 0;
    while (spawned < itemCount && attempts < 80) {
      attempts++;
      if (rooms.length === 0) break;

      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const x = room.x + Math.floor(Math.random() * room.width);
      const y = room.y + Math.floor(Math.random() * room.height);
      if (!this.map.isWalkable(x, y)) continue;

      const occupiedByEntity = this.map.entities.some(e => e.isAlive() && e.position.x === x && e.position.y === y);
      const occupiedByPlayer = this.player && this.player.position.x === x && this.player.position.y === y;
      const occupiedByItem = this.map.items.some(i => i.position.x === x && i.position.y === y);
      if (occupiedByEntity || occupiedByPlayer || occupiedByItem) continue;

      const item = Math.random() < 0.4
        ? generateConsumable(this.floorNumber)
        : generateItem({
          floorLevel: this.floorNumber,
          luck: this.getEntityStatsWithEquipment(this.player).LCK,
          context: 'drop',
        });
      this.map.items.push({ ...item, position: { x, y } });
      spawned++;
    }
  }

  getGroundItemIndexAt(x, y) {
    return this.map.items.findIndex(i => i.position.x === x && i.position.y === y);
  }

  handlePickupAction() {
    const x = this.player.position.x;
    const y = this.player.position.y;
    const itemIndex = this.getGroundItemIndexAt(x, y);
    if (itemIndex === -1) {
      this.messageLog.add('There is nothing here to pick up.', this.turnCount);
      return false;
    }

    const groundItem = this.map.items[itemIndex];
    const { position: _position, ...item } = groundItem;
    if (!addToInventory(this.player, item)) {
      this.messageLog.add('Your inventory is full.', this.turnCount);
      return false;
    }

    this.map.items.splice(itemIndex, 1);
    this.messageLog.add(`You pick up ${item.name}.`, this.turnCount);
    this.addFloatingText(x, y, item.name, this.getRarityColor(item.rarity, '#d6dce3'), 1050);
    if (this.audio) this.audio.itemPickup();

    if (item.slot && autoEquipIfSlotEmpty(this.player, item.id)) {
      updateActiveSkills(this.player);
      this.messageLog.add(`${item.name} auto-equipped to ${this.formatSlotName(item.slot)}.`, this.turnCount);
      if (this.audio) this.audio.uiClick();
      return true;
    }

    if (item.type === 'consumable') {
      const freeBeltSlot = this.player.belt.findIndex(s => s === null);
      if (freeBeltSlot !== -1) {
        assignToBelt(this.player, item.id, freeBeltSlot);
        this.messageLog.add(`${item.name} assigned to belt slot ${freeBeltSlot + 1}.`, this.turnCount);
      }
    }

    return true;
  }

  getEquipmentRows() {
    const slotOrder = ['head', 'torso', 'legs', 'leftHand', 'rightHand', 'accessory1', 'accessory2'];
    return slotOrder.map(slot => ({
      slot,
      item: this.player.equipment[slot],
    }));
  }

  formatSlotName(slot) {
    if (slot === 'leftHand') return 'Left Hand';
    if (slot === 'rightHand') return 'Right Hand';
    if (slot === 'accessory1') return 'Accessory 1';
    if (slot === 'accessory2') return 'Accessory 2';
    return slot.charAt(0).toUpperCase() + slot.slice(1);
  }

  clampInventoryCursor() {
    if (this.inventoryTab === 'inventory') {
      const maxIndex = this.getInventoryCapacity() - 1;
      const current = this.inventoryCursorByTab.inventory || 0;
      this.inventoryCursorByTab.inventory = Math.max(0, Math.min(current, maxIndex));
      return;
    }

    const rows = this.getEquipmentRows();
    const maxIndex = Math.max(0, rows.length - 1);
    const current = this.inventoryCursorByTab[this.inventoryTab] || 0;
    this.inventoryCursorByTab[this.inventoryTab] = Math.max(0, Math.min(current, maxIndex));
  }

  toggleInventoryOverlay() {
    this.inventoryOpen = !this.inventoryOpen;
    if (this.inventoryOpen) {
      this.statsOpen = false;
      this.inventoryTab = 'inventory';
      this.clampInventoryCursor();
      this.messageLog.add('Inventory open. Selected item details are shown on the right.', this.turnCount);
    }
    if (this.audio) this.audio.uiClick();
  }

  switchInventoryTab(direction = 0) {
    if (direction === 0) {
      this.inventoryTab = this.inventoryTab === 'inventory' ? 'equipment' : 'inventory';
    } else {
      this.inventoryTab = direction > 0 ? 'equipment' : 'inventory';
    }
    this.clampInventoryCursor();
    if (this.audio) this.audio.uiClick();
  }

  moveEquipmentCursor(delta) {
    const rows = this.getEquipmentRows();
    if (rows.length === 0) return;
    const current = this.inventoryCursorByTab[this.inventoryTab] || 0;
    const maxIndex = rows.length - 1;
    this.inventoryCursorByTab[this.inventoryTab] = Math.max(0, Math.min(current + delta, maxIndex));
    if (this.audio) this.audio.uiClick();
  }

  moveInventoryGridCursor(dx, dy) {
    const cols = this.getInventoryGridColumns();
    const capacity = this.getInventoryCapacity();
    const rows = Math.ceil(capacity / cols);
    const current = this.inventoryCursorByTab.inventory || 0;
    let row = Math.floor(current / cols);
    let col = current % cols;

    row = Math.max(0, Math.min(rows - 1, row + (dy || 0)));
    col = Math.max(0, Math.min(cols - 1, col + (dx || 0)));

    let next = row * cols + col;
    if (next >= capacity) next = capacity - 1;
    this.inventoryCursorByTab.inventory = next;
    if ((dx || 0) !== 0 || (dy || 0) !== 0) {
      if (this.audio) this.audio.uiClick();
    }
  }

  dropItemAtPlayer(item) {
    this.map.items.push({
      ...item,
      position: { x: this.player.position.x, y: this.player.position.y },
    });
    this.messageLog.add(`You drop ${item.name}.`, this.turnCount);
  }

  tryAssignSelectedInventoryItemToBelt(slot = null) {
    if (this.inventoryTab !== 'inventory') {
      this.messageLog.add('Switch to Items tab to assign belt slots.', this.turnCount);
      return false;
    }

    const idx = this.inventoryCursorByTab.inventory || 0;
    const item = this.player.inventory[idx];
    if (!item) return false;
    if (item.type !== 'consumable') {
      this.messageLog.add('Only consumables can go in the belt.', this.turnCount);
      return false;
    }

    let beltSlot = Number.isInteger(slot) ? slot : this.player.belt.findIndex(s => s === null);
    if (beltSlot === -1) beltSlot = 0;
    if (!assignToBelt(this.player, item.id, beltSlot)) return false;

    this.messageLog.add(`${item.name} assigned to belt slot ${beltSlot + 1}.`, this.turnCount);
    this.clampInventoryCursor();
    if (this.audio) this.audio.uiClick();
    return true;
  }

  handleInventoryOverlayAction(action) {
    if (action.type === 'inventory' || action.type === 'close') {
      this.inventoryOpen = false;
      if (this.audio) this.audio.uiClick();
      return;
    }

    if (action.type === 'inventoryTab') {
      this.switchInventoryTab(0);
      return;
    }

    if (action.type === 'move') {
      if (this.inventoryTab === 'inventory') {
        if (action.dx !== 0) {
          const current = this.inventoryCursorByTab.inventory || 0;
          const cols = this.getInventoryGridColumns();
          const col = current % cols;
          const atHorizontalEdge = (action.dx < 0 && col === 0) || (action.dx > 0 && col === cols - 1);
          if (atHorizontalEdge) {
            this.switchInventoryTab(0);
            return;
          }
        }
        this.moveInventoryGridCursor(action.dx, action.dy);
        return;
      }

      if (action.dx !== 0) {
        this.switchInventoryTab(0);
      } else if (action.dy !== 0) {
        this.moveEquipmentCursor(action.dy);
      }
      return;
    }

    if (action.type === 'belt') {
      this.tryAssignSelectedInventoryItemToBelt(action.slot);
      return;
    }

    if (this.inventoryTab === 'inventory') {
      const idx = this.inventoryCursorByTab.inventory || 0;
      const item = this.player.inventory[idx];
      if (!item) return;

      if (action.type === 'inventoryConfirm') {
        if (!item.slot) {
          this.messageLog.add(`${item.name} cannot be equipped.`, this.turnCount);
          return;
        }
        if (equipItem(this.player, item.id)) {
          updateActiveSkills(this.player);
          this.messageLog.add(`You equip ${item.name}.`, this.turnCount);
          this.clampInventoryCursor();
          if (this.audio) this.audio.uiClick();
        }
        return;
      }

      if (action.type === 'inventoryBelt') {
        this.tryAssignSelectedInventoryItemToBelt();
        return;
      }

      if (action.type === 'inventoryDrop') {
        const removed = removeFromInventory(this.player, item.id);
        if (removed) {
          this.dropItemAtPlayer(removed);
          this.clampInventoryCursor();
          if (this.audio) this.audio.uiClick();
        }
      }
      return;
    }

    const equipmentRows = this.getEquipmentRows();
    const idx = this.inventoryCursorByTab.equipment || 0;
    const selected = equipmentRows[idx];
    if (!selected) return;
    if (!selected.item) {
      if (action.type === 'inventoryConfirm' || action.type === 'inventoryUnequip' || action.type === 'inventoryDrop') {
        this.messageLog.add(`No item equipped in ${this.formatSlotName(selected.slot)}.`, this.turnCount);
      }
      return;
    }

    if (action.type === 'inventoryConfirm' || action.type === 'inventoryUnequip') {
      const itemName = selected.item.name;
      if (unequipItem(this.player, selected.slot)) {
        updateActiveSkills(this.player);
        this.messageLog.add(`You unequip ${itemName}.`, this.turnCount);
        this.clampInventoryCursor();
        if (this.audio) this.audio.uiClick();
      } else {
        this.messageLog.add('Inventory full. Cannot unequip.', this.turnCount);
      }
      return;
    }

    if (action.type === 'inventoryDrop') {
      const item = selected.item;
      this.player.equipment[selected.slot] = null;
      updateActiveSkills(this.player);
      this.dropItemAtPlayer(item);
      if (this.audio) this.audio.uiClick();
    }
  }

  applyConsumable(item) {
    switch (item.effect) {
      case 'heal': {
        const before = this.player.hp;
        const amount = Math.max(1, Math.floor(this.player.maxHp * item.magnitude));
        this.player.heal(amount);
        const healed = this.player.hp - before;
        if (healed > 0) {
          this.addFloatingText(this.player.position.x, this.player.position.y, `+${healed} HP`, '#73e38e', 820);
        }
        return `You drink ${item.name} and recover ${healed} HP.`;
      }
      case 'reveal_map': {
        for (let y = 0; y < this.map.height; y++) {
          for (let x = 0; x < this.map.width; x++) {
            this.map.setExplored(x, y, true);
          }
        }
        return `${item.name} reveals the map.`;
      }
      case 'aoe_damage': {
        const radius = 2;
        let hitCount = 0;
        for (const enemy of this.map.entities) {
          if (enemy.type !== 'enemy' || !enemy.isAlive()) continue;
          const dist = Math.abs(enemy.position.x - this.player.position.x) + Math.abs(enemy.position.y - this.player.position.y);
          if (dist <= radius) {
            enemy.takeDamage(item.magnitude);
            hitCount++;
            if (!enemy.isAlive()) {
              this.handleEnemyDeath(enemy);
            }
          }
        }
        return `The ${item.name} explodes and hits ${hitCount} enemy${hitCount === 1 ? '' : 'ies'}.`;
      }
      case 'teleport': {
        const candidates = [];
        for (let y = 1; y < this.map.height - 1; y++) {
          for (let x = 1; x < this.map.width - 1; x++) {
            if (!this.map.isWalkable(x, y)) continue;
            const blocked = this.map.entities.some(e => e.isAlive() && e.position.x === x && e.position.y === y);
            if (!blocked) candidates.push({ x, y });
          }
        }
        if (candidates.length === 0) return `${item.name} fizzles.`;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        this.player.moveTo(target.x, target.y);
        return `${item.name} teleports you through the dungeon.`;
      }
      case 'speed_boost': {
        this.player.energy += 50;
        return `${item.name} surges through you.`;
      }
      case 'invisibility':
        return `${item.name} shrouds you briefly.`;
      default:
        return `You use ${item.name}.`;
    }
  }

  handleBeltAction(slot) {
    const item = useBeltSlot(this.player, slot);
    if (!item) {
      this.messageLog.add('That belt slot is empty.', this.turnCount);
      return false;
    }

    const message = this.applyConsumable(item);
    this.messageLog.add(message, this.turnCount);
    const replacement = refillBeltSlotWithMatchingConsumable(this.player, slot, item);
    if (replacement) {
      this.messageLog.add(`Belt slot ${slot + 1} refilled with ${replacement.name}.`, this.turnCount);
    }
    if (this.audio) {
      if (item.effect === 'heal' || item.effect === 'speed_boost') this.audio.blessing();
      else if (item.effect === 'aoe_damage') this.audio.enemyHit();
      else this.audio.uiClick();
    }
    return true;
  }

  getSkillTargets(skill) {
    const maxRange = skill.range > 0 ? skill.range : Math.max(1, skill.area?.size || 1);
    const enemies = this.map.entities
      .filter(e => e.type === 'enemy' && e.isAlive() && this.map.isVisible(e.position.x, e.position.y))
      .map(e => ({ enemy: e, dist: Math.abs(e.position.x - this.player.position.x) + Math.abs(e.position.y - this.player.position.y) }))
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

  handleSkillAction(slot) {
    const skill = this.player.activeSkills[slot];
    if (!skill) {
      this.messageLog.add('No skill is bound to that slot.', this.turnCount);
      return false;
    }
    if (!canUseSkill(skill)) {
      this.messageLog.add(`${skill.name} is on cooldown (${skill.currentCooldown}).`, this.turnCount);
      return false;
    }

    const targets = this.getSkillTargets(skill);
    if (targets.length === 0) {
      this.messageLog.add(`No targets in range for ${skill.name}.`, this.turnCount);
      return false;
    }

    if (!useSkill(skill)) return false;

    let totalDamage = 0;
    let killCount = 0;
    let dodgeCount = 0;
    const damageType = skill.statScaling === 'DEX' ? 'ranged' : skill.statScaling === 'INT' ? 'magic' : 'melee';
    const weaponMultiplier = this.getPlayerWeaponMultiplier(damageType);

    for (const enemy of targets) {
      this.addProjectileForDamageType(this.player, enemy, damageType);
      const result = this.resolveCombat(this.player, enemy, {
        baseDamage: skill.damage,
        damageType,
        weaponMultiplier,
      });
      this.addHitFeedback(enemy, result, 'player');
      if (!result.dodged && damageType === 'magic') {
        this.addAchievementProgress('arcane_mastery', result.damage);
      }
      if (this.player.playerClass === 'archer' && result.crit) {
        this.addAchievementProgress('sharpshooter', 1);
      }
      if (result.dodged) {
        dodgeCount++;
        continue;
      }
      totalDamage += result.damage;
      if (result.killed) {
        killCount++;
        this.handleEnemyDeath(enemy);
      }
    }

    this.messageLog.add(
      `${skill.name} hits ${targets.length} target${targets.length === 1 ? '' : 's'} for ${totalDamage} total damage.` +
      (killCount > 0 ? ` (${killCount} kill${killCount === 1 ? '' : 's'})` : '') +
      (dodgeCount > 0 ? ` (${dodgeCount} dodged)` : ''),
      this.turnCount
    );

    if (this.audio) {
      if (damageType === 'magic') this.audio.magicCast();
      else if (damageType === 'ranged') this.audio.rangedShot();
      else this.audio.meleeHit();
    }
    return true;
  }

  handleEnemyDeath(enemy) {
    this.turnSystem.removeEntity(enemy.id);
    this.runSummary.enemiesKilled++;
    if (enemy.name === 'Rat' || enemy.name === 'Elite Rat') {
      this.addAchievementProgress('rat_slayer', 1);
    }

    const killCurrency = (enemy.isElite ? 6 : 3) + Math.floor(Math.random() * (enemy.isElite ? 6 : 3));
    this.player.gold += killCurrency;
    this.runSummary.currencyEarned += killCurrency;

    if (enemy.isFloorBoss && this.floorNumber >= 10) {
      const victoryBonus = 120;
      this.player.gold += victoryBonus;
      this.runSummary.currencyEarned += victoryBonus;
      this.addAchievementProgress('vanquisher', 1);
      this.messageLog.add('The Void Tyrant falls. You have conquered Diegeist.', this.turnCount);
      this.finalizeRun('Victory');
      this.captureRunItemsForHub(true);
      this.state = 'victory';
      if (this.audio) this.audio.stopAmbient();
      return;
    }

    if (Math.random() < 0.45) {
      const luck = this.getEntityStatsWithEquipment(this.player).LCK;
      const drop = Math.random() < 0.35
        ? generateConsumable(this.floorNumber)
        : generateItem({ floorLevel: this.floorNumber, luck, context: 'drop' });
      this.map.items.push({
        ...drop,
        position: { x: enemy.position.x, y: enemy.position.y },
      });
      this.messageLog.add(`The ${enemy.name} drops ${drop.name}.`, this.turnCount);
    }

    if (this.audio) this.audio.enemyDeath();
  }

  finalizeRun(causeOfDeath) {
    if (this.runFinalized || !this.saveData) return;
    this.runFinalized = true;
    this.runSummary.causeOfDeath = causeOfDeath;
    this.runSummary.floorsReached = Math.max(this.runSummary.floorsReached, this.floorNumber);
    this.syncMilestoneAchievements();
    this.saveData.addCurrency(this.runSummary.currencyEarned);
    this.saveData.addRunHistory({
      classKey: this.runSummary.classKey,
      floorsReached: this.runSummary.floorsReached,
      enemiesKilled: this.runSummary.enemiesKilled,
      currencyEarned: this.runSummary.currencyEarned,
      causeOfDeath: this.runSummary.causeOfDeath,
    });
    persistSaveData(this.saveData);
  }

  getClassLabel(classKey) {
    return PLAYER_CLASSES[classKey]?.name || classKey;
  }

  cycleClassSelection(delta) {
    if (delta === 0 || this.classOrder.length === 0) return;
    const next = (this.startMenuIndex + delta + this.classOrder.length) % this.classOrder.length;
    this.startMenuIndex = next;
    this.selectedClass = this.classOrder[next];
    if (this.audio) this.audio.uiClick();
  }

  persistLastClassSelection() {
    if (!this.saveData) return;
    if (!this.saveData.settings) this.saveData.settings = { volume: 0.7 };
    this.saveData.settings.lastClass = this.selectedClass;
    persistSaveData(this.saveData);
  }

  startNewRun() {
    this.persistLastClassSelection();
    this.messageLog = new MessageLog();
    this.turnSystem = new TurnSystem();
    this.clearCombatVfx();
    this.player = null;
    this.map = null;
    this.turnCount = 0;
    this.floorNumber = 1;
    this.regenCounter = 0;
    this.runFinalized = false;
    this.inventoryOpen = false;
    this.statsOpen = false;
    this.inventoryTab = 'inventory';
    this.inventoryCursorByTab = { inventory: 0, equipment: 0 };
    this.deathSplashFrames = 0;
    this.postDeathMenuIndex = 0;
    this.hubRunCarryover = [];
    this.hubCanStashMultipleFromRun = false;
    this.hubStashedFromRunCount = 0;
    this.runSummary = {
      classKey: this.selectedClass,
      floorsReached: 1,
      enemiesKilled: 0,
      currencyEarned: 0,
      causeOfDeath: null,
    };
    this.startFloor();
    this.state = 'playing';
    if (this.audio) this.audio.uiClick();
  }

  handleStartMenuAction(action) {
    if (!action) return;
    if (action.type === 'move') {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) this.cycleClassSelection(delta);
      return;
    }
    if (action.type === 'hub') {
      this.enterHubMenu();
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      this.startNewRun();
    }
  }

  handleDeathSplashAction(action) {
    this.deathSplashFrames++;
    if (!action || this.deathSplashFrames < 25) return;
    if (action.type === 'inventoryConfirm' || action.type === 'wait' || action.type === 'close') {
      this.state = 'postDeathMenu';
      this.postDeathMenuIndex = 0;
      if (this.audio) this.audio.uiClick();
    }
  }

  handlePostDeathMenuAction(action) {
    if (!action) return;
    if (action.type === 'move') {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        const optionCount = 3;
        this.postDeathMenuIndex = (this.postDeathMenuIndex + delta + optionCount) % optionCount;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'close') {
      this.state = 'startMenu';
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.postDeathMenuIndex === 0) {
        this.startNewRun();
      } else if (this.postDeathMenuIndex === 1) {
        this.enterHubMenu();
      } else {
        this.state = 'startMenu';
      }
    }
  }

  handleVictoryAction(action) {
    if (!action) return;
    if (action.type === 'hub') {
      this.enterHubMenu('Victory rewards available in stash.');
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait' || action.type === 'close') {
      this.state = 'startMenu';
      if (this.audio) this.audio.uiClick();
    }
  }

  getHubMenuOptions() {
    return ['Start Run', 'Shop', 'Stash', 'Achievements', 'Back to Class Select'];
  }

  handleHubMenuAction(action) {
    if (!action) return;
    const options = this.getHubMenuOptions();
    if (action.type === 'move') {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        this.hubMenuIndex = (this.hubMenuIndex + delta + options.length) % options.length;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'close') {
      this.state = 'startMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.hubMenuIndex === 0) {
        this.startNewRun();
      } else if (this.hubMenuIndex === 1) {
        this.state = 'hubShop';
      } else if (this.hubMenuIndex === 2) {
        this.state = 'hubStash';
      } else if (this.hubMenuIndex === 3) {
        this.state = 'hubAchievements';
      } else {
        this.state = 'startMenu';
      }
      if (this.audio) this.audio.uiClick();
    }
  }

  handleHubShopAction(action) {
    if (!action) return;
    if (action.type === 'close') {
      this.state = 'hubMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (action.type === 'move') {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0 && this.hubShop.items.length > 0) {
        const count = this.hubShop.items.length;
        this.hubShopCursor = (this.hubShopCursor + delta + count) % count;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      const item = this.hubShop.items[this.hubShopCursor];
      if (!item) return;
      const success = this.hubShop.purchase(this.saveData, item.id);
      if (!success) {
        this.hubNotice = `Not enough essence for ${item.name}.`;
        if (this.audio) this.audio.uiClick();
        return;
      }
      this.hubNotice = `Purchased: ${item.name}.`;
      persistSaveData(this.saveData);
      this.hubShopCursor = Math.max(0, Math.min(this.hubShopCursor, this.hubShop.items.length - 1));
      if (this.audio) this.audio.blessing();
    }
  }

  getSelectedAchievement() {
    if (ACHIEVEMENTS.length === 0) return null;
    const idx = Math.max(0, Math.min(this.hubAchievementsCursor, ACHIEVEMENTS.length - 1));
    return ACHIEVEMENTS[idx];
  }

  handleHubAchievementsAction(action) {
    if (!action) return;
    if (action.type === 'close') {
      this.state = 'hubMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (action.type === 'move') {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0 && ACHIEVEMENTS.length > 0) {
        this.hubAchievementsCursor = (this.hubAchievementsCursor + delta + ACHIEVEMENTS.length) % ACHIEVEMENTS.length;
        if (this.audio) this.audio.uiClick();
      }
    }
  }

  getStashPaneItems() {
    if (this.hubStashPane === 'stash') return this.saveData.stash || [];
    return this.hubRunCarryover || [];
  }

  handleHubStashAction(action) {
    if (!action) return;
    if (action.type === 'close') {
      this.state = 'hubMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (action.type === 'move') {
      if (action.dx !== 0 && this.hubRunCarryover.length > 0) {
        this.hubStashPane = this.hubStashPane === 'stash' ? 'run' : 'stash';
        if (this.audio) this.audio.uiClick();
        return;
      }
      if (action.dy !== 0) {
        const items = this.getStashPaneItems();
        if (items.length === 0) return;
        if (this.hubStashPane === 'stash') {
          this.hubStashCursor = (this.hubStashCursor + action.dy + items.length) % items.length;
        } else {
          this.hubRunItemsCursor = (this.hubRunItemsCursor + action.dy + items.length) % items.length;
        }
        if (this.audio) this.audio.uiClick();
      }
      return;
    }

    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.hubStashPane === 'stash') {
        if (!this.saveData.stash || this.saveData.stash.length === 0) return;
        const idx = Math.max(0, Math.min(this.hubStashCursor, this.saveData.stash.length - 1));
        const removed = this.saveData.removeFromStash(this.saveData.stash[idx].id);
        if (!removed) return;
        if (this.pendingStashLoadoutItem) {
          this.saveData.addToStash(this.pendingStashLoadoutItem);
        }
        this.pendingStashLoadoutItem = this.cloneItem(removed);
        this.hubNotice = `Selected run loadout: ${removed.name}.`;
        this.hubStashCursor = Math.max(0, Math.min(this.hubStashCursor, this.saveData.stash.length - 1));
        persistSaveData(this.saveData);
        if (this.audio) this.audio.itemPickup();
        return;
      }

      if (!this.hubCanStashMultipleFromRun && this.hubStashedFromRunCount >= 1) {
        this.hubNotice = 'Only one run item can be stashed after death.';
        if (this.audio) this.audio.uiClick();
        return;
      }
      if (this.hubRunCarryover.length === 0) return;
      const idx = Math.max(0, Math.min(this.hubRunItemsCursor, this.hubRunCarryover.length - 1));
      const item = this.hubRunCarryover[idx];
      const added = this.saveData.addToStash(this.cloneItem(item));
      if (!added) {
        this.hubNotice = 'Stash is full.';
        if (this.audio) this.audio.uiClick();
        return;
      }
      this.hubRunCarryover.splice(idx, 1);
      this.hubStashedFromRunCount++;
      this.hubNotice = `Stashed: ${item.name}.`;
      this.hubRunItemsCursor = Math.max(0, Math.min(this.hubRunItemsCursor, this.hubRunCarryover.length - 1));
      this.setAchievementProgress('collector', this.saveData.stash.length);
      persistSaveData(this.saveData);
      if (this.audio) this.audio.itemPickup();
    }
  }

  getNaturalRegenInterval() {
    const stats = this.getEntityStatsWithEquipment(this.player);
    const regenFactor = Math.floor(((stats.CON || 0) + (stats.WIS || 0)) / 4);
    return Math.max(6, 16 - regenFactor);
  }

  applyNaturalRegen() {
    if (!this.player || this.player.hp >= this.player.maxHp) return;
    this.regenCounter++;
    const interval = this.getNaturalRegenInterval();
    if (this.regenCounter < interval) return;
    this.regenCounter = 0;
    this.player.heal(1);
    this.addFloatingText(this.player.position.x, this.player.position.y, '+1 HP', '#73e38e', 780);
    this.messageLog.add('You recover 1 HP naturally.', this.turnCount);
  }

  wrapTextLines(text, maxChars) {
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

  getSelectedInspectTarget() {
    if (!this.player) return { item: null, slotLabel: null };
    if (this.inventoryTab === 'inventory') {
      const idx = this.inventoryCursorByTab.inventory || 0;
      return { item: this.player.inventory[idx] || null, slotLabel: null };
    }
    const rows = this.getEquipmentRows();
    const idx = this.inventoryCursorByTab.equipment || 0;
    const row = rows[idx] || null;
    if (!row) return { item: null, slotLabel: null };
    return { item: row.item || null, slotLabel: this.formatSlotName(row.slot) };
  }

  getItemInspectLines(item, slotLabel = null) {
    if (!item) {
      return slotLabel ? [`Slot: ${slotLabel}`, 'No item equipped.'] : ['No item selected.'];
    }

    const lines = [
      item.name,
      `Type: ${item.type}`,
    ];
    if (item.rarity) lines.push(`Rarity: ${String(item.rarity).toUpperCase()}`);
    if (item.slot) lines.push(`Slot: ${this.formatSlotName(item.slot)}`);

    const bonuses = Object.entries(item.statBonuses || {})
      .filter(([, value]) => value !== 0)
      .sort(([a], [b]) => a.localeCompare(b));
    if (bonuses.length > 0) {
      lines.push('Bonuses:');
      for (const [stat, value] of bonuses) {
        const sign = value > 0 ? '+' : '';
        lines.push(`${sign}${value} ${stat}`);
      }
    }

    if (item.skill) {
      lines.push(`Skill: ${item.skill.name}`);
      lines.push(`CD: ${item.skill.cooldown}  Dmg: ${item.skill.damage}`);
      if (item.skill.description) {
        lines.push(...this.wrapTextLines(item.skill.description, 30));
      }
    }

    if (item.effect) {
      lines.push(`Effect: ${item.effect.replaceAll('_', ' ')}`);
    }

    if (item.description) {
      lines.push(...this.wrapTextLines(item.description, 30));
    }

    const compareLines = this.getItemComparisonLines(item);
    if (compareLines.length > 0) {
      lines.push('');
      lines.push(...compareLines);
    }

    return lines;
  }

  getItemComparisonLines(item) {
    if (!this.player || !item || !item.slot) return [];

    const equipped = this.player.equipment[item.slot] || null;
    const slotName = this.formatSlotName(item.slot);

    if (!equipped) {
      return [`Compare (${slotName}): slot empty`];
    }

    const lines = [`Compare (${slotName}): ${equipped.name}`];
    const candidateBonuses = item.statBonuses || {};
    const equippedBonuses = equipped.statBonuses || {};
    const statSet = new Set([
      ...Object.keys(candidateBonuses),
      ...Object.keys(equippedBonuses),
    ]);

    if (statSet.size === 0) {
      lines.push('Stats: no bonus changes');
    } else {
      const sortedStats = Array.from(statSet).sort((a, b) => a.localeCompare(b));
      for (const stat of sortedStats) {
        const nextValue = candidateBonuses[stat] || 0;
        const currentValue = equippedBonuses[stat] || 0;
        const delta = nextValue - currentValue;
        const deltaPrefix = delta > 0 ? '+' : '';
        const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
        lines.push(`${stat}: ${deltaPrefix}${delta} (${direction})`);
      }
    }

    const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    const candidateRank = rarityOrder[item.rarity] ?? -1;
    const equippedRank = rarityOrder[equipped.rarity] ?? -1;
    if (candidateRank >= 0 && equippedRank >= 0) {
      const rarityDelta = candidateRank - equippedRank;
      if (rarityDelta > 0) {
        lines.push(`Rarity: +${rarityDelta} tier`);
      } else if (rarityDelta < 0) {
        lines.push(`Rarity: ${rarityDelta} tier`);
      } else {
        lines.push('Rarity: same tier');
      }
    }

    const nextSkill = item.skill?.name || null;
    const currentSkill = equipped.skill?.name || null;
    if (nextSkill && !currentSkill) {
      lines.push(`Skill: gain ${nextSkill}`);
    } else if (!nextSkill && currentSkill) {
      lines.push(`Skill: lose ${currentSkill}`);
    } else if (nextSkill && currentSkill && nextSkill !== currentSkill) {
      lines.push(`Skill: ${currentSkill} -> ${nextSkill}`);
    } else if (nextSkill && currentSkill && nextSkill === currentSkill) {
      lines.push(`Skill: keep ${nextSkill}`);
    }

    return lines;
  }

  toggleStatsOverlay() {
    this.statsOpen = !this.statsOpen;
    if (this.statsOpen) {
      this.inventoryOpen = false;
      this.messageLog.add('Stats open. Press P or ESC to close.', this.turnCount);
    }
    if (this.audio) this.audio.uiClick();
  }

  getNowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  clearCombatVfx() {
    this.combatVfx.floatingTexts.length = 0;
    this.combatVfx.projectiles.length = 0;
  }

  addFloatingText(tileX, tileY, text, color = '#ffffff', durationMs = 680) {
    this.combatVfx.floatingTexts.push({
      tileX,
      tileY,
      text,
      color,
      startMs: this.getNowMs(),
      durationMs,
    });
  }

  addProjectile(fromX, fromY, toX, toY, spriteKey, durationMs = 180) {
    this.combatVfx.projectiles.push({
      fromX,
      fromY,
      toX,
      toY,
      spriteKey,
      startMs: this.getNowMs(),
      durationMs,
    });
  }

  addHitFeedback(defender, result, source = 'player') {
    if (result.dodged) {
      this.addFloatingText(defender.position.x, defender.position.y, 'DODGE', '#8fd9ff', 760);
      return;
    }
    const critSuffix = result.crit ? '!' : '';
    const color = source === 'enemy'
      ? '#ff7f7f'
      : result.crit
        ? '#ffd86b'
        : '#ffc18a';
    this.addFloatingText(defender.position.x, defender.position.y, `${result.damage}${critSuffix}`, color, 700);
  }

  addProjectileForDamageType(fromEntity, toEntity, damageType) {
    if (!fromEntity || !toEntity) return;
    if (damageType === 'ranged') {
      this.addProjectile(
        fromEntity.position.x,
        fromEntity.position.y,
        toEntity.position.x,
        toEntity.position.y,
        'arrow_projectile',
        170
      );
    } else if (damageType === 'magic') {
      this.addProjectile(
        fromEntity.position.x,
        fromEntity.position.y,
        toEntity.position.x,
        toEntity.position.y,
        'arcbolt_projectile',
        210
      );
    }
  }

  updateCombatVfx(nowMs) {
    this.combatVfx.floatingTexts = this.combatVfx.floatingTexts.filter(vfx => nowMs - vfx.startMs < vfx.durationMs);
    this.combatVfx.projectiles = this.combatVfx.projectiles.filter(vfx => nowMs - vfx.startMs < vfx.durationMs);
  }

  drawCombatVfx(nowMs) {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const vfx of this.combatVfx.projectiles) {
      const t = Math.max(0, Math.min(1, (nowMs - vfx.startMs) / vfx.durationMs));
      const px = vfx.fromX + (vfx.toX - vfx.fromX) * t;
      const py = vfx.fromY + (vfx.toY - vfx.fromY) * t;
      const sprite = this.sprites.get(vfx.spriteKey);
      const size = Math.max(6, Math.floor(cam.tileSize * 0.5));
      const { sx, sy } = cam.tileToScreen(px, py);
      const drawX = sx + Math.floor(cam.tileSize / 2) - Math.floor(size / 2);
      const drawY = sy + Math.floor(cam.tileSize / 2) - Math.floor(size / 2);
      if (sprite) {
        ctx.drawImage(sprite, drawX, drawY, size, size);
      } else {
        ctx.fillStyle = '#ffd47a';
        ctx.fillRect(drawX, drawY, size, size);
      }
    }

    const savedAlign = ctx.textAlign;
    const savedBaseline = ctx.textBaseline;
    const savedAlpha = ctx.globalAlpha;
    const fontSize = Math.max(10, Math.floor(cam.tileSize * 0.45));
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const vfx of this.combatVfx.floatingTexts) {
      const t = Math.max(0, Math.min(1, (nowMs - vfx.startMs) / vfx.durationMs));
      const alpha = 1 - t;
      const rise = t * cam.tileSize * 0.9;
      const { sx, sy } = cam.tileToScreen(vfx.tileX, vfx.tileY);
      const textX = sx + cam.tileSize / 2;
      const textY = sy + cam.tileSize * 0.2 - rise;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000000';
      ctx.fillText(vfx.text, textX + 1, textY + 1);
      ctx.fillStyle = vfx.color;
      ctx.fillText(vfx.text, textX, textY);
    }

    ctx.globalAlpha = savedAlpha;
    ctx.textAlign = savedAlign;
    ctx.textBaseline = savedBaseline;
  }

  applyStarterLoadout() {
    if (!this.player) return;
    const starterWeapon = createStarterWeapon(this.player.playerClass);
    if (!starterWeapon) return;

    this.player.equipment[starterWeapon.slot] = starterWeapon;
    this.messageLog.add(`You begin with ${starterWeapon.name}.`, this.turnCount);
  }

  startFloor() {
    // Pick a random archetype
    const archetypes = ['corridor-heavy', 'cavernous', 'hybrid'];
    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    // Generate the dungeon
    this.map = generateDungeon(60, 50, archetype, this.floorNumber);

    // Find the start room and place the player at its center
    const startRoom = this.map.rooms.find(r => r.type === 'start');
    if (!startRoom) {
      throw new Error('No start room found in generated dungeon');
    }
    const startX = Math.floor(startRoom.x + startRoom.width / 2);
    const startY = Math.floor(startRoom.y + startRoom.height / 2);

    if (!this.player) {
      this.player = createPlayer(this.selectedClass, startX, startY, this.saveData?.permanentStats || {});
      this.player.floorNumber = this.floorNumber;
      this.runSummary.classKey = this.player.playerClass;
      this.applyStarterLoadout();
      this.applyPendingHubLoadout();
    } else {
      this.player.moveTo(startX, startY);
      this.player.floorNumber = this.floorNumber;
      this.player.energy = 0;
      this.player.heal(Math.ceil(this.player.maxHp * 0.2));
    }

    this.turnSystem.addEntity(this.player);
    updateActiveSkills(this.player);

    // Spawn enemy groups with floor-scaled difficulty. Bat groups spawn as clustered packs.
    const standardRooms = this.map.rooms.filter(r => r.type === 'standard');
    const floorPressure = Math.floor((this.floorNumber - 1) / 2);
    const numEnemyGroups = Math.min(12, 3 + floorPressure + Math.floor(Math.random() * 3));
    const rooms = standardRooms.slice().sort(() => Math.random() - 0.5);
    const baseEnemyTemplates = this.getEnemyBaseTemplatesForFloor();
    let enemySerial = 0;

    const isInRoom = (room, x, y) =>
      x >= room.x && x < room.x + room.width &&
      y >= room.y && y < room.y + room.height;

    const isSpawnOpen = (x, y) => {
      if (!this.map.isWalkable(x, y)) return false;
      if (this.player.position.x === x && this.player.position.y === y) return false;
      return !this.map.entities.some(e => e.isAlive() && e.position.x === x && e.position.y === y);
    };

    const pickOpenTileInRoom = (room, attempts = 20) => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const x = room.x + Math.floor(Math.random() * room.width);
        const y = room.y + Math.floor(Math.random() * room.height);
        if (isSpawnOpen(x, y)) return { x, y };
      }
      return null;
    };

    const spawnEnemyAt = (enemyType, x, y) => {
      if (!isSpawnOpen(x, y)) return null;
      const scaled = this.scaleEnemyTemplate(enemyType);
      const enemy = new Entity({
        id: `enemy_${enemySerial++}`,
        type: 'enemy',
        x,
        y,
        stats: scaled.stats,
        maxHp: scaled.maxHp,
        speed: scaled.speed,
        behavior: scaled.behavior,
        name: scaled.name,
      });
      enemy.spriteKey = scaled.spriteKey;
      enemy.isElite = scaled.isElite;
      if (enemy.behavior === 'summoner') {
        enemy.summonCooldown = Math.max(1, 2 + Math.floor(Math.random() * 2) - Math.floor(this.floorNumber / 5));
      }
      this.map.entities.push(enemy);
      this.turnSystem.addEntity(enemy);
      return enemy;
    };

    const packOffsets = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
    ];

    for (let i = 0; i < numEnemyGroups && i < rooms.length; i++) {
      const room = rooms[i];
      const enemyType = this.chooseWeightedEnemyTemplate(baseEnemyTemplates);
      const anchor = pickOpenTileInRoom(room);
      if (!anchor) continue;

      const first = spawnEnemyAt(enemyType, anchor.x, anchor.y);
      if (!first) continue;

      if (enemyType.name !== 'Bat') continue;

      const packSize = Math.min(5, 2 + Math.floor(Math.random() * 2) + Math.floor((this.floorNumber - 1) / 6));
      const packTiles = [{ x: anchor.x, y: anchor.y }];
      let spawned = 1;
      let attempts = 0;

      while (spawned < packSize && attempts < 20) {
        attempts++;
        const origin = packTiles[Math.floor(Math.random() * packTiles.length)];
        const offsets = packOffsets.slice().sort(() => Math.random() - 0.5);
        let placed = false;
        for (const offset of offsets) {
          const nx = origin.x + offset.dx;
          const ny = origin.y + offset.dy;
          if (!isInRoom(room, nx, ny)) continue;
          const bat = spawnEnemyAt(enemyType, nx, ny);
          if (!bat) continue;
          packTiles.push({ x: nx, y: ny });
          spawned++;
          placed = true;
          break;
        }
        if (!placed) continue;
      }
    }

    if (this.floorNumber === 10) {
      this.spawnFloor10Boss();
      this.messageLog.add('Final floor. Defeat the Void Tyrant to win.', this.turnCount);
    }
    this.spawnFloorItems(standardRooms);

    if (this.floorNumber === 1 && this.turnCount === 0) {
      this.messageLog.add('Welcome to Diegeist. Move with arrow keys or WASD.', this.turnCount);
      this.messageLog.add('Attack by moving into an enemy tile.', this.turnCount);
      this.messageLog.add('Press G to pick up items. Press I to manage inventory.', this.turnCount);
      if (this.player.playerClass === 'archer' || this.player.playerClass === 'mage') {
        this.messageLog.add('Use Q for your starter ranged skill.', this.turnCount);
      }
    }
    this.messageLog.add(`Floor ${this.floorNumber} begins.`, this.turnCount);
    if (this.audio) this.audio.startAmbient(this.floorNumber);

    computeFOV(this.map, this.player.position.x, this.player.position.y, FOV_RADIUS);
    this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
  }

  processPlayerAction(action) {
    if (action.type === 'move') {
      const nx = this.player.position.x + action.dx;
      const ny = this.player.position.y + action.dy;

      // Closed doors open only when the player pushes through them.
      if (this.map.getTile(nx, ny) === TILE.DOOR) {
        this.map.setTile(nx, ny, TILE.DOOR_OPEN);
        this.player.moveTo(nx, ny);
        this.messageLog.add('You open the door.', this.turnCount);
        if (this.audio) this.audio.doorOpen();
        return true;
      }

      // Check for enemy at target position (bump-to-attack)
      const enemy = this.map.entities.find(e =>
        e.type === 'enemy' && e.isAlive() && e.position.x === nx && e.position.y === ny
      );
      if (enemy) {
        const result = this.resolveCombat(this.player, enemy, {
          baseDamage: 3,
          damageType: 'melee',
          weaponMultiplier: this.getPlayerWeaponMultiplier('melee'),
        });
        this.addHitFeedback(enemy, result, 'player');
        if (this.player.playerClass === 'archer' && result.crit) {
          this.addAchievementProgress('sharpshooter', 1);
        }

        if (result.dodged) {
          this.messageLog.add(`The ${enemy.name} dodges your attack!`, this.turnCount);
        } else if (result.killed) {
          this.messageLog.add(`You killed the ${enemy.name}!`, this.turnCount);
          this.handleEnemyDeath(enemy);
        } else {
          const critMsg = result.crit ? ' (CRITICAL!)' : '';
          this.messageLog.add(`You hit the ${enemy.name} for ${result.damage} damage!${critMsg}`, this.turnCount);
        }
        if (this.audio) this.audio.meleeHit();
        return true;
      }

      if (this.map.isWalkable(nx, ny)) {
        this.player.moveTo(nx, ny);
        const dirs = { '0,-1': 'north', '0,1': 'south', '-1,0': 'west', '1,0': 'east' };
        this.messageLog.add(`You move ${dirs[`${action.dx},${action.dy}`]}.`, this.turnCount);
        if (this.audio) this.audio.footstep();
        return true;
      } else {
        this.messageLog.add('You bump into a wall.', this.turnCount);
        return false;
      }
    }
    if (action.type === 'wait') {
      this.messageLog.add('You wait.', this.turnCount);
      return true;
    }
    if (action.type === 'descend') {
      return this.handleFloorTransition();
    }
    if (action.type === 'pickup') {
      return this.handlePickupAction();
    }
    if (action.type === 'belt') {
      return this.handleBeltAction(action.slot);
    }
    if (action.type === 'skill') {
      return this.handleSkillAction(action.slot);
    }
    return false;
  }

  processEnemyTurn(entity) {
    const action = getAIAction(entity, this.player, this.map, this.map.entities);

    if (action.type === 'move') {
      entity.moveTo(action.x, action.y);
    } else if (action.type === 'attack') {
      this.addProjectileForDamageType(entity, this.player, action.damageType || 'melee');
      const result = this.resolveCombat(entity, this.player, {
        baseDamage: 2,
        damageType: action.damageType || 'melee',
        weaponMultiplier: 1.0
      });
      this.addHitFeedback(this.player, result, 'enemy');

      if (result.dodged) {
        this.messageLog.add(`You dodge the ${entity.name}'s attack!`, this.turnCount);
      } else if (result.killed) {
        this.messageLog.add(`You have been slain by the ${entity.name}!`, this.turnCount);
        this.finalizeRun(entity.name);
        this.captureRunItemsForHub(false);
        this.deathSplashFrames = 0;
        this.state = 'deathSplash';
        if (this.audio) this.audio.stopAmbient();
      } else {
        const critMsg = result.crit ? ' (CRITICAL!)' : '';
        this.messageLog.add(`The ${entity.name} hits you for ${result.damage} damage!${critMsg}`, this.turnCount);
      }
      if (this.audio) this.audio.playerHurt();
    } else if (action.type === 'summon') {
      const minionId = `minion_${Date.now()}_${Math.random()}`;
      const minion = new Entity({
        id: minionId,
        type: 'enemy',
        x: action.spawnX,
        y: action.spawnY,
        stats: { STR: 2, DEX: 2, CON: 2, INT: 1, WIS: 1, LCK: 1 },
        maxHp: 3,
        speed: 100,
        behavior: 'rushdown',
        name: 'Minion',
      });
      minion.spriteKey = 'rat';
      minion.isSummonedMinion = true;
      minion.summonedBy = entity.id;
      this.map.entities.push(minion);
      this.turnSystem.addEntity(minion);
      this.messageLog.add(`The ${entity.name} summons a ${minion.name}!`, this.turnCount);
      if (this.audio) this.audio.magicCast();
    }
    // If action.type === 'wait', do nothing

    entity.spendTurn();
  }

  handleFloorTransition() {
    if (this.floorNumber >= 10) {
      this.messageLog.add('This is the deepest floor. Defeat the final boss to win.', this.turnCount);
      return false;
    }

    const playerTile = this.map.getTile(this.player.position.x, this.player.position.y);
    if (playerTile !== TILE.STAIRS_DOWN) {
      this.messageLog.add('There are no stairs here.', this.turnCount);
      return false;
    }

    // Check if boss room is cleared
    const bossRoom = this.map.rooms.find(r => r.type === 'boss');
    if (bossRoom) {
      const enemiesInBossRoom = this.map.entities.filter(e => {
        if (e.type !== 'enemy' || !e.isAlive()) return false;
        return e.position.x >= bossRoom.x && e.position.x < bossRoom.x + bossRoom.width &&
               e.position.y >= bossRoom.y && e.position.y < bossRoom.y + bossRoom.height;
      });
      if (enemiesInBossRoom.length > 0) {
        this.messageLog.add('The stairs are blocked. Clear the boss room first.', this.turnCount);
        return false;
      }
    }

    // Descend to next floor
    const floorReward = 10 + this.floorNumber * 2;
    this.player.gold += floorReward;
    this.runSummary.currencyEarned += floorReward;
    this.floorNumber++;
    this.runSummary.floorsReached = Math.max(this.runSummary.floorsReached, this.floorNumber);
    this.syncMilestoneAchievements();
    persistSaveData(this.saveData);

    // Clear old entities from turn system
    this.turnSystem = new TurnSystem();

    this.startFloor();
    if (this.audio) this.audio.stairsDescend();
    this.messageLog.add(`You gain ${floorReward} essence for clearing the floor.`, this.turnCount);
    this.messageLog.add(`You descend to floor ${this.floorNumber}.`, this.turnCount);
    return true;
  }

  update() {
    const action = this.input.consume();

    if (this.state === 'startMenu') {
      this.handleStartMenuAction(action);
      return;
    }
    if (this.state === 'deathSplash') {
      this.handleDeathSplashAction(action);
      return;
    }
    if (this.state === 'postDeathMenu') {
      this.handlePostDeathMenuAction(action);
      return;
    }
    if (this.state === 'victory') {
      this.handleVictoryAction(action);
      return;
    }
    if (this.state === 'hubMenu') {
      this.handleHubMenuAction(action);
      return;
    }
    if (this.state === 'hubShop') {
      this.handleHubShopAction(action);
      return;
    }
    if (this.state === 'hubStash') {
      this.handleHubStashAction(action);
      return;
    }
    if (this.state === 'hubAchievements') {
      this.handleHubAchievementsAction(action);
      return;
    }
    if (this.state !== 'playing') return;
    if (!action) return;

    if (this.inventoryOpen) {
      this.handleInventoryOverlayAction(action);
      return;
    }
    if (this.statsOpen) {
      if (action.type === 'stats' || action.type === 'close' || action.type === 'inventoryConfirm') {
        this.toggleStatsOverlay();
      }
      return;
    }

    if (action.type === 'inventory' || action.type === 'inventoryTab') {
      this.toggleInventoryOverlay();
      return;
    }
    if (action.type === 'stats') {
      this.toggleStatsOverlay();
      return;
    }
    if (action.type === 'close') return;

    const usedSkill = action.type === 'skill' ? this.player.activeSkills[action.slot] || null : null;
    const acted = this.processPlayerAction(action);
    if (!acted) return;

    tickCooldowns(this.player, usedSkill);
    this.player.spendTurn();
    this.turnCount++;
    this.applyNaturalRegen();

    // Run ticks until the player gets another turn
    let safety = 0;
    while (safety++ < 200) {
      const ready = this.turnSystem.tick();
      if (ready.length === 0) continue;

      let playerReady = false;
      for (const entity of ready) {
        if (entity.type === 'player') {
          playerReady = true;
          continue;
        }
        this.processEnemyTurn(entity);
        if (this.state !== 'playing') break;
      }

      if (playerReady || this.state !== 'playing') break;
    }

    if (this.state !== 'playing') return;
    computeFOV(this.map, this.player.position.x, this.player.position.y, FOV_RADIUS);
    this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
    this.runSummary.floorsReached = Math.max(this.runSummary.floorsReached, this.floorNumber);
  }

  drawInventoryOverlay() {
    const ctx = this.ctx;
    const uiScale = Math.max(1, Math.min(1.6, Math.min(this.canvas.width, this.canvas.height) / 900));
    const panelW = Math.min(Math.round(860 * uiScale), this.canvas.width - 40);
    const panelH = Math.min(Math.round(500 * uiScale), this.canvas.height - 40);
    const x = Math.floor((this.canvas.width - panelW) / 2);
    const y = Math.floor((this.canvas.height - panelH) / 2);
    const listW = Math.round(panelW * 0.54);
    const detailX = x + listW + Math.round(14 * uiScale);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#171a1f';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#5a6572';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(16 * uiScale)}px monospace`;
    ctx.fillText('Inventory', x + Math.round(16 * uiScale), y + Math.round(26 * uiScale));

    const tabY = y + Math.round(48 * uiScale);
    const invActive = this.inventoryTab === 'inventory';
    const eqActive = this.inventoryTab === 'equipment';
    ctx.fillStyle = invActive ? '#d9dde2' : '#7d8894';
    ctx.fillText('Items', x + Math.round(16 * uiScale), tabY);
    ctx.fillStyle = eqActive ? '#d9dde2' : '#7d8894';
    ctx.fillText('Equipment', x + Math.round(120 * uiScale), tabY);
    ctx.strokeStyle = '#333a42';
    ctx.beginPath();
    ctx.moveTo(x + Math.round(14 * uiScale), tabY + Math.round(8 * uiScale));
    ctx.lineTo(x + panelW - Math.round(14 * uiScale), tabY + Math.round(8 * uiScale));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + listW, tabY + Math.round(10 * uiScale));
    ctx.lineTo(x + listW, y + panelH - Math.round(56 * uiScale));
    ctx.stroke();

    if (this.inventoryTab === 'inventory') {
      const capacity = this.getInventoryCapacity();
      const cols = this.getInventoryGridColumns();
      const rows = Math.ceil(capacity / cols);
      const cursor = this.inventoryCursorByTab.inventory || 0;
      const gridX = x + Math.round(20 * uiScale);
      const gridY = y + Math.round(74 * uiScale);
      const gridW = listW - Math.round(32 * uiScale);
      const gridH = panelH - Math.round(150 * uiScale);
      const gap = Math.max(4, Math.round(8 * uiScale));
      const cellW = Math.floor((gridW - gap * (cols - 1)) / cols);
      const cellH = Math.floor((gridH - gap * (rows - 1)) / rows);
      const cellSize = Math.max(22, Math.min(cellW, cellH));
      const iconSize = Math.max(12, Math.floor(cellSize * 0.42));
      const titleY = gridY - Math.round(8 * uiScale);

      ctx.fillStyle = '#a8b4c1';
      ctx.font = `${Math.round(11 * uiScale)}px monospace`;
      ctx.fillText('Inventory Grid (Tab: switch panel)', gridX, titleY);

      for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
        const col = slotIndex % cols;
        const row = Math.floor(slotIndex / cols);
        const cellX = gridX + col * (cellSize + gap);
        const cellY = gridY + row * (cellSize + gap);
        const item = this.player.inventory[slotIndex] || null;
        const selected = slotIndex === cursor;

        ctx.fillStyle = '#1d242d';
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
        ctx.strokeStyle = selected ? '#f4f7fa' : '#495664';
        ctx.lineWidth = selected ? Math.max(2, Math.floor(uiScale * 2)) : 1;
        ctx.strokeRect(cellX, cellY, cellSize, cellSize);

        if (item) {
          const rarityColor = this.getRarityColor(item.rarity, '#768493');
          const savedAlpha = ctx.globalAlpha;
          ctx.globalAlpha = 0.26;
          ctx.fillStyle = rarityColor;
          ctx.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);
          ctx.globalAlpha = savedAlpha;

          const iconX = cellX + Math.floor((cellSize - iconSize) / 2);
          const iconY = cellY + Math.round(6 * uiScale);
          this.drawInventoryItemIcon(ctx, item, iconX, iconY, iconSize);

          ctx.fillStyle = selected ? '#ffffff' : this.getRarityColor(item.rarity, '#c3cbd4');
          ctx.font = `${Math.max(8, Math.round(9 * uiScale))}px monospace`;
          const label = this.truncateLabel(item.name, 12);
          ctx.fillText(label, cellX + Math.round(4 * uiScale), cellY + cellSize - Math.round(6 * uiScale));
        } else {
          ctx.fillStyle = '#6f7b89';
          ctx.font = `${Math.max(8, Math.round(9 * uiScale))}px monospace`;
          ctx.fillText('(empty)', cellX + Math.round(4 * uiScale), cellY + cellSize - Math.round(6 * uiScale));
        }

        ctx.fillStyle = '#8e99a7';
        ctx.font = `${Math.max(7, Math.round(8 * uiScale))}px monospace`;
        ctx.fillText(`${slotIndex + 1}`, cellX + Math.round(3 * uiScale), cellY + Math.round(10 * uiScale));
      }
    } else {
      const rows = this.getEquipmentRows();
      const cursor = this.inventoryCursorByTab.equipment || 0;
      const startY = y + Math.round(74 * uiScale);
      const lineH = Math.round(21 * uiScale);
      const visibleRows = Math.max(1, Math.floor((panelH - Math.round(140 * uiScale)) / lineH));
      const startIndex = Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), Math.max(0, rows.length - visibleRows)));
      const endIndex = Math.min(rows.length, startIndex + visibleRows);

      ctx.font = `${Math.round(14 * uiScale)}px monospace`;
      if (rows.length === 0) {
        ctx.fillStyle = '#7d8894';
        ctx.fillText('(no equipment slots)', x + Math.round(20 * uiScale), startY);
      }

      for (let i = startIndex; i < endIndex; i++) {
        const rowY = startY + (i - startIndex) * lineH;
        const selected = i === cursor;
        if (selected) {
          ctx.fillStyle = '#2a313a';
          ctx.fillRect(
            x + Math.round(14 * uiScale),
            rowY - Math.round(14 * uiScale),
            listW - Math.round(20 * uiScale),
            Math.round(18 * uiScale)
          );
        }

        const row = rows[i];
        const baseX = x + Math.round(20 * uiScale);
        const label = `${this.formatSlotName(row.slot)}: `;
        ctx.fillStyle = selected ? '#ffffff' : '#c3cbd4';
        ctx.fillText(label, baseX, rowY);
        const itemX = baseX + ctx.measureText(label).width;
        if (row.item) {
          ctx.fillStyle = this.getRarityColor(row.item.rarity, selected ? '#ffffff' : '#c3cbd4');
          ctx.fillText(row.item.name, itemX, rowY);
        } else {
          ctx.fillStyle = '#7d8894';
          ctx.fillText('(empty)', itemX, rowY);
        }
      }
    }

    const inspectTarget = this.getSelectedInspectTarget();
    const details = this.getItemInspectLines(inspectTarget.item, inspectTarget.slotLabel);
    ctx.fillStyle = '#d6dbe2';
    ctx.font = `${Math.round(13 * uiScale)}px monospace`;
    ctx.fillText('Inspect', detailX, y + Math.round(68 * uiScale));
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    const detailLineH = Math.round(16 * uiScale);
    const maxDetailRows = Math.max(1, Math.floor((panelH - Math.round(160 * uiScale)) / detailLineH));
    for (let i = 0; i < Math.min(details.length, maxDetailRows); i++) {
      const line = details[i];
      const isTitle = i === 0;
      if (isTitle && inspectTarget.item) {
        ctx.fillStyle = this.getRarityColor(inspectTarget.item.rarity, '#ffffff');
      } else {
        ctx.fillStyle = isTitle ? '#ffffff' : '#b8c0ca';
      }
      ctx.fillText(line, detailX, y + Math.round(90 * uiScale) + i * detailLineH);
    }

    ctx.fillStyle = '#94a0ad';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText(
      'Arrows/WASD: move cursor  Tab/Left/Right: switch panel  Z/Enter: equip/unequip',
      x + Math.round(16 * uiScale),
      y + panelH - Math.round(40 * uiScale)
    );
    ctx.fillText(
      '1/2/3: assign to belt slot  C: auto belt  X: drop  U: unequip  I/ESC: close',
      x + Math.round(16 * uiScale),
      y + panelH - Math.round(20 * uiScale)
    );
  }

  drawStatsOverlay() {
    if (!this.player) return;
    const ctx = this.ctx;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(this.canvas.width, this.canvas.height) / 900));
    const panelW = Math.min(Math.round(520 * uiScale), this.canvas.width - 40);
    const panelH = Math.min(Math.round(420 * uiScale), this.canvas.height - 40);
    const x = Math.floor((this.canvas.width - panelW) / 2);
    const y = Math.floor((this.canvas.height - panelH) / 2);

    const totalStats = this.getEntityStatsWithEquipment(this.player);
    const equippedBonuses = getEquippedStats(this.player);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.74)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#15191f';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#5a6572';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(16 * uiScale)}px monospace`;
    ctx.fillText('Character Stats', x + Math.round(16 * uiScale), y + Math.round(28 * uiScale));

    ctx.font = `${Math.round(13 * uiScale)}px monospace`;
    ctx.fillStyle = '#cad4de';
    ctx.fillText(`Class: ${this.getClassLabel(this.player.playerClass)}`, x + Math.round(16 * uiScale), y + Math.round(58 * uiScale));
    ctx.fillText(`HP: ${this.player.hp}/${this.player.maxHp}`, x + Math.round(16 * uiScale), y + Math.round(78 * uiScale));
    ctx.fillText(`Floor: ${this.floorNumber}`, x + Math.round(180 * uiScale), y + Math.round(58 * uiScale));
    ctx.fillText(`Essence: ${this.player.gold}`, x + Math.round(180 * uiScale), y + Math.round(78 * uiScale));
    ctx.fillText(`Natural Regen: 1 HP every ${this.getNaturalRegenInterval()} turns`, x + Math.round(16 * uiScale), y + Math.round(98 * uiScale));

    const statStartY = y + Math.round(130 * uiScale);
    const rowH = Math.round(20 * uiScale);
    for (let i = 0; i < STAT_NAMES.length; i++) {
      const stat = STAT_NAMES[i];
      const total = totalStats[stat] || 0;
      const base = this.player.stats[stat] || 0;
      const bonus = equippedBonuses[stat] || 0;
      const bonusText = bonus === 0 ? '' : ` (${bonus > 0 ? '+' : ''}${bonus} gear)`;
      ctx.fillStyle = '#b8c3ce';
      ctx.fillText(`${stat}: ${total}${bonusText}`, x + Math.round(16 * uiScale), statStartY + i * rowH);
      ctx.fillStyle = '#6f7d8a';
      ctx.fillText(`Base ${base}`, x + Math.round(190 * uiScale), statStartY + i * rowH);
    }

    const skillStartY = statStartY + STAT_NAMES.length * rowH + Math.round(14 * uiScale);
    ctx.fillStyle = '#d8e3ee';
    ctx.fillText('Active Skills:', x + Math.round(16 * uiScale), skillStartY);
    const skills = this.player.activeSkills.length > 0 ? this.player.activeSkills : [];
    for (let i = 0; i < Math.min(3, skills.length); i++) {
      const skill = skills[i];
      ctx.fillStyle = '#9ab3c9';
      ctx.fillText(`${i + 1}. ${skill.name} (CD ${skill.currentCooldown}/${skill.cooldown})`, x + Math.round(28 * uiScale), skillStartY + Math.round((i + 1) * 18 * uiScale));
    }
    if (skills.length === 0) {
      ctx.fillStyle = '#7d8894';
      ctx.fillText('No skills equipped via gear.', x + Math.round(28 * uiScale), skillStartY + Math.round(18 * uiScale));
    }

    ctx.fillStyle = '#94a0ad';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText('P or ESC: close', x + Math.round(16 * uiScale), y + panelH - Math.round(18 * uiScale));
  }

  drawStartMenu() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.6, Math.min(w, h) / 900));
    const classKey = this.selectedClass;
    const classDef = PLAYER_CLASSES[classKey];

    ctx.fillStyle = '#090c12';
    ctx.fillRect(0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(28, 36, 52, 0.65)');
    gradient.addColorStop(1, 'rgba(5, 8, 12, 0.75)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const panelW = Math.min(Math.round(720 * uiScale), w - 50);
    const panelH = Math.min(Math.round(460 * uiScale), h - 50);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);

    ctx.fillStyle = 'rgba(16, 20, 29, 0.85)';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#4e5d73';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#f2f5f8';
    ctx.font = `${Math.round(46 * uiScale)}px monospace`;
    ctx.fillText('DIEGEIST', x + Math.round(26 * uiScale), y + Math.round(72 * uiScale));

    ctx.fillStyle = '#8ca2b8';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText('Select class with arrows, then press Enter to begin.', x + Math.round(26 * uiScale), y + Math.round(98 * uiScale));

    const baseY = y + Math.round(146 * uiScale);
    const rowH = Math.round(32 * uiScale);
    for (let i = 0; i < this.classOrder.length; i++) {
      const key = this.classOrder[i];
      const selected = i === this.startMenuIndex;
      if (selected) {
        ctx.fillStyle = '#2a3648';
        ctx.fillRect(x + Math.round(24 * uiScale), baseY - Math.round(19 * uiScale) + i * rowH, Math.round(250 * uiScale), Math.round(24 * uiScale));
      }
      ctx.fillStyle = selected ? '#ffffff' : '#9aa9b8';
      ctx.font = `${Math.round(18 * uiScale)}px monospace`;
      ctx.fillText(this.getClassLabel(key), x + Math.round(34 * uiScale), baseY + i * rowH);
    }

    const statX = x + Math.round(320 * uiScale);
    const statY = y + Math.round(152 * uiScale);
    ctx.fillStyle = '#d4dfeb';
    ctx.font = `${Math.round(16 * uiScale)}px monospace`;
    ctx.fillText(`${classDef.name} Base Stats`, statX, statY);
    ctx.font = `${Math.round(13 * uiScale)}px monospace`;
    for (let i = 0; i < STAT_NAMES.length; i++) {
      const stat = STAT_NAMES[i];
      ctx.fillStyle = '#aab8c7';
      ctx.fillText(`${stat}: ${classDef.baseStats[stat]}`, statX, statY + Math.round(24 * uiScale) + i * Math.round(18 * uiScale));
    }
    ctx.fillStyle = '#aab8c7';
    ctx.fillText(`HP: ${classDef.baseHp}`, statX, statY + Math.round(24 * uiScale) + STAT_NAMES.length * Math.round(18 * uiScale));

    const essence = this.saveData?.currency || 0;
    ctx.fillStyle = '#d9e5f2';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText(`Stored Essence: ${essence}`, x + Math.round(26 * uiScale), y + panelH - Math.round(46 * uiScale));
    ctx.fillStyle = '#7f94ab';
    ctx.fillText('Enter/Z: Start Run', x + Math.round(26 * uiScale), y + panelH - Math.round(22 * uiScale));
    ctx.fillText('H: Hub Menu', x + Math.round(210 * uiScale), y + panelH - Math.round(22 * uiScale));
  }

  drawDeathSplash() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.6, Math.min(w, h) / 900));

    ctx.fillStyle = 'rgba(75, 10, 10, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ff5a5a';
    ctx.font = `${Math.round(58 * uiScale)}px monospace`;
    ctx.fillText('YOU DIED', Math.round(w * 0.5 - 160 * uiScale), Math.round(h * 0.45));

    ctx.fillStyle = '#d3d9df';
    ctx.font = `${Math.round(15 * uiScale)}px monospace`;
    const cause = this.runSummary?.causeOfDeath || 'Unknown';
    ctx.fillText(`Killed by: ${cause}`, Math.round(w * 0.5 - 100 * uiScale), Math.round(h * 0.45) + Math.round(40 * uiScale));
    if (this.deathSplashFrames >= 25) {
      ctx.fillStyle = '#f2f6fb';
      ctx.fillText('Press Enter to continue', Math.round(w * 0.5 - 120 * uiScale), Math.round(h * 0.45) + Math.round(78 * uiScale));
    }
  }

  drawPostDeathMenu() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
    const panelW = Math.min(Math.round(520 * uiScale), w - 40);
    const panelH = Math.min(Math.round(360 * uiScale), h - 40);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);

    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#171d28';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#4f6075';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#e8eef5';
    ctx.font = `${Math.round(28 * uiScale)}px monospace`;
    ctx.fillText('Run Summary', x + Math.round(20 * uiScale), y + Math.round(44 * uiScale));

    ctx.fillStyle = '#afc0d2';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText(`Class: ${this.getClassLabel(this.runSummary?.classKey || this.selectedClass)}`, x + Math.round(20 * uiScale), y + Math.round(78 * uiScale));
    ctx.fillText(`Floors Reached: ${this.runSummary?.floorsReached || 1}`, x + Math.round(20 * uiScale), y + Math.round(100 * uiScale));
    ctx.fillText(`Enemies Killed: ${this.runSummary?.enemiesKilled || 0}`, x + Math.round(20 * uiScale), y + Math.round(122 * uiScale));
    ctx.fillText(`Essence Earned: ${this.runSummary?.currencyEarned || 0}`, x + Math.round(20 * uiScale), y + Math.round(144 * uiScale));

    const options = ['Retry', 'Hub', 'Main Menu'];
    for (let i = 0; i < options.length; i++) {
      const selected = i === this.postDeathMenuIndex;
      if (selected) {
        ctx.fillStyle = '#2b3a4d';
        ctx.fillRect(x + Math.round(18 * uiScale), y + Math.round(186 * uiScale) + i * Math.round(36 * uiScale), Math.round(170 * uiScale), Math.round(26 * uiScale));
      }
      ctx.fillStyle = selected ? '#ffffff' : '#9db0c4';
      ctx.font = `${Math.round(18 * uiScale)}px monospace`;
      ctx.fillText(options[i], x + Math.round(28 * uiScale), y + Math.round(206 * uiScale) + i * Math.round(36 * uiScale));
    }

    ctx.fillStyle = '#7d8e9f';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText('Up/Down: Select  Enter/Z: Confirm', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
  }

  drawVictoryScreen() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
    const panelW = Math.min(Math.round(620 * uiScale), w - 40);
    const panelH = Math.min(Math.round(360 * uiScale), h - 40);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);

    ctx.fillStyle = '#07110b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(27, 69, 45, 0.35)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#13251b';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#6baf7f';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#dbffe3';
    ctx.font = `${Math.round(34 * uiScale)}px monospace`;
    ctx.fillText('VICTORY', x + Math.round(20 * uiScale), y + Math.round(48 * uiScale));

    ctx.fillStyle = '#b7e3c2';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText('The Void Tyrant is slain. Diegeist is conquered.', x + Math.round(20 * uiScale), y + Math.round(82 * uiScale));
    ctx.fillText(`Class: ${this.getClassLabel(this.runSummary?.classKey || this.selectedClass)}`, x + Math.round(20 * uiScale), y + Math.round(112 * uiScale));
    ctx.fillText(`Floors Reached: ${this.runSummary?.floorsReached || this.floorNumber}`, x + Math.round(20 * uiScale), y + Math.round(134 * uiScale));
    ctx.fillText(`Enemies Killed: ${this.runSummary?.enemiesKilled || 0}`, x + Math.round(20 * uiScale), y + Math.round(156 * uiScale));
    ctx.fillText(`Essence Earned: ${this.runSummary?.currencyEarned || 0}`, x + Math.round(20 * uiScale), y + Math.round(178 * uiScale));

    ctx.fillStyle = '#86c99b';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText('Press Enter to return to main menu', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
    ctx.fillText('Press H to open Hub', x + Math.round(20 * uiScale), y + panelH - Math.round(36 * uiScale));
  }

  drawHubMenu() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
    const panelW = Math.min(Math.round(740 * uiScale), w - 40);
    const panelH = Math.min(Math.round(430 * uiScale), h - 40);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);
    const options = this.getHubMenuOptions();

    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#171d28';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#4f6075';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#e8eef5';
    ctx.font = `${Math.round(32 * uiScale)}px monospace`;
    ctx.fillText('HUB', x + Math.round(20 * uiScale), y + Math.round(46 * uiScale));

    ctx.fillStyle = '#b7c7d8';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText(`Essence: ${this.saveData?.currency || 0}`, x + Math.round(20 * uiScale), y + Math.round(78 * uiScale));
    const pendingText = this.pendingStashLoadoutItem
      ? `Pending loadout: ${this.pendingStashLoadoutItem.name}`
      : 'Pending loadout: none';
    ctx.fillText(pendingText, x + Math.round(220 * uiScale), y + Math.round(78 * uiScale));

    const optionY = y + Math.round(130 * uiScale);
    for (let i = 0; i < options.length; i++) {
      const selected = i === this.hubMenuIndex;
      if (selected) {
        ctx.fillStyle = '#2b3a4d';
        ctx.fillRect(x + Math.round(20 * uiScale), optionY - Math.round(20 * uiScale) + i * Math.round(38 * uiScale), Math.round(280 * uiScale), Math.round(28 * uiScale));
      }
      ctx.fillStyle = selected ? '#ffffff' : '#9db0c4';
      ctx.font = `${Math.round(18 * uiScale)}px monospace`;
      ctx.fillText(options[i], x + Math.round(30 * uiScale), optionY + i * Math.round(38 * uiScale));
    }

    ctx.fillStyle = '#9fb2c5';
    ctx.font = `${Math.round(13 * uiScale)}px monospace`;
    ctx.fillText(`Run stash candidates: ${this.hubRunCarryover.length}`, x + Math.round(340 * uiScale), y + Math.round(134 * uiScale));
    ctx.fillText(`Last run: ${this.runSummary?.causeOfDeath || 'N/A'}`, x + Math.round(340 * uiScale), y + Math.round(156 * uiScale));
    if (this.hubNotice) {
      ctx.fillStyle = '#d9e7f5';
      ctx.fillText(this.hubNotice, x + Math.round(340 * uiScale), y + Math.round(188 * uiScale));
    }

    ctx.fillStyle = '#7d8e9f';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText('Up/Down: Select  Enter/Z: Confirm  ESC: Back', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
  }

  drawHubShop() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
    const panelW = Math.min(Math.round(760 * uiScale), w - 40);
    const panelH = Math.min(Math.round(450 * uiScale), h - 40);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);

    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#171d28';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#4f6075';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#e8eef5';
    ctx.font = `${Math.round(28 * uiScale)}px monospace`;
    ctx.fillText('Hub Shop', x + Math.round(20 * uiScale), y + Math.round(42 * uiScale));
    ctx.fillStyle = '#b7c7d8';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText(`Essence: ${this.saveData?.currency || 0}`, x + Math.round(20 * uiScale), y + Math.round(68 * uiScale));

    const startY = y + Math.round(100 * uiScale);
    const lineH = Math.round(32 * uiScale);
    for (let i = 0; i < this.hubShop.items.length; i++) {
      const item = this.hubShop.items[i];
      const selected = i === this.hubShopCursor;
      if (selected) {
        ctx.fillStyle = '#2b3a4d';
        ctx.fillRect(x + Math.round(18 * uiScale), startY - Math.round(18 * uiScale) + i * lineH, panelW - Math.round(36 * uiScale), Math.round(24 * uiScale));
      }
      ctx.fillStyle = selected ? '#ffffff' : '#b8c7d7';
      ctx.font = `${Math.round(15 * uiScale)}px monospace`;
      ctx.fillText(item.name, x + Math.round(28 * uiScale), startY + i * lineH);
      ctx.fillStyle = '#8fa5bb';
      ctx.font = `${Math.round(12 * uiScale)}px monospace`;
      ctx.fillText(`${item.category}  |  cost ${item.cost}`, x + Math.round(320 * uiScale), startY + i * lineH);
    }
    if (this.hubShop.items.length === 0) {
      ctx.fillStyle = '#94a7bb';
      ctx.fillText('No items available. Return to hub and refresh later.', x + Math.round(24 * uiScale), startY);
    }
    if (this.hubNotice) {
      ctx.fillStyle = '#d9e7f5';
      ctx.font = `${Math.round(12 * uiScale)}px monospace`;
      ctx.fillText(this.hubNotice, x + Math.round(20 * uiScale), y + panelH - Math.round(48 * uiScale));
    }
    ctx.fillStyle = '#7d8e9f';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText('Up/Down: Select  Enter/Z: Buy  ESC: Back', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
  }

  drawHubStash() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
    const panelW = Math.min(Math.round(860 * uiScale), w - 40);
    const panelH = Math.min(Math.round(460 * uiScale), h - 40);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);
    const paneW = Math.floor((panelW - Math.round(56 * uiScale)) / 2);
    const leftX = x + Math.round(20 * uiScale);
    const rightX = leftX + paneW + Math.round(16 * uiScale);
    const startY = y + Math.round(90 * uiScale);
    const lineH = Math.round(24 * uiScale);

    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#171d28';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#4f6075';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#e8eef5';
    ctx.font = `${Math.round(28 * uiScale)}px monospace`;
    ctx.fillText('Stash', x + Math.round(20 * uiScale), y + Math.round(42 * uiScale));
    ctx.fillStyle = '#a7b7c7';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText('Left pane: persistent stash  |  Right pane: last run items', x + Math.round(20 * uiScale), y + Math.round(66 * uiScale));

    ctx.strokeStyle = this.hubStashPane === 'stash' ? '#d9ecff' : '#394754';
    ctx.strokeRect(leftX, y + Math.round(78 * uiScale), paneW, panelH - Math.round(132 * uiScale));
    ctx.strokeStyle = this.hubStashPane === 'run' ? '#d9ecff' : '#394754';
    ctx.strokeRect(rightX, y + Math.round(78 * uiScale), paneW, panelH - Math.round(132 * uiScale));

    ctx.fillStyle = '#d7e3f0';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText(`Stash (${this.saveData.stash.length})`, leftX + Math.round(8 * uiScale), y + Math.round(98 * uiScale));
    ctx.fillText(`Run Items (${this.hubRunCarryover.length})`, rightX + Math.round(8 * uiScale), y + Math.round(98 * uiScale));

    const stashItems = this.saveData.stash || [];
    for (let i = 0; i < Math.min(12, stashItems.length); i++) {
      const selected = this.hubStashPane === 'stash' && i === this.hubStashCursor;
      if (selected) {
        ctx.fillStyle = '#2b3a4d';
        ctx.fillRect(leftX + Math.round(6 * uiScale), startY - Math.round(16 * uiScale) + i * lineH, paneW - Math.round(12 * uiScale), Math.round(20 * uiScale));
      }
      ctx.fillStyle = selected ? '#ffffff' : this.getRarityColor(stashItems[i].rarity, '#b6c6d6');
      ctx.font = `${Math.round(12 * uiScale)}px monospace`;
      ctx.fillText(this.truncateLabel(stashItems[i].name, 24), leftX + Math.round(10 * uiScale), startY + i * lineH);
    }

    for (let i = 0; i < Math.min(12, this.hubRunCarryover.length); i++) {
      const selected = this.hubStashPane === 'run' && i === this.hubRunItemsCursor;
      if (selected) {
        ctx.fillStyle = '#2b3a4d';
        ctx.fillRect(rightX + Math.round(6 * uiScale), startY - Math.round(16 * uiScale) + i * lineH, paneW - Math.round(12 * uiScale), Math.round(20 * uiScale));
      }
      const item = this.hubRunCarryover[i];
      ctx.fillStyle = selected ? '#ffffff' : this.getRarityColor(item.rarity, '#b6c6d6');
      ctx.font = `${Math.round(12 * uiScale)}px monospace`;
      ctx.fillText(this.truncateLabel(item.name, 24), rightX + Math.round(10 * uiScale), startY + i * lineH);
    }

    ctx.fillStyle = '#d9e7f5';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    const pending = this.pendingStashLoadoutItem ? this.pendingStashLoadoutItem.name : 'none';
    ctx.fillText(`Pending loadout item: ${pending}`, x + Math.round(20 * uiScale), y + panelH - Math.round(48 * uiScale));
    if (this.hubNotice) ctx.fillText(this.hubNotice, x + Math.round(20 * uiScale), y + panelH - Math.round(30 * uiScale));

    ctx.fillStyle = '#7d8e9f';
    ctx.fillText('Left/Right: switch pane  Up/Down: select  Enter/Z: move item  ESC: Back', x + Math.round(20 * uiScale), y + panelH - Math.round(12 * uiScale));
  }

  drawHubAchievements() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
    const panelW = Math.min(Math.round(860 * uiScale), w - 40);
    const panelH = Math.min(Math.round(460 * uiScale), h - 40);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);
    const listW = Math.round(panelW * 0.48);
    const detailX = x + listW + Math.round(20 * uiScale);
    const startY = y + Math.round(90 * uiScale);
    const lineH = Math.round(26 * uiScale);

    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#171d28';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#4f6075';
    ctx.strokeRect(x, y, panelW, panelH);
    ctx.beginPath();
    ctx.moveTo(x + listW, y + Math.round(70 * uiScale));
    ctx.lineTo(x + listW, y + panelH - Math.round(20 * uiScale));
    ctx.stroke();

    ctx.fillStyle = '#e8eef5';
    ctx.font = `${Math.round(28 * uiScale)}px monospace`;
    ctx.fillText('Achievements', x + Math.round(20 * uiScale), y + Math.round(42 * uiScale));

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const ach = ACHIEVEMENTS[i];
      const record = this.saveData.achievements[ach.id] || { progress: 0, unlocked: false };
      const selected = i === this.hubAchievementsCursor;
      if (selected) {
        ctx.fillStyle = '#2b3a4d';
        ctx.fillRect(x + Math.round(16 * uiScale), startY - Math.round(17 * uiScale) + i * lineH, listW - Math.round(28 * uiScale), Math.round(22 * uiScale));
      }
      ctx.fillStyle = record.unlocked ? '#9ce2a3' : (selected ? '#ffffff' : '#b8c7d7');
      ctx.font = `${Math.round(13 * uiScale)}px monospace`;
      ctx.fillText(`${ach.name}`, x + Math.round(22 * uiScale), startY + i * lineH);
    }

    const selectedAchievement = this.getSelectedAchievement();
    if (selectedAchievement) {
      const record = this.saveData.achievements[selectedAchievement.id] || { progress: 0, unlocked: false };
      const target = selectedAchievement.condition?.count || 1;
      ctx.fillStyle = '#d7e3f0';
      ctx.font = `${Math.round(16 * uiScale)}px monospace`;
      ctx.fillText(selectedAchievement.name, detailX, y + Math.round(96 * uiScale));
      ctx.font = `${Math.round(12 * uiScale)}px monospace`;
      ctx.fillStyle = '#afc0d2';
      ctx.fillText(selectedAchievement.description, detailX, y + Math.round(124 * uiScale));
      ctx.fillText(`Progress: ${Math.min(record.progress || 0, target)} / ${target}`, detailX, y + Math.round(148 * uiScale));
      ctx.fillStyle = record.unlocked ? '#9ce2a3' : '#c8d4e0';
      ctx.fillText(record.unlocked ? 'Unlocked' : 'Locked', detailX, y + Math.round(172 * uiScale));
    }

    if (this.hubNotice) {
      ctx.fillStyle = '#d9e7f5';
      ctx.font = `${Math.round(12 * uiScale)}px monospace`;
      ctx.fillText(this.hubNotice, x + Math.round(20 * uiScale), y + panelH - Math.round(34 * uiScale));
    }
    ctx.fillStyle = '#7d8e9f';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText('Up/Down: Select  ESC: Back', x + Math.round(20 * uiScale), y + panelH - Math.round(14 * uiScale));
  }

  draw(nowMs = this.getNowMs()) {
    if (this.state === 'startMenu') {
      this.drawStartMenu();
      return;
    }

    if (this.state === 'postDeathMenu') {
      this.drawPostDeathMenu();
      return;
    }

    if (this.state === 'victory') {
      this.drawVictoryScreen();
      return;
    }
    if (this.state === 'hubMenu') {
      this.drawHubMenu();
      return;
    }
    if (this.state === 'hubShop') {
      this.drawHubShop();
      return;
    }
    if (this.state === 'hubStash') {
      this.drawHubStash();
      return;
    }
    if (this.state === 'hubAchievements') {
      this.drawHubAchievements();
      return;
    }

    if (!this.map || !this.player) {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.renderer.render({ map: this.map, player: this.player });
    this.drawCombatVfx(nowMs);
    this.hud.draw(this.player, this.messageLog, this.getEntityStatsWithEquipment(this.player));

    if (this.state === 'deathSplash') {
      this.drawDeathSplash();
      return;
    }

    if (this.inventoryOpen) this.drawInventoryOverlay();
    if (this.statsOpen) this.drawStatsOverlay();
  }

  loop(nowMs = null) {
    const frameNow = typeof nowMs === 'number' ? nowMs : this.getNowMs();
    this.update();
    this.updateCombatVfx(frameNow);
    this.draw(frameNow);
    requestAnimationFrame(nextMs => this.loop(nextMs));
  }
}

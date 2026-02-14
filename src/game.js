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
import { generateItem, generateConsumable } from './items.js';
import { addToInventory, assignToBelt, equipItem, getEquippedStats, removeFromInventory, unequipItem, useBeltSlot } from './inventory.js';
import { canUseSkill, tickCooldowns, updateActiveSkills, useSkill } from './skills.js';
import { loadSaveData, persistSaveData } from './progression.js';
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
    if (this.audio) this.audio.itemPickup();

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
    const rows = this.inventoryTab === 'inventory' ? this.player.inventory : this.getEquipmentRows();
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

  switchInventoryTab(direction) {
    this.inventoryTab = direction > 0 ? 'equipment' : 'inventory';
    this.clampInventoryCursor();
    if (this.audio) this.audio.uiClick();
  }

  moveInventoryCursor(delta) {
    const rows = this.inventoryTab === 'inventory' ? this.player.inventory : this.getEquipmentRows();
    if (rows.length === 0) return;
    const current = this.inventoryCursorByTab[this.inventoryTab] || 0;
    const maxIndex = rows.length - 1;
    this.inventoryCursorByTab[this.inventoryTab] = Math.max(0, Math.min(current + delta, maxIndex));
    if (this.audio) this.audio.uiClick();
  }

  dropItemAtPlayer(item) {
    this.map.items.push({
      ...item,
      position: { x: this.player.position.x, y: this.player.position.y },
    });
    this.messageLog.add(`You drop ${item.name}.`, this.turnCount);
  }

  handleInventoryOverlayAction(action) {
    if (action.type === 'inventory' || action.type === 'close') {
      this.inventoryOpen = false;
      if (this.audio) this.audio.uiClick();
      return;
    }

    if (action.type === 'move') {
      if (action.dx !== 0) {
        this.switchInventoryTab(action.dx);
        return;
      }
      if (action.dy !== 0) {
        this.moveInventoryCursor(action.dy);
      }
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
        if (item.type !== 'consumable') {
          this.messageLog.add('Only consumables can go in the belt.', this.turnCount);
          return;
        }
        let beltSlot = this.player.belt.findIndex(s => s === null);
        if (beltSlot === -1) beltSlot = 0;
        if (assignToBelt(this.player, item.id, beltSlot)) {
          this.messageLog.add(`${item.name} assigned to belt slot ${beltSlot + 1}.`, this.turnCount);
          this.clampInventoryCursor();
          if (this.audio) this.audio.uiClick();
        }
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

    for (const enemy of targets) {
      const result = this.resolveCombat(this.player, enemy, {
        baseDamage: skill.damage,
        damageType,
        weaponMultiplier: 1.0,
      });
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

    const killCurrency = 3 + Math.floor(Math.random() * 3);
    this.player.gold += killCurrency;
    this.runSummary.currencyEarned += killCurrency;

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
        const optionCount = 2;
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
      } else {
        this.state = 'startMenu';
      }
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
    } else {
      this.player.moveTo(startX, startY);
      this.player.floorNumber = this.floorNumber;
      this.player.energy = 0;
      this.player.heal(Math.ceil(this.player.maxHp * 0.2));
    }

    this.turnSystem.addEntity(this.player);
    updateActiveSkills(this.player);

    // Spawn 3-5 wandering enemies in standard rooms
    const standardRooms = this.map.rooms.filter(r => r.type === 'standard');
    const numEnemies = 3 + Math.floor(Math.random() * 3); // 3-5 enemies

    for (let i = 0; i < numEnemies && i < standardRooms.length; i++) {
      const room = standardRooms[i];
      const enemyX = room.x + Math.floor(Math.random() * room.width);
      const enemyY = room.y + Math.floor(Math.random() * room.height);

      // Randomize enemy type
      const enemyTypes = [
        { name: 'Rat', maxHp: 5, speed: 100, stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 }, spriteKey: 'rat', behavior: 'rushdown' },
        { name: 'Bat', maxHp: 3, speed: 150, stats: { STR: 2, DEX: 5, CON: 2, INT: 1, WIS: 1, LCK: 3 }, spriteKey: 'bat', behavior: 'wander' },
        { name: 'Shade', maxHp: 6, speed: 120, stats: { STR: 4, DEX: 4, CON: 3, INT: 2, WIS: 2, LCK: 3 }, spriteKey: 'trap', behavior: 'ambush' },
        { name: 'Cultist', maxHp: 7, speed: 90, stats: { STR: 2, DEX: 2, CON: 4, INT: 5, WIS: 4, LCK: 2 }, spriteKey: 'cultist', behavior: 'summoner' },
      ];
      const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

      const enemy = new Entity({
        id: `enemy_${i}`,
        type: 'enemy',
        x: enemyX,
        y: enemyY,
        stats: enemyType.stats,
        maxHp: enemyType.maxHp,
        speed: enemyType.speed,
        behavior: enemyType.behavior,
        name: enemyType.name,
      });
      enemy.spriteKey = enemyType.spriteKey;
      if (enemy.behavior === 'summoner') {
        enemy.summonCooldown = 2 + Math.floor(Math.random() * 2);
      }
      this.map.entities.push(enemy);
      this.turnSystem.addEntity(enemy);
    }
    this.spawnFloorItems(standardRooms);

    if (this.floorNumber === 1 && this.turnCount === 0) {
      this.messageLog.add('Welcome to Diegeist. Move with arrow keys or WASD.', this.turnCount);
      this.messageLog.add('Attack by moving into an enemy tile.', this.turnCount);
      this.messageLog.add('Press G to pick up items. Press I to manage inventory.', this.turnCount);
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

      // Check for enemy at target position (bump-to-attack)
      const enemy = this.map.entities.find(e =>
        e.type === 'enemy' && e.isAlive() && e.position.x === nx && e.position.y === ny
      );
      if (enemy) {
        const result = this.resolveCombat(this.player, enemy, { baseDamage: 3, damageType: 'melee', weaponMultiplier: 1.0 });

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
      const result = this.resolveCombat(entity, this.player, {
        baseDamage: 2,
        damageType: action.damageType || 'melee',
        weaponMultiplier: 1.0
      });

      if (result.dodged) {
        this.messageLog.add(`You dodge the ${entity.name}'s attack!`, this.turnCount);
      } else if (result.killed) {
        this.messageLog.add(`You have been slain by the ${entity.name}!`, this.turnCount);
        this.finalizeRun(entity.name);
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

    if (action.type === 'inventory') {
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

    const rows = this.inventoryTab === 'inventory' ? this.player.inventory : this.getEquipmentRows();
    const cursor = this.inventoryCursorByTab[this.inventoryTab] || 0;
    const startY = y + Math.round(74 * uiScale);
    const lineH = Math.round(21 * uiScale);
    const visibleRows = Math.max(1, Math.floor((panelH - Math.round(140 * uiScale)) / lineH));
    const startIndex = Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), Math.max(0, rows.length - visibleRows)));
    const endIndex = Math.min(rows.length, startIndex + visibleRows);

    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    if (rows.length === 0) {
      ctx.fillStyle = '#7d8894';
      ctx.fillText(this.inventoryTab === 'inventory' ? '(no items)' : '(no equipment slots)', x + Math.round(20 * uiScale), startY);
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

      if (this.inventoryTab === 'inventory') {
        const item = rows[i];
        const slotText = item.slot ? ` [${this.formatSlotName(item.slot)}]` : '';
        ctx.fillStyle = selected ? '#ffffff' : '#c3cbd4';
        ctx.fillText(`${i + 1}. ${item.name}${slotText}`, x + Math.round(20 * uiScale), rowY);
      } else {
        const row = rows[i];
        const itemText = row.item ? row.item.name : '(empty)';
        const color = row.item ? (selected ? '#ffffff' : '#c3cbd4') : '#7d8894';
        ctx.fillStyle = color;
        ctx.fillText(`${this.formatSlotName(row.slot)}: ${itemText}`, x + Math.round(20 * uiScale), rowY);
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
      ctx.fillStyle = isTitle ? '#ffffff' : '#b8c0ca';
      ctx.fillText(line, detailX, y + Math.round(90 * uiScale) + i * detailLineH);
    }

    ctx.fillStyle = '#94a0ad';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText(
      'Left/Right: switch tab  Up/Down: select  Z or Enter: equip/unequip',
      x + Math.round(16 * uiScale),
      y + panelH - Math.round(40 * uiScale)
    );
    ctx.fillText(
      'X: drop  C: belt (consumable)  U: unequip  I/ESC: close',
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

    const options = ['Retry', 'Main Menu'];
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

  draw() {
    if (this.state === 'startMenu') {
      this.drawStartMenu();
      return;
    }

    if (this.state === 'postDeathMenu') {
      this.drawPostDeathMenu();
      return;
    }

    if (!this.map || !this.player) {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.renderer.render({ map: this.map, player: this.player });
    this.hud.draw(this.player, this.messageLog, this.getEntityStatsWithEquipment(this.player));

    if (this.state === 'deathSplash') {
      this.drawDeathSplash();
      return;
    }

    if (this.inventoryOpen) this.drawInventoryOverlay();
    if (this.statsOpen) this.drawStatsOverlay();
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

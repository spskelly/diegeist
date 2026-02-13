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
import { TILE, FOV_RADIUS } from './constants.js';
import { Entity } from './entity.js';
import { generateDungeon } from './dungeon-gen.js';
import { resolveAttack } from './combat.js';
import { getAIAction } from './ai.js';
import { generateItem, generateConsumable } from './items.js';
import { addToInventory, assignToBelt, equipItem, getEquippedStats, unequipItem, useBeltSlot } from './inventory.js';
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
  }

  init() {
    this.saveData = loadSaveData();
    this.runSummary = {
      classKey: 'fighter',
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
    this.camera = new Camera(this.canvas.width, this.canvas.height - 80);
    this.renderer = new Renderer(this.canvas, this.sprites, this.camera);
    this.hud = new HUD(this.ctx, this.canvas.width, this.canvas.height);
    this.input.start();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    this.startFloor();
    this.state = 'playing';
    this.loop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) this.camera.resize(this.canvas.width, this.canvas.height - 80);
    if (this.hud) this.hud.resize(this.canvas.width, this.canvas.height);
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

  handleInventoryAction() {
    const equippable = this.player.inventory.find(i => i.slot);
    if (equippable) {
      equipItem(this.player, equippable.id);
      updateActiveSkills(this.player);
      this.messageLog.add(`You equip ${equippable.name}.`, this.turnCount);
      if (this.audio) this.audio.uiClick();
      return true;
    }

    const equippedSlot = Object.keys(this.player.equipment).find(slot => this.player.equipment[slot]);
    if (equippedSlot) {
      const itemName = this.player.equipment[equippedSlot].name;
      if (unequipItem(this.player, equippedSlot)) {
        updateActiveSkills(this.player);
        this.messageLog.add(`You unequip ${itemName}.`, this.turnCount);
        if (this.audio) this.audio.uiClick();
        return true;
      }
      this.messageLog.add('No room to unequip that item.', this.turnCount);
      return false;
    }

    this.messageLog.add('You have no equipment to manage.', this.turnCount);
    return false;
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
      this.player = createPlayer('fighter', startX, startY, this.saveData?.permanentStats || {});
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
        { name: 'Bat', maxHp: 3, speed: 150, stats: { STR: 2, DEX: 5, CON: 2, INT: 1, WIS: 1, LCK: 3 }, spriteKey: 'door', behavior: 'wander' },
        { name: 'Shade', maxHp: 6, speed: 120, stats: { STR: 4, DEX: 4, CON: 3, INT: 2, WIS: 2, LCK: 3 }, spriteKey: 'trap', behavior: 'ambush' },
        { name: 'Cultist', maxHp: 7, speed: 90, stats: { STR: 2, DEX: 2, CON: 4, INT: 5, WIS: 4, LCK: 2 }, spriteKey: 'door', behavior: 'summoner' },
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
      this.map.entities.push(enemy);
      this.turnSystem.addEntity(enemy);
    }
    this.spawnFloorItems(standardRooms);

    if (this.floorNumber === 1 && this.turnCount === 0) {
      this.messageLog.add('Welcome to Diegeist. Move with arrow keys or WASD.', this.turnCount);
      this.messageLog.add('Press G to pick up items. Press I to equip/unequip.', this.turnCount);
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
    if (action.type === 'inventory') {
      return this.handleInventoryAction();
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
        this.state = 'gameover';
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
    if (this.state === 'gameover') return;
    if (this.state !== 'playing') return;

    const action = this.input.consume();
    if (!action) return;

    const usedSkill = action.type === 'skill' ? this.player.activeSkills[action.slot] || null : null;
    const acted = this.processPlayerAction(action);
    if (!acted) return;

    tickCooldowns(this.player, usedSkill);
    this.player.spendTurn();
    this.turnCount++;

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
        if (this.state === 'gameover') break;
      }

      if (playerReady || this.state === 'gameover') break;
    }

    computeFOV(this.map, this.player.position.x, this.player.position.y, FOV_RADIUS);
    this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
    this.runSummary.floorsReached = Math.max(this.runSummary.floorsReached, this.floorNumber);
  }

  draw() {
    this.renderer.render({ map: this.map, player: this.player });
    this.hud.draw(this.player, this.messageLog);
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

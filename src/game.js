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
  }

  init() {
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

    this.player = createPlayer('fighter', startX, startY);
    this.turnSystem.addEntity(this.player);

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

    this.messageLog.add('Welcome to Diegeist. Move with arrow keys or WASD.', this.turnCount);
    this.messageLog.add('Press Space or . to wait a turn.', this.turnCount);

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
        const result = resolveAttack(this.player, enemy, { baseDamage: 3, damageType: 'melee', weaponMultiplier: 1.0 });

        if (result.dodged) {
          this.messageLog.add(`The ${enemy.name} dodges your attack!`, this.turnCount);
        } else if (result.killed) {
          this.messageLog.add(`You killed the ${enemy.name}!`, this.turnCount);
          this.turnSystem.removeEntity(enemy.id);
        } else {
          const critMsg = result.crit ? ' (CRITICAL!)' : '';
          this.messageLog.add(`You hit the ${enemy.name} for ${result.damage} damage!${critMsg}`, this.turnCount);
        }
        return true;
      }

      if (this.map.isWalkable(nx, ny)) {
        this.player.moveTo(nx, ny);
        const dirs = { '0,-1': 'north', '0,1': 'south', '-1,0': 'west', '1,0': 'east' };
        this.messageLog.add(`You move ${dirs[`${action.dx},${action.dy}`]}.`, this.turnCount);
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
    return false;
  }

  processEnemyTurn(entity) {
    const action = getAIAction(entity, this.player, this.map, this.map.entities);

    if (action.type === 'move') {
      entity.moveTo(action.x, action.y);
    } else if (action.type === 'attack') {
      const result = resolveAttack(entity, this.player, {
        baseDamage: 2,
        damageType: action.damageType || 'melee',
        weaponMultiplier: 1.0
      });

      if (result.dodged) {
        this.messageLog.add(`You dodge the ${entity.name}'s attack!`, this.turnCount);
      } else if (result.killed) {
        this.messageLog.add(`You have been slain by the ${entity.name}!`, this.turnCount);
        this.state = 'gameover';
      } else {
        const critMsg = result.crit ? ' (CRITICAL!)' : '';
        this.messageLog.add(`The ${entity.name} hits you for ${result.damage} damage!${critMsg}`, this.turnCount);
      }
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
    this.floorNumber++;
    const archetypes = ['corridor-heavy', 'cavernous', 'hybrid'];
    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    // Clear old entities from turn system
    this.turnSystem = new TurnSystem();

    this.startFloor();
    this.messageLog.add(`You descend to floor ${this.floorNumber}.`, this.turnCount);
    return true;
  }

  update() {
    if (this.state === 'gameover') return;
    if (this.state !== 'playing') return;

    const action = this.input.consume();
    if (!action) return;

    const acted = this.processPlayerAction(action);
    if (!acted) return;

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

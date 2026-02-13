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

    this.startTestMap();
    this.state = 'playing';
    this.loop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) this.camera.resize(this.canvas.width, this.canvas.height - 80);
    if (this.hud) this.hud.resize(this.canvas.width, this.canvas.height);
  }

  startTestMap() {
    const w = 40, h = 30;
    this.map = new GameMap(w, h);

    // Room 1
    for (let y = 2; y < 10; y++)
      for (let x = 2; x < 12; x++)
        this.map.setTile(x, y, TILE.FLOOR);

    // Corridor
    for (let x = 12; x < 20; x++)
      this.map.setTile(x, 5, TILE.CORRIDOR);

    // Room 2
    for (let y = 2; y < 10; y++)
      for (let x = 20; x < 30; x++)
        this.map.setTile(x, y, TILE.FLOOR);

    // Room 3 (connected to room 1 going south)
    for (let y = 10; y < 11; y++)
      for (let x = 5; x < 7; x++)
        this.map.setTile(x, y, TILE.CORRIDOR);
    for (let y = 11; y < 18; y++)
      for (let x = 2; x < 10; x++)
        this.map.setTile(x, y, TILE.FLOOR);

    // Doors
    this.map.setTile(12, 5, TILE.DOOR);
    this.map.setTile(19, 5, TILE.DOOR);

    // Stairs
    this.map.setTile(25, 5, TILE.STAIRS_DOWN);

    // Water hazard in room 3
    this.map.setTile(4, 14, TILE.WATER);
    this.map.setTile(5, 14, TILE.WATER);
    this.map.setTile(6, 14, TILE.WATER);

    // Trap in room 2
    this.map.setTile(24, 7, TILE.TRAP);

    // Player
    this.player = createPlayer('fighter', 5, 5);
    this.turnSystem.addEntity(this.player);

    // Test NPC enemies
    const rat = new Entity({
      id: 'rat_1', type: 'enemy', x: 24, y: 4,
      stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 },
      maxHp: 5, speed: 100, behavior: 'wander', name: 'Rat',
    });
    rat.spriteKey = 'trap';
    this.map.entities.push(rat);
    this.turnSystem.addEntity(rat);

    const bat = new Entity({
      id: 'bat_1', type: 'enemy', x: 22, y: 7,
      stats: { STR: 2, DEX: 5, CON: 2, INT: 1, WIS: 1, LCK: 3 },
      maxHp: 3, speed: 150, behavior: 'wander', name: 'Bat',
    });
    bat.spriteKey = 'door';
    this.map.entities.push(bat);
    this.turnSystem.addEntity(bat);

    this.messageLog.add('Welcome to Diegeist. Move with arrow keys or WASD.', this.turnCount);
    this.messageLog.add('Press Space or . to wait a turn.', this.turnCount);

    computeFOV(this.map, this.player.position.x, this.player.position.y, FOV_RADIUS);
    this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
  }

  processPlayerAction(action) {
    if (action.type === 'move') {
      const nx = this.player.position.x + action.dx;
      const ny = this.player.position.y + action.dy;

      // Check for enemy at target position (bump-to-attack placeholder)
      const enemy = this.map.entities.find(e =>
        e.type === 'enemy' && e.isAlive() && e.position.x === nx && e.position.y === ny
      );
      if (enemy) {
        this.messageLog.add(`You bump into the ${enemy.name}!`, this.turnCount);
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
    return false;
  }

  processEnemyTurn(entity) {
    if (entity.behavior === 'wander') {
      const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
      const shuffled = dirs.sort(() => Math.random() - 0.5);
      for (const d of shuffled) {
        const nx = entity.position.x + d.dx;
        const ny = entity.position.y + d.dy;
        if (this.map.isWalkable(nx, ny)) {
          // Don't move onto player or other enemies
          const blocked = (nx === this.player.position.x && ny === this.player.position.y) ||
            this.map.entities.some(e => e !== entity && e.isAlive() && e.position.x === nx && e.position.y === ny);
          if (!blocked) {
            entity.moveTo(nx, ny);
            break;
          }
        }
      }
    }
    entity.spendTurn();
  }

  update() {
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
      }

      if (playerReady) break;
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

# Diegeist: Full Build Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete roguelite dungeon crawler as a single-file PWA from the spec at `diegeist-spec.md`.

**Architecture:** Develop as ES modules in `src/` for testability with Vitest. A simple build script (`build.js`) concatenates all source into a single `dist/diegeist.html`. Game logic is pure functions/classes with no DOM coupling — canvas rendering and input are thin adapters. This enables full TDD on the core engine while the final deliverable is one HTML file.

**Tech Stack:** Vanilla JS (ES modules during dev), HTML5 Canvas, Web Audio API, Vitest for testing, Node.js build script for assembly.

---

## Architecture Overview

### Project Structure
```
diegeist/
├── diegeist-spec.md
├── package.json
├── vitest.config.js
├── build.js                  # assembles src/ + template into single HTML
├── template.html             # HTML shell: canvas, HUD elements, CSS
├── src/
│   ├── constants.js          # tile types, game constants, tuning params
│   ├── game-map.js           # Map class: 2D tile grid, explored/visible
│   ├── entity.js             # Base Entity class
│   ├── player.js             # Player class extends Entity
│   ├── turn-system.js        # Energy/tick scheduler
│   ├── camera.js             # Viewport math (no canvas dependency)
│   ├── fov.js                # Recursive shadowcasting
│   ├── pathfinding.js        # A*/BFS for enemy AI
│   ├── combat.js             # Damage calc, attack resolution
│   ├── ai.js                 # Enemy behavior types
│   ├── dungeon-gen.js        # BSP room generation
│   ├── items.js              # Item generation, rarity, loot tables
│   ├── inventory.js          # Equip/unequip, belt, backpack
│   ├── skills.js             # Gear-bound skills, cooldowns
│   ├── progression.js        # Meta-currency, stash, achievements, shop
│   ├── sprites.js            # Programmatic sprite generation
│   ├── renderer.js           # Canvas rendering pipeline
│   ├── audio.js              # Web Audio procedural sounds
│   ├── input.js              # Keyboard handler
│   ├── hud.js                # HUD + message log rendering
│   ├── message-log.js        # Message log data structure
│   └── game.js               # Main game loop, state machine
├── tests/
│   ├── constants.test.js
│   ├── game-map.test.js
│   ├── entity.test.js
│   ├── player.test.js
│   ├── turn-system.test.js
│   ├── camera.test.js
│   ├── fov.test.js
│   ├── pathfinding.test.js
│   ├── combat.test.js
│   ├── ai.test.js
│   ├── dungeon-gen.test.js
│   ├── items.test.js
│   ├── inventory.test.js
│   ├── skills.test.js
│   ├── progression.test.js
│   └── message-log.test.js
└── dist/
    └── diegeist.html
```

### Key Design Decisions

1. **Pure logic separation:** All game logic (map, combat, turns, items, AI) is pure JS with no DOM/Canvas dependency. Tests run in Node via Vitest without jsdom.
2. **Thin rendering adapter:** `renderer.js` is the only module that touches Canvas. It reads game state and draws. Not unit-tested — verified visually and via integration.
3. **Build assembly:** `build.js` reads `template.html`, injects all `src/*.js` contents (stripped of import/export) into a `<script>` block. Output: `dist/diegeist.html`.
4. **Sprite approach:** Programmatic canvas sprites (drawn to offscreen canvases at init, cached). Provides maximum flexibility for the dark/grim aesthetic.

---

## Phase 1: Engine Core

### Parallel Workstreams

Phase 1 tasks are organized into independent streams that can be developed concurrently:

| Stream | Tasks | Dependencies |
|--------|-------|-------------|
| A: Data Layer | T1 (setup), T2 (constants), T3 (map) | None |
| B: Entities | T4 (entity), T5 (player) | T2 |
| C: Turn System | T6 (turn system) | T4 |
| D: Camera | T7 (camera) | T2 |
| E: UI Layer | T8 (message log), T9 (input) | T5 |
| F: Rendering | T10 (sprites), T11 (renderer), T12 (HUD) | T3, T5, T7 |
| G: Integration | T13 (game loop), T14 (build + template) | All above |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "diegeist",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "node build.js"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
  },
});
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
```

**Step 4: Install dependencies**

Run: `npm install`
Expected: vitest installed, `node_modules/` created.

**Step 5: Verify vitest runs (no tests yet)**

Run: `npx vitest run`
Expected: "No test files found" or similar — no crash.

**Step 6: Commit**

```bash
git add package.json vitest.config.js .gitignore
git commit -m "chore: project scaffolding with vitest"
```

---

### Task 2: Constants & Tile Types

**Files:**
- Create: `src/constants.js`
- Create: `tests/constants.test.js`

**Step 1: Write failing test**

```js
// tests/constants.test.js
import { describe, it, expect } from 'vitest';
import { TILE, TILE_SIZE, ENERGY_THRESHOLD, PLAYER_CLASSES } from '../src/constants.js';

describe('Constants', () => {
  it('defines all tile types with correct IDs', () => {
    expect(TILE.WALL).toBe(0);
    expect(TILE.FLOOR).toBe(1);
    expect(TILE.CORRIDOR).toBe(2);
    expect(TILE.DOOR).toBe(3);
    expect(TILE.STAIRS_DOWN).toBe(4);
    expect(TILE.WATER).toBe(5);
    expect(TILE.TRAP).toBe(6);
  });

  it('defines tile properties for each type', () => {
    expect(TILE.properties[TILE.WALL].walkable).toBe(false);
    expect(TILE.properties[TILE.WALL].blocksLOS).toBe(true);
    expect(TILE.properties[TILE.FLOOR].walkable).toBe(true);
    expect(TILE.properties[TILE.FLOOR].blocksLOS).toBe(false);
    expect(TILE.properties[TILE.DOOR].walkable).toBe(true);
  });

  it('has a 16px tile size', () => {
    expect(TILE_SIZE).toBe(16);
  });

  it('defines energy threshold for turns', () => {
    expect(ENERGY_THRESHOLD).toBe(100);
  });

  it('defines all three player classes with base stats', () => {
    expect(PLAYER_CLASSES.fighter.baseStats.STR).toBe(8);
    expect(PLAYER_CLASSES.archer.baseStats.DEX).toBe(8);
    expect(PLAYER_CLASSES.mage.baseStats.INT).toBe(8);
    expect(PLAYER_CLASSES.fighter.baseHp).toBe(15);
    expect(PLAYER_CLASSES.archer.baseHp).toBe(10);
    expect(PLAYER_CLASSES.mage.baseHp).toBe(10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/constants.test.js`
Expected: FAIL — module not found.

**Step 3: Write implementation**

```js
// src/constants.js
export const TILE_SIZE = 16;
export const ENERGY_THRESHOLD = 100;
export const BASE_SPEED = 100;
export const FOV_RADIUS = 8;

export const TILE = {
  WALL: 0,
  FLOOR: 1,
  CORRIDOR: 2,
  DOOR: 3,
  STAIRS_DOWN: 4,
  WATER: 5,
  TRAP: 6,
  properties: {
    0: { name: 'Wall', walkable: false, blocksLOS: true },
    1: { name: 'Floor', walkable: true, blocksLOS: false },
    2: { name: 'Corridor', walkable: true, blocksLOS: false },
    3: { name: 'Door', walkable: true, blocksLOS: false },
    4: { name: 'Stairs Down', walkable: true, blocksLOS: false },
    5: { name: 'Water', walkable: false, blocksLOS: false },
    6: { name: 'Trap', walkable: true, blocksLOS: false },
  },
};

export const RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
};

export const EQUIPMENT_SLOTS = ['head', 'torso', 'legs', 'leftHand', 'rightHand', 'accessory1', 'accessory2'];

export const PLAYER_CLASSES = {
  fighter: {
    name: 'Fighter',
    baseStats: { STR: 8, DEX: 5, CON: 7, INT: 2, WIS: 3, LCK: 5 },
    baseHp: 15,
    affinityStats: ['STR', 'CON'],
  },
  archer: {
    name: 'Archer',
    baseStats: { STR: 4, DEX: 8, CON: 5, INT: 3, WIS: 4, LCK: 6 },
    baseHp: 10,
    affinityStats: ['DEX', 'LCK'],
  },
  mage: {
    name: 'Mage',
    baseStats: { STR: 3, DEX: 4, CON: 4, INT: 8, WIS: 7, LCK: 4 },
    baseHp: 10,
    affinityStats: ['INT', 'WIS'],
  },
};

export const STAT_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'LCK'];
export const SOFT_GATE_MULTIPLIER = 0.65;
```

**Step 4: Run tests**

Run: `npx vitest run tests/constants.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/constants.js tests/constants.test.js
git commit -m "feat: add game constants, tile types, and class definitions"
```

---

### Task 3: Map Data Structure

**Files:**
- Create: `src/game-map.js`
- Create: `tests/game-map.test.js`

**Step 1: Write failing tests**

```js
// tests/game-map.test.js
import { describe, it, expect } from 'vitest';
import { GameMap } from '../src/game-map.js';
import { TILE } from '../src/constants.js';

describe('GameMap', () => {
  it('creates a map filled with walls by default', () => {
    const map = new GameMap(10, 10);
    expect(map.width).toBe(10);
    expect(map.height).toBe(10);
    expect(map.getTile(0, 0)).toBe(TILE.WALL);
    expect(map.getTile(5, 5)).toBe(TILE.WALL);
  });

  it('sets and gets tile values', () => {
    const map = new GameMap(10, 10);
    map.setTile(3, 4, TILE.FLOOR);
    expect(map.getTile(3, 4)).toBe(TILE.FLOOR);
  });

  it('returns WALL for out-of-bounds coordinates', () => {
    const map = new GameMap(10, 10);
    expect(map.getTile(-1, 0)).toBe(TILE.WALL);
    expect(map.getTile(0, -1)).toBe(TILE.WALL);
    expect(map.getTile(10, 0)).toBe(TILE.WALL);
    expect(map.getTile(0, 10)).toBe(TILE.WALL);
  });

  it('checks if a coordinate is in bounds', () => {
    const map = new GameMap(10, 10);
    expect(map.inBounds(0, 0)).toBe(true);
    expect(map.inBounds(9, 9)).toBe(true);
    expect(map.inBounds(-1, 0)).toBe(false);
    expect(map.inBounds(10, 0)).toBe(false);
  });

  it('checks if a tile is walkable', () => {
    const map = new GameMap(10, 10);
    expect(map.isWalkable(5, 5)).toBe(false); // wall
    map.setTile(5, 5, TILE.FLOOR);
    expect(map.isWalkable(5, 5)).toBe(true);
  });

  it('checks if a tile blocks line of sight', () => {
    const map = new GameMap(10, 10);
    expect(map.blocksLOS(5, 5)).toBe(true); // wall
    map.setTile(5, 5, TILE.FLOOR);
    expect(map.blocksLOS(5, 5)).toBe(false);
  });

  it('tracks explored tiles (initially all unexplored)', () => {
    const map = new GameMap(10, 10);
    expect(map.isExplored(5, 5)).toBe(false);
    map.setExplored(5, 5, true);
    expect(map.isExplored(5, 5)).toBe(true);
  });

  it('tracks visible tiles (initially all not visible)', () => {
    const map = new GameMap(10, 10);
    expect(map.isVisible(5, 5)).toBe(false);
    map.setVisible(5, 5, true);
    expect(map.isVisible(5, 5)).toBe(true);
  });

  it('clears all visibility', () => {
    const map = new GameMap(10, 10);
    map.setVisible(3, 3, true);
    map.setVisible(5, 5, true);
    map.clearVisibility();
    expect(map.isVisible(3, 3)).toBe(false);
    expect(map.isVisible(5, 5)).toBe(false);
  });

  it('stores and retrieves rooms', () => {
    const map = new GameMap(10, 10);
    const room = { x: 1, y: 1, width: 4, height: 4, type: 'standard' };
    map.addRoom(room);
    expect(map.rooms).toHaveLength(1);
    expect(map.rooms[0]).toEqual(room);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game-map.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
// src/game-map.js
import { TILE } from './constants.js';

export class GameMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: height }, () => new Array(width).fill(TILE.WALL));
    this.explored = Array.from({ length: height }, () => new Array(width).fill(false));
    this.visible = Array.from({ length: height }, () => new Array(width).fill(false));
    this.rooms = [];
    this.entities = [];
    this.items = [];
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return TILE.WALL;
    return this.tiles[y][x];
  }

  setTile(x, y, type) {
    if (this.inBounds(x, y)) {
      this.tiles[y][x] = type;
    }
  }

  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    return TILE.properties[tile]?.walkable ?? false;
  }

  blocksLOS(x, y) {
    const tile = this.getTile(x, y);
    return TILE.properties[tile]?.blocksLOS ?? true;
  }

  isExplored(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.explored[y][x];
  }

  setExplored(x, y, value) {
    if (this.inBounds(x, y)) {
      this.explored[y][x] = value;
    }
  }

  isVisible(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.visible[y][x];
  }

  setVisible(x, y, value) {
    if (this.inBounds(x, y)) {
      this.visible[y][x] = value;
    }
  }

  clearVisibility() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.visible[y][x] = false;
      }
    }
  }

  addRoom(room) {
    this.rooms.push(room);
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/game-map.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game-map.js tests/game-map.test.js
git commit -m "feat: add GameMap class with tile grid, visibility, and exploration tracking"
```

---

### Task 4: Base Entity

**Files:**
- Create: `src/entity.js`
- Create: `tests/entity.test.js`

**Step 1: Write failing tests**

```js
// tests/entity.test.js
import { describe, it, expect } from 'vitest';
import { Entity } from '../src/entity.js';
import { ENERGY_THRESHOLD } from '../src/constants.js';

describe('Entity', () => {
  it('creates an entity with position and stats', () => {
    const e = new Entity({
      id: 'rat_1',
      type: 'enemy',
      x: 5, y: 3,
      stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 },
      maxHp: 5,
      speed: 100,
    });
    expect(e.id).toBe('rat_1');
    expect(e.position.x).toBe(5);
    expect(e.position.y).toBe(3);
    expect(e.hp).toBe(5);
    expect(e.maxHp).toBe(5);
    expect(e.speed).toBe(100);
    expect(e.energy).toBe(0);
  });

  it('accumulates energy based on speed', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    e.gainEnergy();
    expect(e.energy).toBe(100);
  });

  it('reports ready when energy >= threshold', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    expect(e.isReady()).toBe(false);
    e.gainEnergy();
    expect(e.isReady()).toBe(true);
  });

  it('spends energy on taking a turn', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 150 });
    e.gainEnergy(); // 150
    expect(e.isReady()).toBe(true);
    e.spendTurn();
    expect(e.energy).toBe(50); // 150 - 100
  });

  it('can take damage and die', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    e.takeDamage(3);
    expect(e.hp).toBe(2);
    expect(e.isAlive()).toBe(true);
    e.takeDamage(5);
    expect(e.hp).toBe(0);
    expect(e.isAlive()).toBe(false);
  });

  it('hp does not go below 0', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed: 100 });
    e.takeDamage(999);
    expect(e.hp).toBe(0);
  });

  it('can heal up to maxHp', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 10, speed: 100 });
    e.takeDamage(5);
    e.heal(3);
    expect(e.hp).toBe(8);
    e.heal(999);
    expect(e.hp).toBe(10);
  });

  it('moves to a new position', () => {
    const e = new Entity({ id: 'e1', type: 'enemy', x: 3, y: 4, stats: {}, maxHp: 5, speed: 100 });
    e.moveTo(5, 6);
    expect(e.position.x).toBe(5);
    expect(e.position.y).toBe(6);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entity.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
// src/entity.js
import { ENERGY_THRESHOLD } from './constants.js';

export class Entity {
  constructor({ id, type, x, y, stats, maxHp, speed, behavior = null, name = '' }) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.position = { x, y };
    this.stats = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, LCK: 0, ...stats };
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.speed = speed;
    this.energy = 0;
    this.behavior = behavior;
    this.equipment = { head: null, torso: null, legs: null, leftHand: null, rightHand: null, accessory1: null, accessory2: null };
    this.inventory = [];
    this.belt = [null, null, null];
    this.activeSkills = [];
    this.activeBlessings = [];
    this.statusEffects = [];
  }

  gainEnergy() {
    this.energy += this.speed;
  }

  isReady() {
    return this.energy >= ENERGY_THRESHOLD;
  }

  spendTurn() {
    this.energy -= ENERGY_THRESHOLD;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isAlive() {
    return this.hp > 0;
  }

  moveTo(x, y) {
    this.position.x = x;
    this.position.y = y;
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/entity.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/entity.js tests/entity.test.js
git commit -m "feat: add Entity class with energy system, HP, and movement"
```

---

### Task 5: Player Entity

**Files:**
- Create: `src/player.js`
- Create: `tests/player.test.js`

**Step 1: Write failing tests**

```js
// tests/player.test.js
import { describe, it, expect } from 'vitest';
import { createPlayer } from '../src/player.js';
import { PLAYER_CLASSES, BASE_SPEED } from '../src/constants.js';

describe('createPlayer', () => {
  it('creates a fighter with correct base stats', () => {
    const p = createPlayer('fighter', 5, 5);
    expect(p.type).toBe('player');
    expect(p.stats.STR).toBe(8);
    expect(p.stats.CON).toBe(7);
    expect(p.maxHp).toBe(15);
    expect(p.hp).toBe(15);
    expect(p.speed).toBe(BASE_SPEED);
    expect(p.position.x).toBe(5);
    expect(p.position.y).toBe(5);
  });

  it('creates an archer with correct base stats', () => {
    const p = createPlayer('archer', 0, 0);
    expect(p.stats.DEX).toBe(8);
    expect(p.stats.LCK).toBe(6);
    expect(p.maxHp).toBe(10);
  });

  it('creates a mage with correct base stats', () => {
    const p = createPlayer('mage', 0, 0);
    expect(p.stats.INT).toBe(8);
    expect(p.stats.WIS).toBe(7);
    expect(p.maxHp).toBe(10);
  });

  it('stores the class key on the player', () => {
    const p = createPlayer('fighter', 0, 0);
    expect(p.playerClass).toBe('fighter');
  });

  it('initializes with empty inventory and belt', () => {
    const p = createPlayer('fighter', 0, 0);
    expect(p.inventory).toEqual([]);
    expect(p.belt).toEqual([null, null, null]);
  });

  it('applies permanent stat bonuses if provided', () => {
    const p = createPlayer('fighter', 0, 0, { STR: 2, CON: 1 });
    expect(p.stats.STR).toBe(10); // 8 + 2
    expect(p.stats.CON).toBe(8);  // 7 + 1
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/player.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
// src/player.js
import { Entity } from './entity.js';
import { PLAYER_CLASSES, BASE_SPEED, STAT_NAMES } from './constants.js';

export function createPlayer(classKey, x, y, permanentBonuses = {}) {
  const classDef = PLAYER_CLASSES[classKey];
  const stats = { ...classDef.baseStats };
  for (const stat of STAT_NAMES) {
    stats[stat] += (permanentBonuses[stat] || 0);
  }
  const player = new Entity({
    id: 'player',
    type: 'player',
    x,
    y,
    stats,
    maxHp: classDef.baseHp,
    speed: BASE_SPEED,
    name: classDef.name,
  });
  player.playerClass = classKey;
  player.affinityStats = classDef.affinityStats;
  player.gold = 0;
  player.floorNumber = 1;
  return player;
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/player.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/player.js tests/player.test.js
git commit -m "feat: add player factory with class-based stats and permanent bonuses"
```

---

### Task 6: Turn System

**Files:**
- Create: `src/turn-system.js`
- Create: `tests/turn-system.test.js`

**Step 1: Write failing tests**

```js
// tests/turn-system.test.js
import { describe, it, expect } from 'vitest';
import { TurnSystem } from '../src/turn-system.js';
import { Entity } from '../src/entity.js';

function makeEntity(id, speed) {
  return new Entity({ id, type: 'enemy', x: 0, y: 0, stats: {}, maxHp: 5, speed });
}

describe('TurnSystem', () => {
  it('registers entities', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);
    expect(ts.entities).toHaveLength(1);
  });

  it('removes entities', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);
    ts.removeEntity('e1');
    expect(ts.entities).toHaveLength(0);
  });

  it('ticks all entities and returns those ready to act (sorted by excess energy desc)', () => {
    const ts = new TurnSystem();
    const slow = makeEntity('slow', 50);
    const normal = makeEntity('normal', 100);
    const fast = makeEntity('fast', 150);
    ts.addEntity(slow);
    ts.addEntity(normal);
    ts.addEntity(fast);

    const ready = ts.tick();
    // After 1 tick: slow=50, normal=100, fast=150
    // Ready: normal (excess 0), fast (excess 50)
    // Sorted by excess desc: fast, normal
    expect(ready.map(e => e.id)).toEqual(['fast', 'normal']);
    expect(slow.isReady()).toBe(false);
  });

  it('handles multiple ticks correctly', () => {
    const ts = new TurnSystem();
    const slow = makeEntity('slow', 50);
    ts.addEntity(slow);

    let ready = ts.tick();
    expect(ready).toHaveLength(0); // energy = 50

    ready = ts.tick();
    expect(ready).toHaveLength(1); // energy = 100
    expect(ready[0].id).toBe('slow');
  });

  it('does not double-count: entities spend energy after acting', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);

    let ready = ts.tick(); // energy = 100
    expect(ready).toHaveLength(1);
    ready[0].spendTurn(); // energy = 0

    ready = ts.tick(); // energy = 100 again
    expect(ready).toHaveLength(1);
  });

  it('skips dead entities', () => {
    const ts = new TurnSystem();
    const e = makeEntity('e1', 100);
    ts.addEntity(e);
    e.takeDamage(999); // kill it

    const ready = ts.tick();
    expect(ready).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/turn-system.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
// src/turn-system.js
export class TurnSystem {
  constructor() {
    this.entities = [];
  }

  addEntity(entity) {
    this.entities.push(entity);
  }

  removeEntity(id) {
    this.entities = this.entities.filter(e => e.id !== id);
  }

  tick() {
    const ready = [];
    for (const entity of this.entities) {
      if (!entity.isAlive()) continue;
      entity.gainEnergy();
      if (entity.isReady()) {
        ready.push(entity);
      }
    }
    // Sort by excess energy descending (ties broken by array order, effectively random enough)
    ready.sort((a, b) => b.energy - a.energy);
    return ready;
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/turn-system.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/turn-system.js tests/turn-system.test.js
git commit -m "feat: add energy-based TurnSystem with tick scheduling"
```

---

### Task 7: Camera & Viewport

**Files:**
- Create: `src/camera.js`
- Create: `tests/camera.test.js`

**Step 1: Write failing tests**

```js
// tests/camera.test.js
import { describe, it, expect } from 'vitest';
import { Camera } from '../src/camera.js';
import { TILE_SIZE } from '../src/constants.js';

describe('Camera', () => {
  it('creates a camera with viewport dimensions', () => {
    const cam = new Camera(800, 600); // canvas dimensions in pixels
    expect(cam.viewportWidth).toBe(Math.floor(800 / TILE_SIZE));
    expect(cam.viewportHeight).toBe(Math.floor(600 / TILE_SIZE));
  });

  it('centers on a target position', () => {
    const cam = new Camera(320, 320); // 20x20 tile viewport
    cam.centerOn(25, 25, 50, 50); // target x,y, map w,h
    expect(cam.x).toBe(15); // 25 - 10
    expect(cam.y).toBe(15); // 25 - 10
  });

  it('clamps to top-left map edge', () => {
    const cam = new Camera(320, 320); // 20x20 tile viewport
    cam.centerOn(5, 5, 50, 50);
    expect(cam.x).toBe(0); // would be -5, clamped to 0
    expect(cam.y).toBe(0);
  });

  it('clamps to bottom-right map edge', () => {
    const cam = new Camera(320, 320); // 20x20 tile viewport
    cam.centerOn(45, 45, 50, 50);
    expect(cam.x).toBe(30); // 50 - 20
    expect(cam.y).toBe(30);
  });

  it('converts tile coords to screen pixel coords', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(25, 25, 50, 50); // cam at 15,15
    const { sx, sy } = cam.tileToScreen(17, 17);
    expect(sx).toBe((17 - 15) * TILE_SIZE);
    expect(sy).toBe((17 - 15) * TILE_SIZE);
  });

  it('determines if a tile is within the viewport', () => {
    const cam = new Camera(320, 320); // 20x20
    cam.centerOn(25, 25, 50, 50); // cam at 15,15 -> shows 15..34
    expect(cam.isInView(15, 15)).toBe(true);
    expect(cam.isInView(34, 34)).toBe(true);
    expect(cam.isInView(14, 15)).toBe(false);
    expect(cam.isInView(35, 15)).toBe(false);
  });

  it('resizes viewport when canvas dimensions change', () => {
    const cam = new Camera(320, 320);
    expect(cam.viewportWidth).toBe(20);
    cam.resize(480, 320);
    expect(cam.viewportWidth).toBe(30);
    expect(cam.viewportHeight).toBe(20);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/camera.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
// src/camera.js
import { TILE_SIZE } from './constants.js';

export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = Math.floor(canvasWidth / TILE_SIZE);
    this.viewportHeight = Math.floor(canvasHeight / TILE_SIZE);
  }

  resize(canvasWidth, canvasHeight) {
    this.viewportWidth = Math.floor(canvasWidth / TILE_SIZE);
    this.viewportHeight = Math.floor(canvasHeight / TILE_SIZE);
  }

  centerOn(targetX, targetY, mapWidth, mapHeight) {
    const halfW = Math.floor(this.viewportWidth / 2);
    const halfH = Math.floor(this.viewportHeight / 2);
    this.x = Math.max(0, Math.min(targetX - halfW, mapWidth - this.viewportWidth));
    this.y = Math.max(0, Math.min(targetY - halfH, mapHeight - this.viewportHeight));
  }

  tileToScreen(tileX, tileY) {
    return {
      sx: (tileX - this.x) * TILE_SIZE,
      sy: (tileY - this.y) * TILE_SIZE,
    };
  }

  isInView(tileX, tileY) {
    return tileX >= this.x && tileX < this.x + this.viewportWidth &&
           tileY >= this.y && tileY < this.y + this.viewportHeight;
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/camera.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/camera.js tests/camera.test.js
git commit -m "feat: add Camera with viewport centering, clamping, and coordinate mapping"
```

---

### Task 8: Message Log

**Files:**
- Create: `src/message-log.js`
- Create: `tests/message-log.test.js`

**Step 1: Write failing tests**

```js
// tests/message-log.test.js
import { describe, it, expect } from 'vitest';
import { MessageLog } from '../src/message-log.js';

describe('MessageLog', () => {
  it('starts with no messages', () => {
    const log = new MessageLog();
    expect(log.messages).toHaveLength(0);
  });

  it('adds messages with timestamps', () => {
    const log = new MessageLog();
    log.add('You move north.');
    expect(log.messages).toHaveLength(1);
    expect(log.messages[0].text).toBe('You move north.');
    expect(log.messages[0].turn).toBe(0);
  });

  it('tracks the turn number for each message', () => {
    const log = new MessageLog();
    log.add('First', 1);
    log.add('Second', 3);
    expect(log.messages[0].turn).toBe(1);
    expect(log.messages[1].turn).toBe(3);
  });

  it('returns recent messages up to a limit', () => {
    const log = new MessageLog();
    for (let i = 0; i < 10; i++) log.add(`Msg ${i}`);
    const recent = log.getRecent(4);
    expect(recent).toHaveLength(4);
    expect(recent[0].text).toBe('Msg 6');
    expect(recent[3].text).toBe('Msg 9');
  });

  it('caps total messages to prevent unbounded growth', () => {
    const log = new MessageLog(50);
    for (let i = 0; i < 60; i++) log.add(`Msg ${i}`);
    expect(log.messages).toHaveLength(50);
    expect(log.messages[0].text).toBe('Msg 10');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/message-log.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
// src/message-log.js
export class MessageLog {
  constructor(maxMessages = 200) {
    this.messages = [];
    this.maxMessages = maxMessages;
  }

  add(text, turn = 0) {
    this.messages.push({ text, turn });
    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }
  }

  getRecent(count = 4) {
    return this.messages.slice(-count);
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/message-log.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/message-log.js tests/message-log.test.js
git commit -m "feat: add MessageLog with turn tracking and capped history"
```

---

### Task 9: Input Handler

**Files:**
- Create: `src/input.js`
- Create: `tests/input.test.js`

**Step 1: Write failing tests**

```js
// tests/input.test.js
import { describe, it, expect } from 'vitest';
import { mapKeyToAction } from '../src/input.js';

describe('mapKeyToAction', () => {
  it('maps arrow keys to movement', () => {
    expect(mapKeyToAction('ArrowUp')).toEqual({ type: 'move', dx: 0, dy: -1 });
    expect(mapKeyToAction('ArrowDown')).toEqual({ type: 'move', dx: 0, dy: 1 });
    expect(mapKeyToAction('ArrowLeft')).toEqual({ type: 'move', dx: -1, dy: 0 });
    expect(mapKeyToAction('ArrowRight')).toEqual({ type: 'move', dx: 1, dy: 0 });
  });

  it('maps WASD to movement', () => {
    expect(mapKeyToAction('w')).toEqual({ type: 'move', dx: 0, dy: -1 });
    expect(mapKeyToAction('s')).toEqual({ type: 'move', dx: 0, dy: 1 });
    expect(mapKeyToAction('a')).toEqual({ type: 'move', dx: -1, dy: 0 });
    expect(mapKeyToAction('d')).toEqual({ type: 'move', dx: 1, dy: 0 });
  });

  it('maps wait keys', () => {
    expect(mapKeyToAction(' ')).toEqual({ type: 'wait' });
    expect(mapKeyToAction('.')).toEqual({ type: 'wait' });
  });

  it('maps inventory key', () => {
    expect(mapKeyToAction('i')).toEqual({ type: 'inventory' });
    expect(mapKeyToAction('Tab')).toEqual({ type: 'inventory' });
  });

  it('maps belt keys', () => {
    expect(mapKeyToAction('1')).toEqual({ type: 'belt', slot: 0 });
    expect(mapKeyToAction('2')).toEqual({ type: 'belt', slot: 1 });
    expect(mapKeyToAction('3')).toEqual({ type: 'belt', slot: 2 });
  });

  it('maps pickup key', () => {
    expect(mapKeyToAction('g')).toEqual({ type: 'pickup' });
  });

  it('maps descend key', () => {
    expect(mapKeyToAction('>')).toEqual({ type: 'descend' });
  });

  it('maps escape', () => {
    expect(mapKeyToAction('Escape')).toEqual({ type: 'close' });
  });

  it('returns null for unmapped keys', () => {
    expect(mapKeyToAction('z')).toBeNull();
    expect(mapKeyToAction('F1')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/input.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
// src/input.js
const KEY_MAP = {
  ArrowUp:    { type: 'move', dx: 0, dy: -1 },
  ArrowDown:  { type: 'move', dx: 0, dy: 1 },
  ArrowLeft:  { type: 'move', dx: -1, dy: 0 },
  ArrowRight: { type: 'move', dx: 1, dy: 0 },
  w:          { type: 'move', dx: 0, dy: -1 },
  s:          { type: 'move', dx: 0, dy: 1 },
  a:          { type: 'move', dx: -1, dy: 0 },
  d:          { type: 'move', dx: 1, dy: 0 },
  ' ':        { type: 'wait' },
  '.':        { type: 'wait' },
  i:          { type: 'inventory' },
  Tab:        { type: 'inventory' },
  g:          { type: 'pickup' },
  '>':        { type: 'descend' },
  Escape:     { type: 'close' },
  q:          { type: 'skill', slot: 0 },
  e:          { type: 'skill', slot: 1 },
  r:          { type: 'skill', slot: 2 },
  '1':        { type: 'belt', slot: 0 },
  '2':        { type: 'belt', slot: 1 },
  '3':        { type: 'belt', slot: 2 },
};

export function mapKeyToAction(key) {
  return KEY_MAP[key] || null;
}

export class InputHandler {
  constructor() {
    this.pendingAction = null;
    this.listening = false;
  }

  start() {
    this.listening = true;
    this._handler = (e) => {
      if (!this.listening) return;
      const action = mapKeyToAction(e.key);
      if (action) {
        e.preventDefault();
        this.pendingAction = action;
      }
    };
    document.addEventListener('keydown', this._handler);
  }

  stop() {
    this.listening = false;
    if (this._handler) {
      document.removeEventListener('keydown', this._handler);
    }
  }

  consume() {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/input.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/input.js tests/input.test.js
git commit -m "feat: add input handler with key-to-action mapping"
```

---

### Task 10: FOV (Recursive Shadowcasting)

**Files:**
- Create: `src/fov.js`
- Create: `tests/fov.test.js`

**Step 1: Write failing tests**

```js
// tests/fov.test.js
import { describe, it, expect } from 'vitest';
import { computeFOV } from '../src/fov.js';
import { GameMap } from '../src/game-map.js';
import { TILE } from '../src/constants.js';

describe('computeFOV', () => {
  function makeOpenMap(size) {
    const map = new GameMap(size, size);
    for (let y = 1; y < size - 1; y++)
      for (let x = 1; x < size - 1; x++)
        map.setTile(x, y, TILE.FLOOR);
    return map;
  }

  it('marks the origin tile as visible', () => {
    const map = makeOpenMap(20);
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(10, 10)).toBe(true);
  });

  it('marks nearby open tiles as visible', () => {
    const map = makeOpenMap(20);
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(11, 10)).toBe(true);
    expect(map.isVisible(10, 11)).toBe(true);
    expect(map.isVisible(12, 12)).toBe(true);
  });

  it('does not mark tiles beyond radius as visible', () => {
    const map = makeOpenMap(30);
    computeFOV(map, 15, 15, 3);
    expect(map.isVisible(15, 15)).toBe(true);
    expect(map.isVisible(19, 15)).toBe(false); // 4 tiles away
  });

  it('walls block visibility behind them', () => {
    const map = makeOpenMap(20);
    // Put a wall between origin and a floor tile
    map.setTile(10, 8, TILE.WALL);
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(10, 8)).toBe(true);  // wall itself is visible
    expect(map.isVisible(10, 7)).toBe(false); // behind wall
  });

  it('marks visible tiles as explored', () => {
    const map = makeOpenMap(20);
    expect(map.isExplored(11, 10)).toBe(false);
    computeFOV(map, 10, 10, 8);
    expect(map.isExplored(11, 10)).toBe(true);
  });

  it('clears previous visibility before computing', () => {
    const map = makeOpenMap(20);
    map.setVisible(1, 1, true); // set some random tile visible
    computeFOV(map, 10, 10, 8);
    expect(map.isVisible(1, 1)).toBe(false); // should be cleared
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fov.test.js`
Expected: FAIL

**Step 3: Write implementation (recursive shadowcasting)**

```js
// src/fov.js

// Recursive shadowcasting FOV
// Based on the algorithm by Bjorn Bergstrom
// 8 octants, each handled symmetrically

const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

export function computeFOV(map, originX, originY, radius) {
  map.clearVisibility();
  map.setVisible(originX, originY, true);
  map.setExplored(originX, originY, true);

  for (let octant = 0; octant < 8; octant++) {
    castLight(map, originX, originY, radius, 1, 1.0, 0.0, octant);
  }
}

function castLight(map, cx, cy, radius, row, startSlope, endSlope, octant) {
  if (startSlope < endSlope) return;

  const xx = MULT[0][octant];
  const xy = MULT[1][octant];
  const yx = MULT[2][octant];
  const yy = MULT[3][octant];

  let nextStartSlope = startSlope;

  for (let i = row; i <= radius; i++) {
    let blocked = false;
    for (let dx = -i, dy = -i; dx <= 0; dx++) {
      const mapX = cx + dx * xx + dy * xy;
      const mapY = cy + dx * yx + dy * yy;

      const leftSlope = (dx - 0.5) / (dy + 0.5);
      const rightSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rightSlope) continue;
      if (endSlope > leftSlope) break;

      // Check if tile is within radius (circular FOV)
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        map.setVisible(mapX, mapY, true);
        map.setExplored(mapX, mapY, true);
      }

      if (blocked) {
        if (map.blocksLOS(mapX, mapY)) {
          nextStartSlope = rightSlope;
        } else {
          blocked = false;
          startSlope = nextStartSlope;
        }
      } else if (map.blocksLOS(mapX, mapY) && i < radius) {
        blocked = true;
        castLight(map, cx, cy, radius, i + 1, startSlope, rightSlope, octant);
        nextStartSlope = rightSlope;
      }
    }
    if (blocked) break;
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/fov.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/fov.js tests/fov.test.js
git commit -m "feat: add recursive shadowcasting FOV"
```

---

### Task 11: Sprite System (Programmatic)

**Files:**
- Create: `src/sprites.js`
- Create: `tests/sprites.test.js`

**Step 1: Write failing tests**

```js
// tests/sprites.test.js
import { describe, it, expect } from 'vitest';
import { SpriteRegistry, SPRITE_DEFINITIONS } from '../src/sprites.js';

describe('SpriteRegistry', () => {
  it('has definitions for core sprites', () => {
    expect(SPRITE_DEFINITIONS.wall).toBeDefined();
    expect(SPRITE_DEFINITIONS.floor).toBeDefined();
    expect(SPRITE_DEFINITIONS.corridor).toBeDefined();
    expect(SPRITE_DEFINITIONS.player_fighter).toBeDefined();
    expect(SPRITE_DEFINITIONS.player_archer).toBeDefined();
    expect(SPRITE_DEFINITIONS.player_mage).toBeDefined();
    expect(SPRITE_DEFINITIONS.door).toBeDefined();
    expect(SPRITE_DEFINITIONS.stairs_down).toBeDefined();
  });

  it('each sprite definition has a draw function', () => {
    for (const [key, def] of Object.entries(SPRITE_DEFINITIONS)) {
      expect(typeof def.draw).toBe('function');
    }
  });

  it('each sprite definition has a size', () => {
    expect(SPRITE_DEFINITIONS.wall.size).toBe(16);
    expect(SPRITE_DEFINITIONS.floor.size).toBe(16);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sprites.test.js`
Expected: FAIL

**Step 3: Write implementation**

The `draw` functions accept a `ctx` (CanvasRenderingContext2D) and draw a sprite at (0,0). The renderer will position them via translate. During testing we only verify structure — actual pixel output is verified visually.

```js
// src/sprites.js
import { TILE_SIZE } from './constants.js';

// Each definition: { size, draw(ctx) }
// draw() renders the sprite at (0,0) on the given context at the given size
export const SPRITE_DEFINITIONS = {
  wall: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(1, 1, 14, 6);
      ctx.fillRect(0, 8, 7, 6);
      ctx.fillRect(8, 8, 8, 6);
      ctx.strokeStyle = '#151525';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
    },
  },
  floor: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#353545';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(10, 6, 2, 2);
      ctx.fillRect(5, 12, 2, 2);
    },
  },
  corridor: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#33333f';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#2e2e3a';
      ctx.fillRect(4, 4, 1, 1);
      ctx.fillRect(11, 9, 1, 1);
    },
  },
  door: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(3, 2, 10, 12);
      ctx.fillStyle = '#a07818';
      ctx.fillRect(4, 3, 8, 10);
      ctx.fillStyle = '#c8a000';
      ctx.fillRect(10, 7, 2, 2);
    },
  },
  stairs_down: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#666';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(2 + i * 2, 4 + i * 3, 12 - i * 4, 2);
      }
    },
  },
  player_fighter: {
    size: TILE_SIZE,
    draw(ctx) {
      // Body
      ctx.fillStyle = '#b03030';
      ctx.fillRect(5, 4, 6, 8);
      // Head
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      // Legs
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      // Sword
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(12, 3, 2, 8);
      ctx.fillStyle = '#a08030';
      ctx.fillRect(11, 8, 4, 2);
    },
  },
  player_archer: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#2a7030';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      // Bow
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(13, 8, 5, -1.2, 1.2);
      ctx.stroke();
    },
  },
  player_mage: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3030a0';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      // Hat
      ctx.fillStyle = '#3030a0';
      ctx.fillRect(5, 0, 6, 2);
      ctx.fillRect(7, -1, 2, 1);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      // Staff
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(13, 1, 1, 14);
      ctx.fillStyle = '#40d0ff';
      ctx.fillRect(12, 0, 3, 2);
    },
  },
  water: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#1a2a5a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#2a3a6a';
      ctx.fillRect(2, 4, 5, 1);
      ctx.fillRect(9, 8, 5, 1);
      ctx.fillRect(3, 12, 4, 1);
    },
  },
  trap: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#804040';
      ctx.fillRect(4, 4, 8, 1);
      ctx.fillRect(4, 11, 8, 1);
      ctx.fillRect(4, 4, 1, 8);
      ctx.fillRect(11, 4, 1, 8);
      ctx.fillRect(7, 6, 2, 4);
    },
  },
};

// Maps tile type IDs to sprite keys
export const TILE_SPRITE_MAP = {
  0: 'wall',
  1: 'floor',
  2: 'corridor',
  3: 'door',
  4: 'stairs_down',
  5: 'water',
  6: 'trap',
};

export class SpriteRegistry {
  constructor() {
    this.cache = {};
  }

  init() {
    for (const [key, def] of Object.entries(SPRITE_DEFINITIONS)) {
      const canvas = document.createElement('canvas');
      canvas.width = def.size;
      canvas.height = def.size;
      const ctx = canvas.getContext('2d');
      def.draw(ctx);
      this.cache[key] = canvas;
    }
  }

  get(key) {
    return this.cache[key] || null;
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/sprites.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/sprites.js tests/sprites.test.js
git commit -m "feat: add programmatic sprite system with dark/grim tile and player sprites"
```

---

### Task 12: Renderer

**Files:**
- Create: `src/renderer.js`

This module uses Canvas API directly. It's tested visually (no unit tests — it's a thin rendering adapter).

**Step 1: Write implementation**

```js
// src/renderer.js
import { TILE_SIZE, TILE } from './constants.js';
import { TILE_SPRITE_MAP } from './sprites.js';

export class Renderer {
  constructor(canvas, spriteRegistry, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = spriteRegistry;
    this.camera = camera;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMap(map) {
    const cam = this.camera;
    for (let ty = cam.y; ty < cam.y + cam.viewportHeight && ty < map.height; ty++) {
      for (let tx = cam.x; tx < cam.x + cam.viewportWidth && tx < map.width; tx++) {
        if (!map.isExplored(tx, ty)) continue;

        const tileId = map.getTile(tx, ty);
        const spriteKey = TILE_SPRITE_MAP[tileId];
        const sprite = this.sprites.get(spriteKey);
        const { sx, sy } = cam.tileToScreen(tx, ty);

        if (sprite) {
          this.ctx.drawImage(sprite, sx, sy);
        }

        // Dim explored but not visible tiles
        if (!map.isVisible(tx, ty)) {
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          this.ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  drawEntity(entity, map, spriteKey) {
    if (!map.isVisible(entity.position.x, entity.position.y)) return;
    if (!this.camera.isInView(entity.position.x, entity.position.y)) return;

    const sprite = this.sprites.get(spriteKey);
    const { sx, sy } = this.camera.tileToScreen(entity.position.x, entity.position.y);
    if (sprite) {
      this.ctx.drawImage(sprite, sx, sy);
    }
  }

  drawPlayer(player) {
    const spriteKey = `player_${player.playerClass}`;
    const sprite = this.sprites.get(spriteKey);
    const { sx, sy } = this.camera.tileToScreen(player.position.x, player.position.y);
    if (sprite) {
      this.ctx.drawImage(sprite, sx, sy);
    }
  }

  render(gameState) {
    this.clear();
    this.drawMap(gameState.map);
    // Draw items on ground (within LOS)
    for (const groundItem of gameState.map.items) {
      if (gameState.map.isVisible(groundItem.position.x, groundItem.position.y)) {
        const { sx, sy } = this.camera.tileToScreen(groundItem.position.x, groundItem.position.y);
        // Simple item indicator for now
        this.ctx.fillStyle = '#ff0';
        this.ctx.fillRect(sx + 5, sy + 5, 6, 6);
      }
    }
    // Draw enemies
    for (const entity of gameState.map.entities) {
      if (entity.type === 'enemy' && entity.isAlive()) {
        this.drawEntity(entity, gameState.map, entity.spriteKey || 'rat');
      }
    }
    // Draw player on top
    this.drawPlayer(gameState.player);
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer.js
git commit -m "feat: add canvas Renderer with map, entity, and player drawing"
```

---

### Task 13: HUD Renderer

**Files:**
- Create: `src/hud.js`

Also a thin rendering layer — no unit tests.

**Step 1: Write implementation**

```js
// src/hud.js
export class HUD {
  constructor(ctx, canvasWidth, canvasHeight) {
    this.ctx = ctx;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.hudHeight = 80;
  }

  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  draw(player, messageLog) {
    const ctx = this.ctx;
    const y = this.canvasHeight - this.hudHeight;

    // HUD background
    ctx.fillStyle = '#111118';
    ctx.fillRect(0, y, this.canvasWidth, this.hudHeight);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, y, this.canvasWidth, 1);

    // HP bar
    const hpBarX = 10;
    const hpBarY = y + 8;
    const hpBarW = 150;
    const hpBarH = 14;
    const hpRatio = player.hp / player.maxHp;

    ctx.fillStyle = '#400';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    const hpColor = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, hpBarX + 4, hpBarY + 11);

    // Floor number
    ctx.fillText(`Floor ${player.floorNumber}`, hpBarX + hpBarW + 20, hpBarY + 11);

    // Belt slots
    const beltX = this.canvasWidth - 120;
    for (let i = 0; i < 3; i++) {
      const slotX = beltX + i * 36;
      ctx.strokeStyle = '#555';
      ctx.strokeRect(slotX, hpBarY, 30, 14);
      ctx.fillStyle = '#888';
      ctx.fillText(`${i + 1}`, slotX + 2, hpBarY + 11);
      if (player.belt[i]) {
        ctx.fillStyle = '#0ff';
        ctx.fillRect(slotX + 12, hpBarY + 3, 14, 8);
      }
    }

    // Message log
    const messages = messageLog.getRecent(3);
    ctx.font = '10px monospace';
    for (let i = 0; i < messages.length; i++) {
      const alpha = i === messages.length - 1 ? 1.0 : 0.5 + (i / messages.length) * 0.3;
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      ctx.fillText(messages[i].text, 10, y + 32 + i * 14);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/hud.js
git commit -m "feat: add HUD renderer with HP bar, floor number, belt slots, and message log"
```

---

### Task 14: Game Loop & State Machine

**Files:**
- Create: `src/game.js`

The game loop ties everything together. It manages state transitions and the core gameplay loop.

**Step 1: Write implementation**

```js
// src/game.js
import { GameMap } from './game-map.js';
import { createPlayer } from './player.js';
import { TurnSystem } from './turn-system.js';
import { Camera } from './camera.js';
import { computeFOV } from './fov.js';
import { MessageLog } from './message-log.js';
import { InputHandler, mapKeyToAction } from './input.js';
import { SpriteRegistry } from './sprites.js';
import { Renderer } from './renderer.js';
import { HUD } from './hud.js';
import { TILE, FOV_RADIUS } from './constants.js';
import { Entity } from './entity.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'init'; // init, playing, inventory, gameover, hub
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

    window.addEventListener('resize', () => this.resizeCanvas());

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
    // Create a simple test map for Phase 1
    const w = 40, h = 30;
    this.map = new GameMap(w, h);

    // Carve out some rooms
    for (let y = 2; y < 10; y++)
      for (let x = 2; x < 12; x++)
        this.map.setTile(x, y, TILE.FLOOR);

    // Corridor
    for (let x = 12; x < 20; x++)
      this.map.setTile(x, 5, TILE.CORRIDOR);

    // Second room
    for (let y = 2; y < 10; y++)
      for (let x = 20; x < 30; x++)
        this.map.setTile(x, y, TILE.FLOOR);

    // Door
    this.map.setTile(12, 5, TILE.DOOR);
    this.map.setTile(19, 5, TILE.DOOR);

    // Stairs
    this.map.setTile(25, 5, TILE.STAIRS_DOWN);

    // Player
    this.player = createPlayer('fighter', 5, 5);
    this.turnSystem.addEntity(this.player);

    // Test NPC (random walk enemy)
    const npc = new Entity({
      id: 'test_npc',
      type: 'enemy',
      x: 24,
      y: 4,
      stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 },
      maxHp: 5,
      speed: 100,
      behavior: 'wander',
      name: 'Rat',
    });
    npc.spriteKey = 'trap'; // placeholder sprite
    this.map.entities.push(npc);
    this.turnSystem.addEntity(npc);

    this.messageLog.add('Welcome to Diegeist. Move with arrow keys/WASD.', this.turnCount);

    computeFOV(this.map, this.player.position.x, this.player.position.y, FOV_RADIUS);
    this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
  }

  processPlayerAction(action) {
    if (action.type === 'move') {
      const nx = this.player.position.x + action.dx;
      const ny = this.player.position.y + action.dy;
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
          entity.moveTo(nx, ny);
          break;
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

    // Process enemy turns
    let safety = 0;
    while (safety++ < 100) {
      const ready = this.turnSystem.tick();
      if (ready.length === 0) break;

      for (const entity of ready) {
        if (entity.type === 'player') {
          // Player's next turn — wait for input
          return;
        }
        this.processEnemyTurn(entity);
      }
    }

    // Update FOV
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
```

**Step 2: Commit**

```bash
git add src/game.js
git commit -m "feat: add Game class with main loop, turn processing, and test map"
```

---

### Task 15: Build Script & HTML Template

**Files:**
- Create: `build.js`
- Create: `template.html`

**Step 1: Create HTML template**

```html
<!-- template.html -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Diegeist</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<script>
// === DIEGEIST ===
// {{GAME_CODE}}

(function() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  game.init();
})();
</script>
</body>
</html>
```

**Step 2: Create build script**

```js
// build.js
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Source files in dependency order
const SOURCE_ORDER = [
  'constants.js',
  'game-map.js',
  'entity.js',
  'player.js',
  'turn-system.js',
  'camera.js',
  'fov.js',
  'message-log.js',
  'input.js',
  'sprites.js',
  'renderer.js',
  'hud.js',
  'game.js',
];

function stripImportsExports(code) {
  return code
    .replace(/^import\s+.*?;\s*$/gm, '')
    .replace(/^export\s+(default\s+)?/gm, '')
    .trim();
}

function build() {
  const template = readFileSync(join(__dirname, 'template.html'), 'utf-8');

  let combinedCode = '';
  for (const file of SOURCE_ORDER) {
    const code = readFileSync(join(__dirname, 'src', file), 'utf-8');
    combinedCode += `// --- ${file} ---\n` + stripImportsExports(code) + '\n\n';
  }

  const output = template.replace('// {{GAME_CODE}}', combinedCode);

  mkdirSync(join(__dirname, 'dist'), { recursive: true });
  writeFileSync(join(__dirname, 'dist', 'diegeist.html'), output);
  console.log('Built dist/diegeist.html');
}

build();
```

**Step 3: Verify build**

Run: `node build.js`
Expected: `dist/diegeist.html` created. Opening in browser shows the test map with a movable player character.

**Step 4: Commit**

```bash
git add build.js template.html
git commit -m "feat: add build script and HTML template for single-file assembly"
```

---

### Task 16: Integration Test — Full Phase 1 Acceptance

Run all tests and build. Manually verify in browser:

- [ ] Canvas renders tile map with wall and floor sprites
- [ ] Camera scrolls centered on player, clamped to edges
- [ ] Player moves via arrow keys/WASD
- [ ] Turn system ticks: player acts, NPC wanders
- [ ] HUD shows HP and floor number
- [ ] Message log shows movement events
- [ ] Canvas fills viewport

Run: `npx vitest run && node build.js`
Expected: All tests pass, build succeeds.

```bash
git add -A
git commit -m "milestone: Phase 1 complete — engine core with map, camera, turns, rendering, HUD"
```

---

## Phase 2: Dungeon Generation (Task-Level)

### Task 17: BSP Tree Data Structure
- **Files:** `src/dungeon-gen.js`, `tests/dungeon-gen.test.js`
- BSP node class with recursive splitting
- Tests: splits produce valid children, leaf nodes within size range

### Task 18: Room Placement in BSP Leaves
- **Files:** `src/dungeon-gen.js`, `tests/dungeon-gen.test.js`
- Place rooms within leaf bounds with min/max size constraints
- Tests: rooms don't overlap, rooms within leaf bounds, min 4x4 interior

### Task 19: Corridor Generation
- **Files:** `src/dungeon-gen.js`, `tests/dungeon-gen.test.js`
- Connect sibling rooms with L/Z-shaped corridors, place doors
- Tests: all rooms connected (flood fill from any room reaches all rooms)

### Task 20: Floor Archetypes
- **Files:** `src/dungeon-gen.js`, `tests/dungeon-gen.test.js`
- Corridor-heavy, cavernous, hybrid — different BSP tuning params
- Tests: each archetype produces valid connected map

### Task 21: Special Room Designation
- **Files:** `src/dungeon-gen.js`, `tests/dungeon-gen.test.js`
- After generation, tag 1-3 rooms as special (treasure, trap, shop, shrine, rest, challenge)
- Tests: correct count, no overlap with boss/start room

### Task 22: Boss Room Placement
- **Files:** `src/dungeon-gen.js`, `tests/dungeon-gen.test.js`
- Largest room or dedicated room, single entrance, locked stairs
- Tests: boss room exists, is ≥8x8, has stairs, start room is furthest from boss

### Task 23: Entity Spawning
- **Files:** `src/dungeon-gen.js`, `tests/dungeon-gen.test.js`
- Spawn enemies in standard rooms, player in start room, loot in corridors/rooms
- Tests: player spawns in start room, enemies only in non-special rooms, boss room has enemies

### Task 24: Integration — Replace Test Map
- Swap `startTestMap()` in `game.js` with actual dungeon generator
- Verify minimap, exploration, connectivity in browser

---

## Phase 3: Combat & Enemies (Task-Level)

### Task 25: Pathfinding (A*)
- **Files:** `src/pathfinding.js`, `tests/pathfinding.test.js`
- A* on tile grid, returns path array
- Tests: finds shortest path, avoids walls, returns empty for unreachable

### Task 26: Damage Calculation
- **Files:** `src/combat.js`, `tests/combat.test.js`
- Stat-based formula, crits, dodge, minimum 1 damage
- Tests: fighter melee, archer ranged, mage ranged, crit, dodge, soft-gating

### Task 27: Attack Execution
- **Files:** `src/combat.js`, `tests/combat.test.js`
- Melee (adjacent), ranged (LOS check), damage application
- Tests: melee only hits adjacent, ranged requires LOS, damage applied correctly

### Task 28: Enemy AI — Rushdown
- **Files:** `src/ai.js`, `tests/ai.test.js`
- A* to player, attack when adjacent
- Tests: moves toward player, attacks when adjacent, pathfinds around walls

### Task 29: Enemy AI — Kiting
- **Files:** `src/ai.js`, `tests/ai.test.js`
- Maintain distance, retreat if too close, attack at range
- Tests: retreats when too close, advances when too far, attacks at preferred range

### Task 30: Enemy AI — Summoner
- **Files:** `src/ai.js`, `tests/ai.test.js`
- Stay distant, spawn minions on cooldown, ranged attack
- Tests: spawns minions, respects cooldown, attacks when summon unavailable

### Task 31: Enemy AI — Patrol & Ambush
- **Files:** `src/ai.js`, `tests/ai.test.js`
- Patrol waypoints, switch on LOS detection; Ambush hidden until proximity
- Tests: follows patrol, detects player, ambush triggers at 2 tiles

### Task 32: Combat Integration
- Wire combat into game loop: bump-to-attack, enemy attacks, death, boss room unlock
- Tests: player can kill enemy, enemy can kill player, stairs unlock when boss room cleared

---

## Phase 4: Gear & Inventory (Task-Level)

### Task 33: Item Data Model
- **Files:** `src/items.js`, `tests/items.test.js`
- Item structure, rarity, gear vs consumable properties
- Tests: valid item creation, correct structure

### Task 34: Item Generation
- **Files:** `src/items.js`, `tests/items.test.js`
- Procedural generation: rarity roll, stat roll, skill roll, name generation
- Tests: rarity distribution, stat ranges by rarity, floor scaling, skill chance

### Task 35: Equipment System
- **Files:** `src/inventory.js`, `tests/inventory.test.js`
- Equip/unequip to 7 slots, stat recalculation
- Tests: equip applies stats, unequip removes stats, slot restrictions

### Task 36: Inventory Management
- **Files:** `src/inventory.js`, `tests/inventory.test.js`
- 12-slot backpack, pickup, drop, full check
- Tests: add item, remove item, full inventory rejects, pickup from ground

### Task 37: Belt & Consumables
- **Files:** `src/inventory.js`, `tests/inventory.test.js`
- 3-slot belt, assign consumable, use via hotkey, consume turn
- Tests: assign to belt, use consumes item and turn, belt only accepts consumables

### Task 38: Gear-Bound Skills
- **Files:** `src/skills.js`, `tests/skills.test.js`
- Skill definitions, cooldown tracking, equip grants skill / unequip removes
- Tests: skill appears on equip, cooldown decrements per turn, skill removed on unequip

### Task 39: Inventory UI Overlay
- Keyboard-navigable inventory screen (I/Tab), equip/unequip/drop actions
- Integration with game state

---

## Phase 5: Progression & Hub (Task-Level)

### Task 40: Save Data System
- **Files:** `src/progression.js`, `tests/progression.test.js`
- localStorage load/save, save data structure, migration-safe
- Tests: save/load roundtrip, defaults for missing data

### Task 41: Meta-Currency
- **Files:** `src/progression.js`, `tests/progression.test.js`
- Earn from kills/floors/bosses, persist on death/victory
- Tests: currency accumulates, persists across runs

### Task 42: Hub Menu System
- Class select, shop, stash, achievements screens
- Navigation between screens, start run

### Task 43: Between-Run Shop
- **Files:** `src/progression.js`, `tests/progression.test.js`
- Randomized inventory, permanent stat bumps, starting gear, perks
- Tests: shop generates items, purchases persist, permanent upgrades apply

### Task 44: Item Stash
- **Files:** `src/progression.js`, `tests/progression.test.js`
- 30-slot persistent storage, save 1 on death, pull 1 before run
- Tests: stash save/load, limit enforced, bring into run

### Task 45: Achievement System
- **Files:** `src/progression.js`, `tests/progression.test.js`
- Data-driven achievement definitions, progress tracking, bonus application
- Tests: progress increments, unlock triggers, bonus applied

---

## Phase 6: Content (Task-Level)

### Task 46: Floor 1-2 Enemies (Rat, Bat, Slime)
- Sprite definitions, stat blocks, slime split mechanic
- Tests: correct stats, slime splits on death

### Task 47: Floor 4-5 Enemies (Skeleton, Skeleton Archer, Shade)
- Sprite definitions, stat blocks, shade ambush mechanic
- Tests: shade invisible until 2 tiles, archer kites

### Task 48: Floor 7-8 Enemies (Wraith, Dark Knight, Necromancer)
- Sprite definitions, stat blocks, necromancer summon mechanic
- Tests: wraith ignores armor partially, necromancer summons

### Task 49: Boss — Broodmother (Floor 3)
- 32x32 sprite, spawn adds, melee bite
- Tests: spawns broodlings, melee attack at adjacent

### Task 50: Boss — Hollow Knight (Floor 6)
- 32x32 sprite, telegraph attack, high defense
- Tests: telegraph visible, charge attack in line/cone

### Task 51: Boss — Archlich (Floor 9)
- 32x32 sprite, summon undead, frost nova, ranged magic
- Tests: summons increase over time, frost nova damages in radius

### Task 52: Final Bosses — Demon Lord, Eldritch Horror, Fallen God (Floor 10)
- 32x32 sprites, unique mechanics each, random selection
- Tests: each boss mechanics, random selection per run

### Task 53: Special Room Mechanics
- Treasure (guardian spawn), Trap (hazard tiles), Shop (vendor), Shrine (blessings), Rest (heal), Challenge (waves)
- Tests: each room type triggers correctly

### Task 54: Consumable Items
- All consumable types: potions, scrolls, bombs
- Tests: each consumable effect works correctly

### Task 55: Full Item Pool
- Weapon/armor templates for all floors, name generation, balanced stat ranges
- Tests: items generated for each floor depth, stat ranges correct

---

## Phase 7: Polish (Task-Level)

### Task 56: Procedural Audio System
- **Files:** `src/audio.js`
- Web Audio API: oscillators, noise, envelopes for all sound effects
- Volume control saved to settings

### Task 57: Ambient Audio
- Low-frequency drone, floor-depth variation, boss room variation
- Global volume control

### Task 58: Visual Effects
- Damage numbers (float up, fade), attack flash/shake, death animations
- Status effect indicators, boss telegraph highlights

### Task 59: Balance Pass
- Tune all numbers: enemy HP/damage scaling, item stat ranges, currency earn rates, shop prices, skill cooldowns
- Playtest-driven iteration

### Task 60: Quality of Life
- Auto-pickup gold, tooltip system, scrollable message log, minimap toggle
- Confirmation dialogs for rare item drops, stash actions

### Task 61: PWA Setup
- Inline service worker, data URI manifest, offline caching
- Tests: installable, works offline after first load

### Task 62: Final Integration & Acceptance
- Full playthrough test, performance profiling (60fps target)
- Single HTML file verification, localStorage persistence
- All Phase 7 acceptance criteria

---

## Parallel Execution Strategy

For maximum speed, tasks within each phase can be parallelized along these streams:

**Phase 1:** Streams A-F run in parallel (Tasks 2-11), then G integrates (Tasks 12-16)
**Phase 2:** Tasks 17-18, 19, 21-22 can run in parallel, then 23-24 integrate
**Phase 3:** Tasks 25-26 in parallel with 28-31, then 32 integrates
**Phase 4:** Tasks 33-34, 35-36, 37-38 in parallel, then 39 integrates
**Phase 5:** Tasks 40-41, 42-45 can overlap significantly
**Phase 6:** Tasks 46-48 in parallel, 49-52 in parallel, 53-55 in parallel
**Phase 7:** Tasks 56-57 in parallel with 58-60, then 61-62 finalize

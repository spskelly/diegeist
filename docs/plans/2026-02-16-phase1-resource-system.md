# Phase 1: Resource System & Material Drops — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a material resource layer to the existing dungeon loop so enemies drop materials, materials accumulate during a run, and they persist to SaveData on run completion (100%) or death (50%).

**Architecture:** A new `resources.js` module defines the 5 material types, biome-to-material mapping, and drop calculation functions. `SaveData` gains persistent `materials` and per-run `runMaterials` fields. `handleEnemyDeath()` rolls material drops alongside existing gear/currency drops. `finalizeRun()` commits run materials to persistent storage with a victory/death multiplier. The HUD displays current run material counts. The post-death menu gains a "save material haul" option alongside the existing "save 1 item" flow.

**Tech Stack:** Vanilla JS, ES modules, Vitest

---

## Context: Key Files & Line Numbers

These are the files you'll touch and their current structure. Read them before editing.

- `src/progression.js` — `SaveData` class (lines 30-108), `serialize()` (87-100), `deserialize()` (102-107)
- `src/game.js` — `handleEnemyDeath()` (1172-1213), `finalizeRun()` (1215-1230), `handleFloorTransition()` (2445-2497), `startNewRun()` (1243-1273), `drawPostDeathMenu()` (2976-3020), `handlePostDeathMenuAction()` (1315-1339), `captureRunItemsForHub()` (222-237)
- `src/hud.js` — `draw()` method (112-233)
- `src/constants.js` — `getBiome()` (46-51), `BIOME_THEMES` (53-122)
- `src/dungeon-gen.js` — `generateDungeon()` (321-428)
- `build.js` — `SOURCE_ORDER` array (7-30)
- `tests/progression.test.js` — existing SaveData tests

---

### Task 1: Create `resources.js` Module with Material Constants & Drop Logic

**Files:**
- Create: `src/resources.js`
- Create: `tests/resources.test.js`
- Modify: `build.js:7-30` (add to SOURCE_ORDER)

This module defines the 5 material types, maps biomes to their primary/secondary/tertiary materials, and exports a pure function `rollMaterialDrop()` that takes biome + rank + context and returns a material drop result (or null).

**Step 1: Write the failing tests**

```js
// tests/resources.test.js
import { describe, it, expect } from 'vitest';
import {
  MATERIALS,
  BIOME_MATERIALS,
  rollMaterialDrop,
  getFloorClearMaterials,
  getBossKillMaterials,
  createEmptyMaterials,
  addMaterials,
  scaleMaterials,
} from '../src/resources.js';

describe('MATERIALS', () => {
  it('defines 5 material types', () => {
    expect(MATERIALS).toEqual(['timber', 'stone', 'iron', 'crystal', 'aether']);
  });
});

describe('BIOME_MATERIALS', () => {
  it('maps each biome to a primary material', () => {
    expect(BIOME_MATERIALS.jungle.primary).toBe('timber');
    expect(BIOME_MATERIALS.dirt_cave.primary).toBe('stone');
    expect(BIOME_MATERIALS.stone_cave.primary).toBe('iron');
    expect(BIOME_MATERIALS.dungeon.primary).toBe('crystal');
  });
});

describe('createEmptyMaterials', () => {
  it('returns an object with all materials at 0', () => {
    const m = createEmptyMaterials();
    expect(m).toEqual({ timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 });
  });

  it('returns a new object each call', () => {
    const a = createEmptyMaterials();
    const b = createEmptyMaterials();
    expect(a).not.toBe(b);
  });
});

describe('addMaterials', () => {
  it('adds source materials to target in place', () => {
    const target = { timber: 5, stone: 0, iron: 0, crystal: 0, aether: 0 };
    const source = { timber: 3, stone: 2, iron: 0, crystal: 0, aether: 0 };
    addMaterials(target, source);
    expect(target.timber).toBe(8);
    expect(target.stone).toBe(2);
  });
});

describe('scaleMaterials', () => {
  it('multiplies all values by factor and rounds up', () => {
    const m = { timber: 5, stone: 3, iron: 1, crystal: 0, aether: 0 };
    const result = scaleMaterials(m, 0.5);
    expect(result.timber).toBe(3); // ceil(2.5)
    expect(result.stone).toBe(2); // ceil(1.5)
    expect(result.iron).toBe(1);  // ceil(0.5)
    expect(result.crystal).toBe(0);
    expect(result.aether).toBe(0);
  });
});

describe('rollMaterialDrop', () => {
  it('returns null when roll exceeds drop chance', () => {
    // forceRoll = 0.99 should always miss the 40% base chance
    const result = rollMaterialDrop('jungle', 1, { forceRoll: 0.99 });
    expect(result).toBeNull();
  });

  it('returns a material drop when roll is under drop chance', () => {
    const result = rollMaterialDrop('jungle', 1, { forceRoll: 0.1, forceQtyRoll: 0.5 });
    expect(result).not.toBeNull();
    expect(result.type).toBe('timber');
    expect(result.quantity).toBeGreaterThanOrEqual(1);
    expect(result.quantity).toBeLessThanOrEqual(2);
  });

  it('scales quantity with rank', () => {
    // At rank 5, quantity range is 1-2 * (1 + 4*0.35) = 2.4× → range ~2-5
    const result = rollMaterialDrop('jungle', 5, { forceRoll: 0.1, forceQtyRoll: 0.99 });
    expect(result.quantity).toBeGreaterThanOrEqual(2);
  });

  it('can return secondary material at rank 3+', () => {
    // Force secondary roll to hit (under 0.15)
    const result = rollMaterialDrop('jungle', 3, {
      forceRoll: 0.1,
      forceQtyRoll: 0.5,
      forceSecondaryRoll: 0.05,
    });
    expect(result.type).toBe('stone'); // jungle secondary
  });
});

describe('getFloorClearMaterials', () => {
  it('returns biome primary material with quantity 3-5 at rank 1', () => {
    const result = getFloorClearMaterials('jungle', 1, 0.5);
    expect(result.type).toBe('timber');
    expect(result.quantity).toBeGreaterThanOrEqual(3);
    expect(result.quantity).toBeLessThanOrEqual(5);
  });

  it('scales quantity with rank', () => {
    const r1 = getFloorClearMaterials('jungle', 1, 0.5);
    const r5 = getFloorClearMaterials('jungle', 5, 0.5);
    expect(r5.quantity).toBeGreaterThan(r1.quantity);
  });
});

describe('getBossKillMaterials', () => {
  it('always includes aether', () => {
    const results = getBossKillMaterials('jungle', 1, 0.5);
    const aether = results.find(r => r.type === 'aether');
    expect(aether).toBeDefined();
    expect(aether.quantity).toBeGreaterThanOrEqual(2);
    expect(aether.quantity).toBeLessThanOrEqual(4);
  });

  it('includes biome primary material', () => {
    const results = getBossKillMaterials('jungle', 1, 0.5);
    const primary = results.find(r => r.type === 'timber');
    expect(primary).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/resources.test.js`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```js
// src/resources.js

export const MATERIALS = ['timber', 'stone', 'iron', 'crystal', 'aether'];

export const BIOME_MATERIALS = {
  jungle:     { primary: 'timber',  secondary: 'stone',   tertiary: 'iron' },
  dirt_cave:  { primary: 'stone',   secondary: 'iron',    tertiary: 'timber' },
  stone_cave: { primary: 'iron',    secondary: 'crystal', tertiary: 'stone' },
  dungeon:    { primary: 'crystal', secondary: 'iron',    tertiary: 'aether' },
};

const BASE_DROP_CHANCE = 0.40;
const BASE_QTY_MIN = 1;
const BASE_QTY_MAX = 2;
const QTY_RANK_SCALE = 0.35;
const SECONDARY_CHANCE = 0.15;  // at rank 3+
const TERTIARY_CHANCE = 0.08;   // at rank 5+

export function createEmptyMaterials() {
  return { timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 };
}

export function addMaterials(target, source) {
  for (const mat of MATERIALS) {
    target[mat] = (target[mat] || 0) + (source[mat] || 0);
  }
}

export function scaleMaterials(materials, factor) {
  const result = createEmptyMaterials();
  for (const mat of MATERIALS) {
    result[mat] = materials[mat] > 0 ? Math.ceil(materials[mat] * factor) : 0;
  }
  return result;
}

export function rollMaterialDrop(biome, rank = 1, opts = {}) {
  const roll = opts.forceRoll ?? Math.random();
  if (roll >= BASE_DROP_CHANCE) return null;

  const biomeMats = BIOME_MATERIALS[biome] || BIOME_MATERIALS.jungle;
  const qtyRoll = opts.forceQtyRoll ?? Math.random();

  // Determine which material type drops
  let type = biomeMats.primary;
  if (rank >= 5) {
    const tertiaryRoll = opts.forceTertiaryRoll ?? Math.random();
    if (tertiaryRoll < TERTIARY_CHANCE) {
      type = biomeMats.tertiary;
    }
  }
  if (rank >= 3 && type === biomeMats.primary) {
    const secondaryRoll = opts.forceSecondaryRoll ?? Math.random();
    if (secondaryRoll < SECONDARY_CHANCE) {
      type = biomeMats.secondary;
    }
  }

  // Scale quantity with rank
  const rankMultiplier = 1 + (rank - 1) * QTY_RANK_SCALE;
  const scaledMin = Math.max(1, Math.round(BASE_QTY_MIN * rankMultiplier));
  const scaledMax = Math.max(scaledMin, Math.round(BASE_QTY_MAX * rankMultiplier));
  const quantity = scaledMin + Math.floor(qtyRoll * (scaledMax - scaledMin + 1));

  return { type, quantity };
}

export function getFloorClearMaterials(biome, rank = 1, qtyRoll = null) {
  const biomeMats = BIOME_MATERIALS[biome] || BIOME_MATERIALS.jungle;
  const roll = qtyRoll ?? Math.random();
  const baseMin = 3;
  const baseMax = 5;
  const rankMultiplier = 1 + (rank - 1) * QTY_RANK_SCALE;
  const scaledMin = Math.round(baseMin * rankMultiplier);
  const scaledMax = Math.round(baseMax * rankMultiplier);
  const quantity = scaledMin + Math.floor(roll * (scaledMax - scaledMin + 1));
  return { type: biomeMats.primary, quantity };
}

export function getBossKillMaterials(biome, rank = 1, qtyRoll = null) {
  const biomeMats = BIOME_MATERIALS[biome] || BIOME_MATERIALS.jungle;
  const roll = qtyRoll ?? Math.random();
  const aetherQty = 2 + Math.floor(roll * 3); // 2-4

  const rankMultiplier = 1 + (rank - 1) * QTY_RANK_SCALE;
  const primaryQty = Math.round(3 * rankMultiplier) + Math.floor(roll * Math.round(3 * rankMultiplier));

  return [
    { type: 'aether', quantity: aetherQty },
    { type: biomeMats.primary, quantity: primaryQty },
  ];
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/resources.test.js`
Expected: All pass

**Step 5: Add `resources.js` to build order**

In `build.js`, insert `'resources.js'` after `'constants.js'` in the `SOURCE_ORDER` array (it depends only on nothing, but is needed by `game.js`).

The array becomes:
```
'constants.js',
'resources.js',
'game-map.js',
...
```

**Step 6: Commit**

```bash
git add src/resources.js tests/resources.test.js build.js
git commit -m "feat: add resources module with material types, drop logic, and tests"
```

---

### Task 2: Extend SaveData with Material Fields

**Files:**
- Modify: `src/progression.js:30-107` (SaveData class)
- Modify: `tests/progression.test.js` (add new tests)

Add `materials` (persistent bank) and `runMaterials` (current run accumulation) fields to SaveData. Both serialize/deserialize. Old saves without these fields default to empty materials via backward-compat.

**Step 1: Write the failing tests**

Add to `tests/progression.test.js`, inside the `SaveData` describe block:

```js
  it('initializes with empty materials', () => {
    expect(save.materials).toEqual({ timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 });
  });

  it('adds materials', () => {
    save.addMaterials({ timber: 5, stone: 3 });
    expect(save.materials.timber).toBe(5);
    expect(save.materials.stone).toBe(3);
    expect(save.materials.iron).toBe(0);
  });

  it('checks if materials are affordable', () => {
    save.addMaterials({ timber: 10, stone: 5 });
    expect(save.canAfford({ timber: 5, stone: 3 })).toBe(true);
    expect(save.canAfford({ timber: 15 })).toBe(false);
  });

  it('spends materials when affordable', () => {
    save.addMaterials({ timber: 10, stone: 5 });
    const result = save.spendMaterials({ timber: 4, stone: 2 });
    expect(result).toBe(true);
    expect(save.materials.timber).toBe(6);
    expect(save.materials.stone).toBe(3);
  });

  it('rejects spending materials when not affordable', () => {
    save.addMaterials({ timber: 3 });
    const result = save.spendMaterials({ timber: 5 });
    expect(result).toBe(false);
    expect(save.materials.timber).toBe(3); // unchanged
  });

  it('serializes and deserializes materials', () => {
    save.addMaterials({ timber: 10, iron: 5 });
    const json = save.serialize();
    const loaded = SaveData.deserialize(json);
    expect(loaded.materials.timber).toBe(10);
    expect(loaded.materials.iron).toBe(5);
    expect(loaded.materials.crystal).toBe(0);
  });

  it('deserializes old saves without materials to defaults', () => {
    const oldJson = JSON.stringify({ currency: 50, stash: [] });
    const loaded = SaveData.deserialize(oldJson);
    expect(loaded.materials).toEqual({ timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 });
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/progression.test.js`
Expected: FAIL — `save.materials` is undefined

**Step 3: Implement SaveData material fields**

In `src/progression.js`, modify the SaveData class:

In the constructor (after `this.pendingLoadoutItem = null;`), add:
```js
    this.materials = { timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 };
```

Add these methods after `addPerk()`:
```js
  addMaterials(mats) {
    for (const [key, val] of Object.entries(mats)) {
      if (key in this.materials && val > 0) {
        this.materials[key] += val;
      }
    }
  }

  canAfford(cost) {
    for (const [key, val] of Object.entries(cost)) {
      if ((this.materials[key] || 0) < val) return false;
    }
    return true;
  }

  spendMaterials(cost) {
    if (!this.canAfford(cost)) return false;
    for (const [key, val] of Object.entries(cost)) {
      this.materials[key] -= val;
    }
    return true;
  }
```

In `serialize()`, add `materials: this.materials` to the JSON object.

In `deserialize()`, after `Object.assign(save, data);`, add:
```js
    if (!save.materials) {
      save.materials = { timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 };
    }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/progression.test.js`
Expected: All pass (old + new tests)

**Step 5: Commit**

```bash
git add src/progression.js tests/progression.test.js
git commit -m "feat: add material fields to SaveData with serialize/deserialize"
```

---

### Task 3: Track Run Materials in Game & Commit on Finalize

**Files:**
- Modify: `src/game.js:1172-1213` (handleEnemyDeath)
- Modify: `src/game.js:1215-1230` (finalizeRun)
- Modify: `src/game.js:1243-1273` (startNewRun)
- Modify: `src/game.js:2445-2497` (handleFloorTransition)
- Modify: `src/game.js` top imports

This task integrates material drops into the game loop. It adds `runMaterials` tracking to the Game class, rolls material drops in `handleEnemyDeath()`, awards floor clear and boss kill material bonuses, and commits materials in `finalizeRun()`.

**Step 1: Add imports**

At the top of `src/game.js`, add to the import section:
```js
import { createEmptyMaterials, addMaterials, scaleMaterials, rollMaterialDrop, getFloorClearMaterials, getBossKillMaterials } from './resources.js';
import { getBiome } from './constants.js'; // if not already imported
```

**Step 2: Initialize runMaterials in startNewRun()**

In `startNewRun()`, after the `this.runSummary = { ... }` block (around line 1263), add:
```js
    this.runMaterials = createEmptyMaterials();
```

Also add `this.runMaterials = createEmptyMaterials();` in the constructor/init if the Game class has one, or at least ensure it's initialized before use.

**Step 3: Add material drops to handleEnemyDeath()**

In `handleEnemyDeath()`, after the existing gear/consumable drop logic (after line 1210, before the audio line), add material drop logic:

```js
    // Material drops
    const biome = getBiome(this.floorNumber);
    if (enemy.isFloorBoss) {
      const bossMats = getBossKillMaterials(biome, this.currentRank || 1);
      for (const drop of bossMats) {
        this.runMaterials[drop.type] += drop.quantity;
        this.messageLog.add(`Gained ${drop.quantity} ${drop.type}.`, this.turnCount);
      }
    } else {
      const matDrop = rollMaterialDrop(biome, this.currentRank || 1);
      if (matDrop) {
        this.runMaterials[matDrop.type] += matDrop.quantity;
        this.messageLog.add(`Gained ${matDrop.quantity} ${matDrop.type}.`, this.turnCount);
      }
    }
```

**Step 4: Add floor clear material bonus to handleFloorTransition()**

In `handleFloorTransition()`, in the "descend to next floor" branch (around line 2481-2494), after the currency reward and before `this.floorNumber++`, add:

```js
    // Floor clear material bonus
    const biome = getBiome(this.floorNumber);
    const floorMats = getFloorClearMaterials(biome, this.currentRank || 1);
    this.runMaterials[floorMats.type] += floorMats.quantity;
    this.messageLog.add(`Floor clear: +${floorMats.quantity} ${floorMats.type}.`, this.turnCount);
```

Also add the same material bonus in the victory branch (floor >= 10), before `this.finalizeRun('Victory')`:

```js
    const biome = getBiome(this.floorNumber);
    const floorMats = getFloorClearMaterials(biome, this.currentRank || 1);
    this.runMaterials[floorMats.type] += floorMats.quantity;
```

**Step 5: Commit run materials in finalizeRun()**

In `finalizeRun()`, after `this.saveData.addCurrency(...)` and before `this.saveData.addRunHistory(...)`, add:

```js
    // Commit run materials: 100% on victory, 50% on death
    if (this.runMaterials) {
      const isVictory = causeOfDeath === 'Victory';
      const mats = isVictory ? this.runMaterials : scaleMaterials(this.runMaterials, 0.5);
      this.saveData.addMaterials(mats);
    }
```

Also add `materialsGained` to the run history entry for tracking:
```js
    this.saveData.addRunHistory({
      classKey: this.runSummary.classKey,
      floorsReached: this.runSummary.floorsReached,
      enemiesKilled: this.runSummary.enemiesKilled,
      currencyEarned: this.runSummary.currencyEarned,
      causeOfDeath: this.runSummary.causeOfDeath,
      materialsGained: this.runMaterials ? { ...this.runMaterials } : null,
    });
```

**Step 6: Add `this.currentRank = 1;` initialization**

In `startNewRun()`, add `this.currentRank = 1;` alongside the other initializations. This field will be used by the rank system in Phase 6, but needs to exist now as a default so the material drop functions work.

**Step 7: Commit**

```bash
git add src/game.js
git commit -m "feat: integrate material drops into enemy death, floor clear, and run finalization"
```

---

### Task 4: Add Material Counter to HUD

**Files:**
- Modify: `src/hud.js:112-233` (draw method)

Display current run material counts in the HUD, in the info area between the HP bar and the belt/skills panel. Show only non-zero materials to avoid clutter.

**Step 1: Modify HUD.draw() to accept and render materials**

The `draw()` method signature changes to:
```js
draw(player, messageLog, derivedStats = null, runMaterials = null)
```

After the existing `Floor` and `Essence` text (around line 164), add material display:

```js
    // Run materials
    if (runMaterials) {
      const matNames = { timber: 'TMB', stone: 'STN', iron: 'IRN', crystal: 'CRY', aether: 'ATH' };
      const matColors = { timber: '#8b6b3b', stone: '#9a9a8a', iron: '#7a8a9a', crystal: '#9a7ac8', aether: '#c8a0ff' };
      let matX = infoX;
      const matY = hpBarY + Math.round(30 * s);
      ctx.font = `${Math.round(10 * s)}px monospace`;
      for (const [key, abbr] of Object.entries(matNames)) {
        const val = runMaterials[key] || 0;
        if (val === 0) continue;
        ctx.fillStyle = matColors[key];
        const label = `${abbr}:${val}`;
        ctx.fillText(label, matX, matY);
        matX += ctx.measureText(label).width + Math.round(10 * s);
      }
    }
```

**Step 2: Update the HUD.draw() call site in game.js**

In `src/game.js`, find the line that calls `this.hud.draw(...)` (line 3423):
```js
this.hud.draw(this.player, this.messageLog, this.getEntityStatsWithEquipment(this.player));
```

Change it to:
```js
this.hud.draw(this.player, this.messageLog, this.getEntityStatsWithEquipment(this.player), this.runMaterials);
```

**Step 3: Commit**

```bash
git add src/hud.js src/game.js
git commit -m "feat: display run material counts in HUD"
```

---

### Task 5: Add Material Summary to Post-Death & Victory Screens

**Files:**
- Modify: `src/game.js:2976-3020` (drawPostDeathMenu)
- Modify: `src/game.js:3022-3050` (drawVictoryScreen)

Show the materials gained (and the death penalty) on the run summary screens.

**Step 1: Store committed materials for display**

In `finalizeRun()`, after computing the committed materials, store them for display:

```js
    if (this.runMaterials) {
      const isVictory = causeOfDeath === 'Victory';
      const mats = isVictory ? this.runMaterials : scaleMaterials(this.runMaterials, 0.5);
      this.saveData.addMaterials(mats);
      this.committedMaterials = { ...mats };
      this.rawRunMaterials = { ...this.runMaterials };
    }
```

**Step 2: Add material display to drawPostDeathMenu()**

In `drawPostDeathMenu()`, after the `Essence Earned` line (around line 3003), add:

```js
    // Material summary
    if (this.rawRunMaterials) {
      const matNames = { timber: 'Timber', stone: 'Stone', iron: 'Iron', crystal: 'Crystal', aether: 'Aether' };
      let matLine = 'Materials: ';
      let hasMats = false;
      for (const [key, label] of Object.entries(matNames)) {
        const raw = this.rawRunMaterials[key] || 0;
        if (raw > 0) {
          const kept = this.committedMaterials?.[key] || 0;
          matLine += `${label}:${kept}/${raw} `;
          hasMats = true;
        }
      }
      if (hasMats) {
        ctx.fillText(matLine.trim(), x + Math.round(20 * uiScale), y + Math.round(166 * uiScale));
        ctx.fillStyle = '#ff8a6a';
        ctx.fillText('(50% kept on death)', x + Math.round(20 * uiScale), y + Math.round(184 * uiScale));
        ctx.fillStyle = '#afc0d2';
      }
    }
```

Adjust the options Y offset to accommodate the new lines — shift the options block down by ~40px if materials are shown.

**Step 3: Add material display to drawVictoryScreen()**

Similarly, add material totals to the victory screen after the existing run stats. Victory shows 100% kept.

**Step 4: Commit**

```bash
git add src/game.js
git commit -m "feat: show material summary on death and victory screens"
```

---

### Task 6: Expand Death-Save Choice to Include Material Haul

**Files:**
- Modify: `src/game.js:1315-1339` (handlePostDeathMenuAction)
- Modify: `src/game.js:2976-3020` (drawPostDeathMenu)
- Modify: `src/game.js:1215-1230` (finalizeRun)

Currently, death leads to a simple Retry/Hub/MainMenu menu. The spec requires a death-save choice: save 1 item OR save full material haul (restoring the 50% penalty to 100%).

**Step 1: Add death-save state**

Add a new state `deathSaveChoice` that appears between `deathSplash` and `postDeathMenu`. The player chooses between:
- **Save an item** — go to hub with 1 item stashable (existing behavior)
- **Save material haul** — restore run materials to 100% (re-add the 50% that was lost)
- **Save nothing** — proceed with defaults

In `handleDeathSplashAction()`, change the transition target from `postDeathMenu` to `deathSaveChoice`:
```js
    if (action.type === 'inventoryConfirm' || action.type === 'wait' || action.type === 'close') {
      this.state = 'deathSaveChoice';
      this.deathSaveIndex = 0;
      if (this.audio) this.audio.uiClick();
    }
```

**Step 2: Add deathSaveChoice handler**

```js
  handleDeathSaveChoiceAction(action) {
    if (!action) return;
    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        this.deathSaveIndex = (this.deathSaveIndex + 2 + delta) % 2;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.deathSaveIndex === 0) {
        // Save 1 item — existing behavior preserved
        this.hubCanStashMultipleFromRun = false;
      } else {
        // Save full material haul — restore the 50% penalty
        if (this.rawRunMaterials && this.committedMaterials) {
          const restored = {};
          for (const key of Object.keys(this.rawRunMaterials)) {
            const diff = this.rawRunMaterials[key] - (this.committedMaterials[key] || 0);
            if (diff > 0) restored[key] = diff;
          }
          this.saveData.addMaterials(restored);
          persistSaveData(this.saveData);
        }
        this.hubRunCarryover = []; // no item save
      }
      this.state = 'postDeathMenu';
      this.postDeathMenuIndex = 0;
    }
  }
```

**Step 3: Add deathSaveChoice drawing**

```js
  drawDeathSaveChoice() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
    const panelW = Math.min(Math.round(440 * uiScale), w - 40);
    const panelH = Math.min(Math.round(200 * uiScale), h - 40);
    const x = Math.floor((w - panelW) / 2);
    const y = Math.floor((h - panelH) / 2);

    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#171d28';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = '#4f6075';
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.fillStyle = '#e8eef5';
    ctx.font = `${Math.round(22 * uiScale)}px monospace`;
    ctx.fillText('Death Save', x + Math.round(20 * uiScale), y + Math.round(38 * uiScale));

    ctx.fillStyle = '#afc0d2';
    ctx.font = `${Math.round(13 * uiScale)}px monospace`;
    ctx.fillText('Choose one to save:', x + Math.round(20 * uiScale), y + Math.round(64 * uiScale));

    const options = ['Save 1 Item to Stash', 'Save Full Material Haul'];
    for (let i = 0; i < options.length; i++) {
      const selected = i === this.deathSaveIndex;
      if (selected) {
        ctx.fillStyle = '#2b3a4d';
        ctx.fillRect(x + Math.round(18 * uiScale), y + Math.round(82 * uiScale) + i * Math.round(36 * uiScale), panelW - Math.round(36 * uiScale), Math.round(28 * uiScale));
      }
      ctx.fillStyle = selected ? '#ffffff' : '#9db0c4';
      ctx.font = `${Math.round(16 * uiScale)}px monospace`;
      ctx.fillText(options[i], x + Math.round(28 * uiScale), y + Math.round(102 * uiScale) + i * Math.round(36 * uiScale));
    }
  }
```

**Step 4: Wire up the new state in update() and draw()**

In `update()`, add handling for the new state:
```js
    if (this.state === 'deathSaveChoice') {
      this.handleDeathSaveChoiceAction(action);
      return;
    }
```

In `draw()`, add:
```js
    if (this.state === 'deathSaveChoice') {
      this.drawDeathSaveChoice();
      return;
    }
```

**Step 5: Commit**

```bash
git add src/game.js
git commit -m "feat: add death-save choice between item save and material haul save"
```

---

### Task 7: Run Full Test Suite & Build Verification

**Files:**
- No changes — verification only

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass, including new resource tests and updated progression tests.

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds, `dist/diegeist.html` is generated without errors.

**Step 3: Verify no regressions**

Check that the build output includes the new `resources.js` module code by searching the output:

Run: `grep -c "BIOME_MATERIALS" dist/diegeist.html`
Expected: At least 1 match

**Step 4: Commit any fixups if needed, otherwise done**

---

## Summary of All Changes

| File | Action | What Changes |
|------|--------|-------------|
| `src/resources.js` | Create | Material types, biome mapping, drop functions |
| `tests/resources.test.js` | Create | Tests for all resource functions |
| `build.js` | Modify | Add `resources.js` to `SOURCE_ORDER` |
| `src/progression.js` | Modify | Add `materials` to SaveData constructor, add `addMaterials/canAfford/spendMaterials` methods, update serialize/deserialize |
| `tests/progression.test.js` | Modify | Add material-related SaveData tests |
| `src/game.js` | Modify | Import resources module, add `runMaterials`/`currentRank` to state, material drops in `handleEnemyDeath`, floor clear bonuses in `handleFloorTransition`, material commit in `finalizeRun`, pass materials to HUD, death-save choice state, material summary on death/victory screens |
| `src/hud.js` | Modify | Accept and render `runMaterials` parameter in `draw()` |

Total: 2 new files, 5 modified files, ~300 lines of new code, ~50 lines of test code.

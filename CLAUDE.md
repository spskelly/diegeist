# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test             # run all tests (vitest)
npm run test:watch   # watch mode
npx vitest run tests/combat.test.js   # run a single test file
npm run build        # build to dist/
npx serve dist       # serve locally for PWA testing
npm run playtest     # build + drive the real game headlessly with a bot (needs chromium via `npx playwright install chromium`)
```

## Architecture

Diegeist is a roguelite dungeon crawler. All game code lives in `src/` as ES modules, but the build concatenates them into a single HTML file (`dist/index.html`) with no runtime dependencies.

### Build system

`build.js` reads modules in a strict dependency order (`SOURCE_ORDER` array), strips `import`/`export` statements via regex, and injects the combined code into `template.html`. It also emits PWA files (`sw.js`, `manifest.json`, `icon.svg`) into `dist/`.

**When adding a new module:** insert it into `SOURCE_ORDER` in `build.js` *before* any module that references it. The build won't error on missing dependencies — you'll get silent `undefined` at runtime.

### Module dependency order

`constants` → `resources` → `skill-tree` → `game-map` → `entity` → `player` → `turn-system` → `camera` → `fov` → `pathfinding` → `combat` → `ai` → `dungeon-gen` → `items` → `inventory` → `skills` → `progression` → `message-log` → `input` → `ui` → `sprites` → `renderer` → `hud` → `audio` → `town` → `game-utils` → `game-save` → `game-actions` → `game-floor` → `game-screens` → `game`

`game.js` is the main orchestrator. It imports everything else and runs a state machine (`init`, `startMenu`, `playing`, `pauseMenu`, `skillTree`, `deathSplash`, `deathSaveChoice`, `postDeathMenu`, `victory`, `hubMenu`, `hubShop`, `hubStash`, `hubAchievements`).

### Key design patterns

- **Energy-based turns:** entities gain energy each tick equal to their `speed`; they act when energy reaches `ENERGY_THRESHOLD` (100). Faster entities get more turns.
- **Soft gate:** combat stats from non-affinity classes are multiplied by `SOFT_GATE_MULTIPLIER` (0.65). Each class has two affinity stats defined in `PLAYER_CLASSES`.
- **Factory functions** over inheritance: `createPlayer()` returns an `Entity` with class-specific config. `generateItem()` / `generateConsumable()` produce item objects.
- **BSP dungeon generation:** recursive space partitioning with room archetypes (`corridor-heavy`, `cavernous`, `hybrid`), then corridor carving, room typing (start/boss/special), enemy spawning, and loot placement.
- **Percentage mitigation:** `calculateDamage()` scales `base × stat/5 × weapon` and then removes 2% per point of CON (WIS against magic), capped at 60%. Max HP comes from `computePlayerMaxHp()` (class base + 2×CON, +8% per level, tree multiplier) and must be recomputed via `recalcPlayerMaxHp(game)` whenever gear or level changes.
- **Hit regions:** every draw function registers tap targets through `registerRegion()` / `drawButton()` in `ui.js`; `Game.translatePointerAction()` turns taps and swipes into the same action objects the keyboard produces. Regions are cleared at the start of each `draw()`.
- **Skill hotbar:** four slots (`SKILL_SLOT_COUNT`). Slot 0 is the class skill when a matching weapon is equipped, then bound gear skills, then skill-tree actives (`player.treeActiveSkills`, persistent objects so cooldowns survive `updateActiveSkills()`).

### Tests

Vitest, `tests/*.test.js`. Tests import directly from `src/` modules (ES module imports, not the built file). No mocking framework — tests create entities and items with factory functions and assert on return values. `tests/game-actions.test.js` and `tests/game-floor.test.js` build a small real game object (open room, player, enemies) to test the orchestration modules.

`scripts/playtest.mjs` is the end-to-end check: it builds, serves `dist/`, and plays the game in headless Chromium (keyboard flow through every screen, a god-mode bot across floors, a touch-only flow on a phone viewport). It fails on page errors. CI runs it in `.github/workflows/playtest.yml`.

## Conventions

- Vanilla JS, no framework, no external runtime dependencies
- ES module syntax in source (`export class`, `export function`, `import { x } from`)
- Constants: `UPPER_SNAKE_CASE`. Classes: `PascalCase`. Functions/variables: `camelCase`
- Minimal error handling — guard clauses and clamping, not try/catch
- `dist/` is gitignored; only source and build config are committed

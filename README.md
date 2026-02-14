# Diegeist

Tile-based roguelite dungeon crawler built in vanilla JavaScript with a single-file HTML build target.

## Current Status

Playable prototype with:
- Procedural dungeon floors (BSP archetypes, start/boss/special rooms)
- Start menu with class select, death splash, and post-death retry/menu flow
- Turn-based energy system
- Enemy AI (wander, rushdown, ambush, summoner, kiting)
- Summoner minion caps and safer door topology generation
- Combat (melee/ranged/magic, crit, dodge, scaling)
- FOV and exploration fog
- Loot drops, inventory, belt consumables, gear-bound skills
- Inventory item inspection panel and character stats overlay
- Natural HP regeneration over turns
- Adaptive camera zoom with scaled sprite rendering
- Procedural audio (SFX + ambient)
- Save data persistence for progression currency/run history

Core loop works: spawn -> explore -> fight -> descend stairs -> die -> persist run summary.

## Requirements

- Node.js 18+ (recommended)
- npm

## Run Locally

1. Install dependencies:
```bash
npm install
```

2. Run tests:
```bash
npm test
```

3. Build single-file output:
```bash
npm run build
```

4. Open:
- `dist/diegeist.html` in a browser, or
- serve project root with a static server and open `dist/diegeist.html`

## Controls

- Start/death menus: `Arrow keys` to navigate, `Enter` or `Z` to confirm
- Move: `WASD` or arrow keys
- Wait: `Space` or `.`
- Pick up item on current tile: `G`
- Descend stairs: `>` (Shift + `.`) when allowed
- Character stats overlay: `P` (close with `P` or `Esc`)
- Inventory overlay: `I` or `Tab`
- Inventory overlay actions:
  - Navigate: arrows
  - Switch tabs: left/right arrows
  - Equip/unequip: `Enter` or `Z`
  - Drop selected item: `X`
  - Assign consumable to belt: `C`
  - Unequip selected gear slot: `U`
  - Close: `I`, `Tab`, or `Esc`
- Inventory includes an inspect panel for the selected item/equipment
- Skills: `Q`, `E`, `R`
- Belt consumables: `1`, `2`, `3`

## Development Notes

- Source modules live in `src/`
- Tests live in `tests/` (Vitest)
- `build.js` assembles modules into `dist/diegeist.html` using `template.html`
- Full target spec: `diegeist-spec.md`
- Task-level implementation roadmap: `docs/plans/2026-02-12-diegeist-full-build.md`

## Known Gaps vs Full Spec

- No full hub/shop/stash/achievements menu flow yet
- Later content phases (boss roster, room mechanics, balance pass, PWA service worker) still in progress

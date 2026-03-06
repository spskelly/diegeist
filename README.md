# Diegeist

Tile-based roguelite dungeon crawler built in vanilla JavaScript. Outputs a single HTML file that runs as an installable PWA.

## Current Status

Playable game with v1 core loop complete and v2 Phases 1–2 (resources, skill trees) implemented. Class select, explore procedural dungeons, fight, loot, descend, die, persist progression, repeat.

### Implemented

- Procedural dungeon generation (BSP room archetypes, corridors, start/boss/special rooms)
- Turn-based energy system
- Melee, ranged, and magic combat with crit, dodge, and floor scaling
- Six enemy AI behaviours (wander, rushdown, ambush, summoner with minion cap, kiting, patrol)
- FOV / line-of-sight with exploration fog
- Loot drops with rarity tiers, gear-bound skills, belt consumables with auto-refill
- Combined inventory UI with inspect panel, compare panel, and character stats overlay
- Hub menu between runs (shop, stash, achievements)
- Pause menu with save & quit and skill tree access
- Split input: arrow keys for movement, WASD for directional attacks
- Adaptive camera zoom with scaled sprite rendering
- Procedural audio via Web Audio API (SFX + ambient)
- Save data persistence (meta-currency, run history, stash) via localStorage
- PWA service worker and manifest for offline play and desktop install
- Resource system with material drops (Timber, Stone, Iron, Crystal, Aether) scaled by biome
- Death-save choice between keeping one item or hauling all collected materials
- Class skill trees: 3 branches × 5 nodes per class (Fighter, Archer, Mage) with passive and active skills
- XP progression with 20-level cap, skill point investment, and HUD XP bar

### Known Gaps vs Full Spec

- Town building system (v2 Phase 3+) not yet started
- Later content phases (full boss roster, special room mechanics, balance pass) still in progress
- PWA install prompt requires icon assets (placeholder SVG included; Chrome may need raster PNGs)

## Play

[**Play Diegeist**](https://spskelly.github.io/diegeist) — hosted on GitHub Pages. No install, no build, no server required.

When served over HTTPS the game is installable as a desktop/mobile app via your browser's install prompt.

## Development

Requires Node.js 18+ and npm. Only needed if you want to modify the source or run tests.

```bash
npm install          # install dev dependencies (vitest)
npm test             # run unit tests
npm run build        # build to dist/
```

To test PWA features locally, serve the `dist/` folder:

```bash
npx serve dist
```

## Controls

### Menus

| Key | Action |
|-----|--------|
| Arrow keys | Navigate |
| Enter / Z | Confirm |
| Esc | Back / close |

### Gameplay

| Key | Action |
|-----|--------|
| Arrow keys | Move |
| WASD | Directional attack |
| Space / . | Wait a turn |
| G | Pick up item |
| > (Shift + .) | Descend stairs |

### Inventory & UI

| Key | Action |
|-----|--------|
| I / Tab | Open inventory |
| P | Character stats overlay |
| Esc | Close any overlay / pause |
| Arrows | Navigate inventory grid |
| Left / Right | Switch inventory tabs |
| Enter / Z | Equip or unequip |
| X | Drop item |
| C | Assign consumable to belt |
| U | Unequip selected gear slot |
| Q / E / R | Use skill slots |
| 1 / 2 / 3 | Use belt consumables |

## Project Structure

```
src/               30 modules — the game source
tests/             21 test files (Vitest)
template.html      HTML shell with PWA meta tags and SW registration
build.js           concatenates src/ into a single HTML file + PWA assets
dist/              build output (gitignored)
  index.html       the complete game
  sw.js            cache-first service worker (versioned per build)
  manifest.json    web app manifest
  icon.svg         placeholder app icon
docs/              specs and implementation roadmaps
```

## Build System

`build.js` reads every module in `src/` in dependency order, strips ES module `import`/`export` syntax, and injects the combined code into `template.html`. It also emits `sw.js`, `manifest.json`, and `icon.svg` into `dist/`. The service worker cache key includes a `Date.now()` stamp so each build invalidates the previous cache.

No bundler, no framework, no external assets at runtime.

## License

[GPL-3.0](LICENSE)

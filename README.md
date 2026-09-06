# Diegeist

Tile-based roguelite dungeon crawler built in vanilla JavaScript. Outputs a single HTML file that runs as an installable PWA.

## Current Status

Playable game with v1 core loop complete and v2 Phases 1–2 (resources, skill trees) implemented. Class select, explore procedural dungeons, fight, loot, descend, die, persist progression, repeat. Plays with keyboard, mouse or touch, so it works as an installed PWA on a phone.

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
- Touch and mouse: tap a tile to walk there, tap an enemy to attack or close in, swipe to step, on-screen buttons for everything else
- Percentage-based defense, hp that grows with level and CON, and scaled damage numbers so gear and passives are visible
- Skill tree actives (Rush, Deadeye, Meteor, Temporal Stasis, ...) on a four-slot Q/E/R/F hotbar
- Boss signature moves: Brood Mother enrage, Rat King crown burst, Bone Lord raising corpses, Void Tyrant charge
- A town you build with run materials: Farm and Mine pay income, the Watchtower scouts early floors, the Library respecs, and the Forge, Apothecary and Shrine (blueprints from bosses) rework gear, brew potions and bless the next run
- Weapon animations: every attack swings, thrusts, chops, draws or casts with the equipped weapon's sprite, attackers lunge, and whatever gets hit flashes
- Adaptive camera zoom with scaled sprite rendering
- Procedural audio via Web Audio API (SFX + ambient)
- Save data persistence (meta-currency, run history, stash) via localStorage
- PWA service worker and manifest for offline play and desktop install
- Resource system with material drops (Timber, Stone, Iron, Crystal, Aether) scaled by biome
- Death-save choice between keeping one item or hauling all collected materials
- Class skill trees: 3 branches × 5 nodes per class (Fighter, Archer, Mage) with passive and active skills
- XP progression with 20-level cap, skill point investment, and HUD XP bar

### Known Gaps vs Full Spec

- Town has seven buildings with one service each; NPCs, adjacency bonuses, dungeon ranks and tiers from the v2 spec are not started
- Later content phases (full boss roster, special room mechanics, balance pass) still in progress
- PWA install prompt requires icon assets (placeholder SVG included; Chrome may need raster PNGs)

## Play

[**Play Diegeist**](https://spskelly.github.io/diegeist) — hosted on GitHub Pages. No install, no build, no server required.

When served over HTTPS the game is installable as a desktop/mobile app via your browser's install prompt.

## Development

Requires Node.js 18+ and npm. Only needed if you want to modify the source or run tests.

```bash
npm install          # install dev dependencies (vitest, playwright)
npm test             # run unit tests
npm run build        # build to dist/
npm run playtest     # build, serve and play the real game headlessly (needs a chromium: npx playwright install chromium)
```

The playtest drives the built game with keyboard, mouse and touch, runs a bot through several floors and fails on any page error. `npm run playtest -- archer 2500` picks the class and turn budget; set `PLAYTEST_SHOTS=./shots` to keep screenshots.

To test PWA features locally, serve the `dist/` folder:

```bash
npx serve dist
```

## Controls

### Touch / mouse

| Gesture | Action |
|---------|--------|
| Tap a tile | Walk there (stops when an enemy appears or you take damage) |
| Tap an enemy | Attack if in reach, otherwise close in |
| Tap yourself | Pick up, descend stairs, or wait |
| Swipe | Step (or attack) one tile in that direction |
| Bottom buttons | Wait, Pick up, Stairs, Bag, Skills, Map, Stats, Menu |
| Belt / skill boxes | Use that consumable or skill |
| Menus and overlays | Tap a row to select, tap again to confirm |
| Town | Tap a building to walk in; B or the Build button places new ones |

### Menus

| Key | Action |
|-----|--------|
| Arrow keys | Navigate |
| Enter / Z | Confirm |
| Esc | Back / close |
| B | Build menu (town) |

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
| K | Skill tree |
| Esc | Close any overlay / pause |
| Arrows | Navigate inventory grid |
| Left / Right | Switch inventory tabs |
| Enter / Z | Equip or unequip |
| X | Drop item |
| C | Assign consumable to belt |
| U | Unequip selected gear slot |
| Q / E / R / F | Use skill slots |
| 1 / 2 / 3 | Use belt consumables |

## Project Structure

```
src/               31 modules — the game source
tests/             23 test files (Vitest)
scripts/playtest.mjs   headless playthrough (Playwright)
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

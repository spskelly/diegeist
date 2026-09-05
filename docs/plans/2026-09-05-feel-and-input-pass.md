# Feel & Input Pass — Implementation Plan

**Goal:** Make Diegeist feel like a finished game to play, on desktop and on a phone, before any new content layer (town buildings, special rooms) is added. Fix the bugs found in the 2026-09-05 playtest, make combat numbers legible, wire up the skill tree actives that currently do nothing, and add touch/mouse input so the PWA is actually playable when installed on a phone.

**Scope:** items 2, 3 and 5 of the playtest assessment. The town/building layer (item 1) and special rooms (item 4) are deliberately out of scope.

---

## 1. Camera & presentation

**Problem.** `Camera.centerOn()` clamps to map bounds, so on wide screens the level sits in a corner and most of the canvas is black. The town reuses the dungeon camera height, so it renders with a large black band below it and to the right. On phones the game renders at zoom 1 (16px tiles) with HUD text overflowing.

**Changes.**
- `camera.js`: `centerOn()` always centers on the target. When the map is smaller than the viewport on an axis, the map is centered on that axis instead. Negative camera offsets are allowed; the renderer already skips out-of-bounds tiles.
- `game.js`: `getCameraZoom()` returns 3 on large screens (min dimension ≥ 800), 2 on medium (≥ 500), 1.5 on small. Never 1.
- `game.js`: new `syncCameraViewport()` sizes the camera for the current mode: dungeon = canvas minus HUD; town = canvas minus the two thin town bars. Called from `resizeCanvas()`, `enterTown()`, `startFloor()` and `loadRunState()`.
- Camera tests updated to the new centering rules.

## 2. Combat VFX

**Problem.** Floating text survives floor transitions and is drawn at old-map coordinates. Several texts on the same tile overlap into an unreadable blob.

**Changes.**
- `game-floor.js`: `handleFloorTransition()` calls `clearCombatVfx()` before generating the next floor.
- `game-utils.js`: `addFloatingText()` assigns a `stackIndex` = number of live texts already on that tile; `drawCombatVfx()` offsets each text upward by `stackIndex` rows. Durations lengthened slightly so stacked texts stay readable.

## 3. Combat numbers & character growth

**Problem.** Every number is 1–4. Defense is a flat subtraction with a floor of 1, so most enemy hits do exactly 1 and stat differences vanish. Leveling grants skill points only: a level 4 fighter has the same 15 HP as level 1. Gear CON does nothing for HP.

**Changes.**
- `combat.js`: damage = `base × (effectiveStat / 5) × weaponMultiplier`, then percentage mitigation `min(60%, 2% × CON)` for physical and `min(60%, 2% × WIS)` for magic. Round, minimum 1. Crit stays 2× (+ tree bonus).
- Base numbers scaled roughly 3.5×: player basic attack 3 → 10, enemy basic attack 2 → 6, gear skills, class skills, bomb, trap and thorns numbers scaled to match. Enemy and boss HP ×4 (bosses tuned individually: Brood Mother 180, Rat King 300, Bone Lord 400, Void Tyrant 500).
- `player.js`: `computePlayerMaxHp(classKey, stats, level, treeEffects)` = `(classBaseHp + 2 × CON) × (1 + 0.08 × (level − 1)) × maxHpMult`. Class base HP: fighter 50, archer 36, mage 34. Affinity stats gain +1 every two levels.
- `game-utils.js`: `recalcPlayerMaxHp(game)` keeps the HP delta (a level-up or a CON helmet heals the difference) and is called on floor start, level-up, equip/unequip/drop, pickup auto-equip and hub loadout.
- Regeneration effects heal a percentage of max HP instead of flat 1–2.
- Tests in `combat.test.js`, `player.test.js` updated; new assertions for mitigation and HP growth.

## 4. Skill tree actives & unconsumed passives

**Problem.** All 10 `skillType: 'active'` nodes can be bought and do nothing; 16 passive effect keys are resolved but never read. Enemy `stunned` is never ticked, so Staggering Blow stuns forever.

**Changes.**
- Skill slots expand from 3 to 4 (Q/E/R/F). Class skill keeps slot 0; gear skills honor bindings; tree actives fill remaining empty slots. Cooldowns for tree actives live on persistent objects (`player.treeActiveSkills`) so `updateActiveSkills()` never resets them; serialized with the run.
- `game-actions.js` gains a `useTreeSkill()` branch:
  - Berserker Rage: +40% damage / +20% damage taken, 5 turns.
  - Rush: dash 2/3 tiles toward an enemy in a straight line and hit it.
  - War Shout: slow all visible enemies 15/25% for 4 turns.
  - Deadeye: next 3 ranged attacks auto-crit.
  - Disengage: leap 2/3 tiles away from the nearest enemy.
  - Shadow Step: invisible 3 turns; enemies wander; first attack auto-crits and breaks it. The Invisibility Potion uses the same effect.
  - Caltrops: enemies within 1 tile slowed 30/50% for 3 turns.
  - Meteor: 3×3 magic burst on the nearest visible enemy.
  - Temporal Stasis: stun all visible enemies 2 turns.
  - Enchant: once per floor, +2/+4 to the equipped weapon's highest stat.
- Passives wired: death_save (Unbreakable, once per floor), trap_resistance, potion_healing_mult, drop_rate_bonus, material_bonus, gear_level_bonus, magic_resistance, passive_absorb, counterspell_chance, piercing_chance, chain_chance, cooldown_reduction (+ Archmage), overcharge, tactical_advance, ambush_damage. Salvage and Warlord need systems that do not exist yet (materials sink, companions) and stay documented as inert.
- Enemy status effects tick once per player turn; `slowed` reduces energy gain through `Entity.getEffectiveSpeed()`.

## 5. Boss mechanics

Bosses are currently summoners with big HP bars. Each gets its spec'd signature:
- Brood Mother: enrages below 25% HP (+30% speed).
- Rat King: crown burst every 4 turns hitting everything within 2 tiles.
- Bone Lord: raises corpses of enemies that died nearby as skeletons.
- Void Tyrant: charges the player from up to 4 tiles in a straight line; enrages at 66% and 33% HP.

## 6. Touch & mouse input

**Problem.** Keyboard only. Installed on a phone the game cannot be played.

**Design.**
- `input.js` listens to pointer events on the canvas. A short press is a tap `{type:'tap', x, y}`; a drag over ~24px is a swipe `{type:'swipe', dx, dy}`. Works for mouse and touch alike.
- Every draw function registers **hit regions** for its interactive elements (`registerRegion(game, x, y, w, h, action)`), cleared at the start of each frame. A tap that lands on a region emits that region's action through the same `update()` path as a key press, so all menus, overlays, HUD belt/skill boxes and the new HUD button strip (Wait, Pick up, Stairs, Inventory, Map, Stats, Menu) work with a finger or a mouse.
- A tap on the dungeon map:
  - on the player: pick up if standing on an item, descend if on stairs, otherwise wait;
  - on an adjacent enemy (or an aligned enemy for ranged classes): attack;
  - anywhere else: **travel** along a path (closed doors open on the way). Travel steps one turn every ~70ms and stops when an enemy comes into view, HP drops, the path is blocked or the target is reached. Tapping an enemy out of reach travels toward it and stops when in range.
- A swipe moves (or attacks) one tile in that direction.
- Town: tap to walk; tapping the shelter walks to its door and enters.
- `template.html`: `touch-action: none`, no text selection, mobile web-app meta.
- Audio context is resumed on the first pointer or key event so sound works on mobile.

## 7. Small fixes

- Consumables stack (`count`) in inventory and belt; using one decrements the stack.
- Death-save copy corrected ("keep 1 item, materials halved" vs "keep all materials, lose items"). Victory screen says Enter returns to town.
- Enemy `stunned` ticks (see §4).

## 8. Tests & playtest harness

- New unit tests: `tests/game-actions.test.js` (floating text stacking, tree actives, status ticking), `tests/game-floor.test.js` (VFX cleared on transition, enemy scaling), `tests/input.test.js` additions (tap/swipe classification, region hit-testing), and updates to combat/player/camera/skills/inventory tests.
- `scripts/playtest.mjs`: builds `dist/`, serves it, drives the real game in headless Chromium with a bot for several hundred turns (god-mode HP so it reaches deep floors), taps the map and menus, and fails on any page error or if the bot cannot reach floor 3. Run with `npm run playtest`.
- `.github/workflows/playtest.yml` runs it on every push and pull request.

## Order of work

1. Plan doc (this file). 
2. Camera, VFX, floating text, copy fixes, consumable stacking.
3. Combat formula, number pass, HP growth.
4. Four skill slots, tree actives, passives, enemy status ticking, boss mechanics.
5. Touch/mouse input, hit regions, HUD buttons, travel.
6. Playtest harness, unit tests, CI, README.

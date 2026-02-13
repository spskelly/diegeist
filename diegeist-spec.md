# DIEGEIST — Technical Specification v1.0

**A Roguelite Dungeon Crawler**
Single-File PWA • Turn-Based • Tile-Based • Procedural Generation

*Version 1.0 — February 2026*

---

## Document Overview

This specification defines the complete technical requirements for Diegeist, a roguelite dungeon crawler implemented as a single-file Progressive Web Application. The document is organized by build phase, with each phase producing a testable deliverable. Each section includes system requirements, data models where applicable, and acceptance criteria.

### Build Phases

| Phase | Name | Deliverable |
|-------|------|-------------|
| 1 | Engine Core | Tile map, camera, player movement, turn system, rendering loop |
| 2 | Dungeon Generation | BSP rooms, corridors, floor types, boss rooms, special rooms |
| 3 | Combat & Enemies | AI behaviors, damage calculation, stat system, FOV/LOS |
| 4 | Gear & Inventory | Item generation, rarity, equipping, belt, gear-bound skills |
| 5 | Progression & Hub | Meta-currency, hub menu, shop, stash, achievements |
| 6 | Content | All enemy types, bosses, special room mechanics, consumables |
| 7 | Polish | Audio, sprite refinement, balance pass, PWA service worker |

### Technical Constraints

- **Single HTML file:** All code, styles, sprites, and audio must be contained in a single .html file. No external assets, no build step, no bundler.
- **PWA:** Must include inline service worker registration and manifest for installability and offline play. Data URI manifest is acceptable.
- **Rendering:** HTML5 Canvas with 16x16 pixel tile sprites. Scrolling camera centered on player.
- **Audio:** Procedural audio via Web Audio API. No audio file assets.
- **Persistence:** localStorage for meta-progression data (currency, stash, achievements, unlocks).
- **Input:** Keyboard only (arrow keys/WASD + hotkeys). Touch/mobile support deferred.
- **Sprites:** 16x16 tiles, dark/grim palette. Bosses use larger sprites (32x32 or larger). Approach (programmatic canvas vs base64) to be determined via prototype in Phase 1.

---

## Phase 1: Engine Core

Establish the foundational game engine: tile map data structure, camera/viewport system, player entity, turn/energy system, and the core rendering loop. At the end of this phase, a player character should be able to move around a static test map with a scrolling camera and a working turn tick.

### 1.1 Tile Map

The game world is represented as a 2D grid of tiles. Each tile has a type that determines its visual appearance and whether it blocks movement or line of sight.

#### Tile Types

| Type ID | Name | Walkable | Blocks LOS | Notes |
|---------|------|----------|------------|-------|
| 0 | Wall | No | Yes | Default solid tile |
| 1 | Floor | Yes | No | Standard walkable ground |
| 2 | Corridor | Yes | No | Visually distinct from room floor |
| 3 | Door | Yes | No | Connects rooms to corridors |
| 4 | Stairs Down | Yes | No | Triggers floor transition when activated |
| 5 | Water/Hazard | Conditional | No | May slow or damage; context-dependent |
| 6 | Trap | Yes | No | Hidden until triggered or detected |

#### Map Data Structure

**Map object:** A Map contains a 2D array of tile IDs, a width, a height, a list of Room objects (for generation metadata), and a list of Entity spawn points. The map should also track which tiles have been explored (for fog of war) and which tiles are currently visible (for LOS).

**Coordinate system:** Origin (0,0) is top-left. X increases right, Y increases down. All positions are integer tile coordinates.

#### Map Size

Consistent total size across all floors. Exact dimensions to be determined during Phase 2 prototyping, but target approximately 50x50 to 80x80 tiles. The map must be large enough to feel explorable but not so large that floors feel empty. The camera viewport will show a small portion of the total map at any time.

### 1.2 Camera & Viewport

The camera follows the player and renders only the visible portion of the map to the canvas.

#### Requirements

- Camera is always centered on the player tile
- Viewport size is determined by canvas dimensions divided by tile size (16px)
- Camera clamps to map edges (no rendering beyond map bounds)
- Tight, zoomed-in feel: the viewport should show a relatively small portion of the total floor, creating a claustrophobic atmosphere
- Smooth pixel-level camera movement is optional but desirable (lerp toward target position)
- Canvas should fill the available browser viewport, minus space for HUD/message log

### 1.3 Rendering Pipeline

The renderer draws the visible portion of the map each frame. Even though the game is turn-based, the renderer should run on requestAnimationFrame to support smooth camera movement and future animation.

#### Render Order (back to front)

1. Floor tiles (only explored tiles; unexplored = black)
2. Explored but not currently visible tiles (dimmed/greyed overlay)
3. Currently visible tiles (full brightness)
4. Items on ground (within LOS)
5. Entities/enemies (only if within LOS)
6. Player character
7. UI overlays (damage numbers, status indicators)

#### Sprite System

Each entity and tile type maps to a sprite. Sprites are 16x16 pixels for standard tiles and entities. Bosses and mini-bosses use 32x32 or larger sprites. The sprite system should support a simple sprite registry that maps string keys to rendering functions or image data.

Two approaches will be prototyped in this phase to determine which produces a better result for the game's dark/grim aesthetic:

- **Programmatic:** Sprites drawn via canvas pixel manipulation at build time and cached to offscreen canvases. Maximum flexibility, easy to tweak.
- **Base64:** Pre-rendered sprite sheet encoded as a base64 data URI. Higher visual fidelity, but harder to modify.

### 1.4 Player Entity

The player is an entity on the map with a position, stats, inventory, and equipped gear. In this phase, only position and basic movement are required.

#### Player Data Structure

- **position:** { x, y } in tile coordinates
- **class:** One of Fighter, Archer, Mage (affects base stats and attack behavior)
- **stats:** STR, DEX, CON, INT, WIS, LCK (see Stats section)
- **hp / maxHp:** Current and maximum hit points
- **energy:** Current energy for turn system
- **speed:** Energy gained per tick (derived from DEX + gear)
- **equipment:** 7 gear slots (see Phase 4)
- **inventory:** 12-slot backpack array
- **belt:** 3-slot quick-access consumable array

### 1.5 Turn System (Energy/Tick Model)

The game uses an energy-based turn system. Every entity (player and enemies) has a speed stat that determines how much energy they accumulate each tick. When an entity's energy reaches a threshold, they take a turn. This allows some entities to act faster or slower than the player.

#### Algorithm

- Each game tick, every entity gains energy equal to their speed stat
- When an entity's energy reaches or exceeds the threshold (e.g., 100), they take a turn and their energy is reduced by the threshold amount
- If multiple entities reach the threshold on the same tick, resolve in order of excess energy (highest first), with ties broken by a priority value or randomly
- The player's turn pauses the tick loop and waits for input
- After the player acts, ticking resumes until the player's next turn
- A "wait" action consumes the player's turn without moving

#### Speed Reference

| Entity | Speed | Effective Turns |
|--------|-------|-----------------|
| Slow enemy (slime) | 50 | Acts every other player turn (approx) |
| Normal enemy | 100 | Acts 1:1 with player |
| Player (base) | 100 | Standard |
| Fast enemy (bat) | 150 | Acts ~1.5x per player turn |
| Very fast enemy | 200 | Acts ~2x per player turn |

Exact values are tuning parameters. The threshold and speed values should be defined as constants for easy adjustment.

### 1.6 Input Handling

#### Key Bindings

| Action | Keys | Context |
|--------|------|---------|
| Move up | ArrowUp / W | Gameplay |
| Move down | ArrowDown / S | Gameplay |
| Move left | ArrowLeft / A | Gameplay |
| Move right | ArrowRight / D | Gameplay |
| Wait (skip turn) | Space / Numpad5 / Period | Gameplay |
| Pick up item | G | Gameplay (standing on item) |
| Descend stairs | > (Shift+Period) | Gameplay (standing on stairs, boss room cleared) |
| Open inventory | I / Tab | Gameplay (toggles overlay) |
| Belt slot 1/2/3 | 1 / 2 / 3 | Gameplay (use consumable) |
| Use gear skill | Q / E / R | Gameplay (TBD mapping in Phase 4) |
| Close overlay | Escape | Any overlay screen |

### 1.7 HUD & Message Log

The HUD displays critical player information below or overlaid on the game canvas. The message log shows recent game events (damage dealt, items found, etc.).

#### HUD Elements

- HP bar (current/max, color-coded)
- Floor number
- Belt slots (3 consumable indicators)
- Minimap (small overlay showing explored areas, player position; enemies shown only in LOS)
- Active gear skill cooldowns

#### Message Log

- Scrolling text log, 3-4 visible lines
- Most recent message highlighted
- Older messages fade
- Messages include: damage dealt/received, item pickups, enemy deaths, status effects, floor transitions

### 1.8 Phase 1 Acceptance Criteria

- [ ] Canvas renders a static tile map with wall and floor tiles using 16x16 sprites
- [ ] Camera scrolls smoothly, centered on player, clamped to map edges
- [ ] Player moves on the grid via arrow keys/WASD, one tile per input
- [ ] Turn system ticks correctly: player acts, then all entities accumulate energy and act in order
- [ ] At least one test NPC entity moves on its own turn (simple random walk) to validate the energy system
- [ ] HUD displays player HP and floor number
- [ ] Message log displays movement and basic events
- [ ] Sprite rendering approach prototyped (programmatic and/or base64) with at least player, wall, and floor sprites
- [ ] Canvas fills viewport responsively

---

## Phase 2: Dungeon Generation

Implement procedural dungeon generation that creates varied, interesting floor layouts. Each floor should feel different while maintaining consistent total size. The generator must place rooms, corridors, special rooms, and the boss room with guaranteed connectivity.

### 2.1 Generation Algorithm

Use Binary Space Partition (BSP) as the primary generation strategy, with modifications to support different floor archetypes. The BSP approach recursively splits the map into regions, places rooms within regions, and connects them with corridors.

#### Floor Archetypes

| Archetype | Description | BSP Tuning |
|-----------|-------------|------------|
| Corridor-heavy | Many small rooms connected by long, winding corridors | Deep BSP splits, small room size range, allow extra corridor branching |
| Cavernous | Large open areas with irregular shapes | Shallow BSP splits, large room size range, cellular automata post-processing for organic shapes |
| Hybrid | Mix of rooms and corridors with moderate density | Standard BSP parameters, balanced room sizes |

Each floor randomly selects an archetype. The archetype selection can be weighted (e.g., early floors more corridor-heavy, deeper floors more cavernous) or purely random.

### 2.2 Room Placement

#### Standard Rooms

- Placed within BSP leaf nodes
- Minimum room size: 4x4 tiles (interior)
- Maximum room size: varies by archetype
- Rooms must not overlap
- Each room tracks its bounds, center point, and type

#### Special Rooms

After standard room generation, some rooms are designated as special. Each floor should have 1-3 special rooms depending on floor size.

| Room Type | Spawn Chance | Description | Identification |
|-----------|-------------|-------------|----------------|
| Treasure | Common | Contains a guarded chest. 1-2 strong enemies spawn when chest is interacted with. Chest contains gear 1 rarity tier above floor average. | Distinct floor tile pattern or glow effect |
| Trap | Common | Contains environmental hazards (spike tiles, poison gas tiles). Reward chest appears after navigating or clearing hazards. | Warning symbols on floor |
| Shop | Uncommon | Mid-run vendor NPC. Sells consumables and gear for gold collected during the run. 4-6 items available. | Vendor NPC sprite, carpet/rug floor tiles |
| Shrine | Uncommon | Offers a choice of 1 of 3 blessings for the current run. Blessings are temporary buffs that last until run end or death. | Altar sprite in room center, unique floor |
| Rest | Rare | Heals player for a percentage of max HP. Optional: spend gold to reroll one piece of equipped gear. | Campfire sprite, warm-toned floor |
| Challenge | Rare | Locked room. Entering triggers a wave encounter. Room seals until all enemies are defeated. Reward is high-tier loot. | Sealed door, arena-style open room |

#### Boss Room

Every floor has exactly one boss room. The boss room is always the last room before the stairs. The stairs are locked until the boss room is cleared.

- Boss room should be larger than standard rooms (minimum 8x8 interior)
- Boss room has a single entrance
- Stairs tile is placed inside the boss room, initially inactive/locked
- On floors 1, 2, 4, 5, 7, 8: boss room contains 2-4 elite enemies (stat-boosted versions of floor enemies)
- On floors 3, 6, 9: boss room contains a mini-boss entity
- On floor 10: boss room contains the final boss (randomly selected from pool)
- When all enemies in the boss room are defeated, stairs activate and become usable

### 2.3 Corridor Generation

- Corridors connect BSP sibling rooms (guaranteed connectivity)
- Corridors are 1-2 tiles wide
- L-shaped or Z-shaped corridors for variety
- Doors placed at room-corridor junctions
- Optional: extra corridors between non-sibling rooms for loops (prevents overly linear layouts)

### 2.4 Entity Spawning

After map generation, enemies and items are spawned into rooms.

- Player spawns in a designated start room (furthest from boss room)
- Enemies spawn in non-special, non-boss rooms; count scales with floor number
- Enemy types are drawn from the floor's enemy pool (see Phase 6)
- Ground loot (gold, consumables) spawns in corridors and rooms
- Loot density and quality influenced by player LCK stat

### 2.5 Phase 2 Acceptance Criteria

- [ ] Dungeon generator produces a connected floor for all three archetypes
- [ ] Player can walk from start room to boss room on every generated floor (connectivity guaranteed)
- [ ] Special rooms spawn with correct frequency and are visually identifiable
- [ ] Boss room is present on every floor with locked stairs
- [ ] Floors feel varied between runs (different layouts, room placements)
- [ ] No orphaned rooms or unreachable areas
- [ ] Minimap correctly reveals explored areas as player moves through the floor
- [ ] Floor generation completes in under 100ms

---

## Phase 3: Combat & Enemies

Implement the combat system, enemy AI, stat calculations, field of view, and damage resolution. This phase makes the game playable as a tactical experience.

### 3.1 Stats System

Six core stats govern all combat and progression mechanics. Each class has base stats and stat affinities. Soft gating means every class benefits from every stat, but with diminishing returns outside their affinity.

#### Stat Definitions

| Stat | Primary Effect | Secondary Effect | Affinity |
|------|---------------|-----------------|----------|
| STR | Melee damage multiplier | Carry capacity (inventory size bonus?) | Fighter |
| DEX | Ranged physical damage multiplier | Dodge chance, speed/energy gain | Archer |
| CON | Max HP | HP regen per floor / per N turns | Fighter |
| INT | Magic damage multiplier | Spell potency (effect magnitude) | Mage |
| WIS | Mana/energy pool (for spells if added later) | Magic resistance | Mage |
| LCK | Crit chance | Loot quality, rare room spawn chance | Archer |

#### Base Stats by Class

| Stat | Fighter | Archer | Mage |
|------|---------|--------|------|
| STR | 8 | 4 | 3 |
| DEX | 5 | 8 | 4 |
| CON | 7 | 5 | 4 |
| INT | 2 | 3 | 8 |
| WIS | 3 | 4 | 7 |
| LCK | 5 | 6 | 4 |
| Base HP | ~15 | ~10 | ~10 |

These are rough starting values. All stats can be modified by gear, shrine blessings, and meta-progression permanent bonuses.

#### Soft Gating

Stats outside a class's affinity provide reduced benefit. Suggested implementation: affinity stats scale at 100% effectiveness; non-affinity stats scale at 60-70% effectiveness. For example, a Fighter with 10 INT would calculate magic damage as if they had 6-7 INT. This discourages but does not prevent off-class builds.

### 3.2 Damage Calculation

#### Basic Attack Formula

`Damage = BaseDamage * (RelevantStat / StatDivisor) * WeaponMultiplier - TargetDefense`

- **Fighter melee:** BaseDamage scaled by STR, weapon in main hand
- **Archer ranged:** BaseDamage scaled by DEX, weapon in main hand, requires LOS to target
- **Mage ranged:** BaseDamage scaled by INT, weapon in main hand, requires LOS to target
- **Crit:** LCK determines crit chance (e.g., LCK * 1.5 = crit %). Crits deal 2-3x damage.
- **Dodge:** DEX determines dodge chance for the defender. Dodged attacks deal 0 damage.
- **Magic resist:** WIS reduces incoming magic damage.
- **Minimum damage:** Always at least 1 (prevents zero-damage stalemates).

### 3.3 Attack Ranges

| Class | Base Range | Pattern | Growth |
|-------|-----------|---------|--------|
| Fighter | 1 tile (adjacent) | Single target, 4-directional or 8-directional | Cleave (hit 3 tiles in arc), extended range via weapons |
| Archer | 6+ tiles, line of sight | Single target, projectile stops on first entity hit | Pierce (pass through first target), multishot (hit multiple targets) |
| Mage | 5+ tiles, line of sight | Single target, magic missile | AoE spells, chain lightning, freeze, etc. via gear |

### 3.4 Field of View (FOV) / Line of Sight (LOS)

Implement recursive shadowcasting for field of view calculation. FOV determines which tiles the player can currently see. Previously seen tiles remain on the minimap but are dimmed.

#### Requirements

- FOV radius: ~8-10 tiles (tunable, could be affected by gear or WIS)
- Walls and doors block LOS
- Enemies are only visible (and targetable) within the player's FOV
- Enemy AI similarly uses LOS to detect the player (enemies don't have perfect map knowledge)
- FOV recalculated every time the player moves or a door opens
- Explored tiles tracked per-floor in the map's explored array

### 3.5 Enemy AI

Enemies have behavior types that determine how they act on their turn. Each enemy type has a primary behavior and may have secondary behaviors or special abilities.

#### Behavior Types

| Behavior | Description | Pathfinding |
|----------|-------------|-------------|
| Melee Rushdown | Moves toward player via shortest path. Attacks when adjacent. | A* or BFS to player position |
| Ranged Kiting | Maintains preferred distance from player (3-5 tiles). Attacks at range. Retreats if player gets too close. | Pathfind away from player if too close, toward if too far |
| Summoner | Stays at distance. Periodically spawns minion entities. Attacks at range if no summon available. | Pathfind away from player; summon cooldown |
| Patrol | Follows a set path until player enters LOS, then switches to rushdown or kiting. | Predefined waypoints, switch on detection |
| Ambush | Stationary and hidden (not rendered) until player is within 2 tiles. Then attacks. | No movement until triggered, then rushdown |

#### AI Decision Loop (per enemy turn)

1. Check if player is in LOS
2. If yes: execute primary behavior (attack, kite, summon, etc.)
3. If no: wander randomly or patrol, or move toward last known player position
4. If hurt below threshold: consider fleeing (optional, behavior-dependent)

### 3.6 Phase 3 Acceptance Criteria

- [ ] Player can attack enemies and deal damage based on class and stats
- [ ] Enemies attack the player and deal damage
- [ ] Melee, ranged physical, and ranged magic attacks all function correctly with appropriate range
- [ ] FOV/LOS renders correctly: unexplored tiles are dark, explored tiles are dimmed, visible tiles are fully lit
- [ ] Enemies only detect and engage the player when in their LOS
- [ ] At least 3 enemy behavior types are functional (rushdown, kiting, summoner)
- [ ] Energy/tick system correctly handles fast and slow enemies (fast enemies get more turns)
- [ ] Damage calculation accounts for stats, weapon, defense, crits, and dodge
- [ ] Player can die (HP reaches 0)
- [ ] Killing all enemies in the boss room unlocks the stairs

---

## Phase 4: Gear & Inventory

Implement the complete item system: gear generation with rarity tiers, the equipment and inventory UI, consumables, the belt quick-access system, and gear-bound skills with per-drop cooldowns.

### 4.1 Item Data Structure

Every item in the game shares a base data structure with type-specific extensions.

#### Base Item Properties

- **id:** Unique string identifier
- **name:** Display name (e.g., "Iron Greataxe", "Minor Health Potion")
- **type:** One of: weapon, head, torso, legs, accessory, consumable
- **rarity:** Common, Uncommon, Rare, Epic, or Legendary
- **floorLevel:** The floor this item was generated for (affects base stats)
- **description:** Flavor text
- **sprite:** Sprite key for rendering

#### Gear-Specific Properties

- **slot:** Which equipment slot this item occupies
- **statBonuses:** Object mapping stat names to bonus values (e.g., { STR: +2, CON: +1 })
- **skill:** Optional. The skill this gear grants when equipped. Includes skill name, description, effect, range, area of effect, and cooldown (in turns).
- **classRestriction:** Optional. If set, only this class can equip the item. Most items should be unrestricted for build flexibility.

#### Consumable-Specific Properties

- **effect:** What the consumable does (heal, buff, damage, reveal map, etc.)
- **magnitude:** Strength of the effect
- **stackable:** Whether identical consumables stack in inventory

### 4.2 Rarity System

| Rarity | Color | Stat Range | Skill Chance | Cooldown Range | Drop Weight |
|--------|-------|-----------|-------------|----------------|-------------|
| Common | White/Grey | Low | ~10% | Long (6-8 turns) | High |
| Uncommon | Green | Low-Mid | ~30% | Medium-Long (5-7) | Medium |
| Rare | Blue | Mid-High | ~60% | Medium (4-6) | Low |
| Epic | Purple | High | ~90% | Short-Medium (3-5) | Very Low |
| Legendary | Gold | Highest | 100% | Short (2-3) | Floor 10 boss only |

Drop weights are further modified by the player's LCK stat and floor depth. Higher floors have a higher chance of dropping better rarity items.

### 4.3 Gear-Bound Skills

Skills are not learned by the player directly. Instead, certain gear pieces grant a skill when equipped. Unequipping the gear removes the skill. This makes gear decisions more interesting: a weapon with lower stats but a great skill may be preferable.

#### Skill Properties

- **name:** Display name (e.g., "Cleave", "Multishot", "Fireball")
- **description:** What it does
- **cooldown:** Turns between uses. Varies per individual item drop, even for the same skill name. A Rare axe might have Cleave on a 5-turn cooldown while an Epic axe has it on a 3-turn cooldown.
- **range:** How far the skill reaches
- **area:** Shape and size of effect area (single target, cone, line, circle, etc.)
- **damage/effect:** What happens when used
- **statScaling:** Which stat(s) amplify the skill's effect

#### Example Skills

| Skill | Class Affinity | Description | Typical Gear |
|-------|---------------|-------------|-------------|
| Cleave | Fighter | Hit all enemies in a 3-tile arc adjacent to player | Greataxes, greatswords |
| Shield Bash | Fighter | Stun adjacent enemy for 1 turn | Shields |
| Power Shot | Archer | Piercing shot that passes through first target | Longbows |
| Multishot | Archer | Fire at 2-3 targets simultaneously | Crossbows |
| Fireball | Mage | AoE explosion at target tile (3x3 area) | Fire staves |
| Chain Lightning | Mage | Hits target, then jumps to 1-2 nearby enemies | Lightning wands |
| Frost Nova | Mage | AoE around caster, slows all enemies hit | Ice staves |

### 4.4 Equipment Slots

| Slot | Accepts | Notes |
|------|---------|-------|
| Head | Helmets, hoods, crowns | Usually defensive stats |
| Torso | Chest armor, robes | Primary armor slot, highest stat budgets |
| Legs | Greaves, pants, boots | Often provides speed or dodge bonuses |
| Left Hand | Weapons, shields, orbs | Main hand for most, off-hand for dual-wield |
| Right Hand | Weapons, shields, orbs | Complementary to left hand |
| Accessory 1 | Rings, amulets, charms | Often provides LCK, special effects |
| Accessory 2 | Rings, amulets, charms | Same as above |

### 4.5 Inventory & Belt

#### Backpack

- 12 slots total
- Holds unequipped gear and consumables
- When full, player must drop or use items to make room
- Items on the ground can be picked up with G key (if backpack has space)
- Inventory screen (I/Tab) shows all slots, allows equip/unequip/drop/use actions

#### Belt

- 3 quick-access slots
- Only consumables can be assigned to belt slots
- Consumables are moved from backpack to belt via inventory screen
- Belt items used via hotkeys 1, 2, 3 during gameplay without opening inventory
- Using a belt consumable consumes the player's turn

### 4.6 Item Generation

Items are procedurally generated when dropped or placed. The generator uses the current floor depth, the player's LCK stat, and the context (normal drop, chest, boss, shop) to determine rarity and stats.

#### Generation Steps

1. Determine item type (weapon, armor, consumable) based on drop context
2. Roll rarity based on floor depth, LCK, and context weights
3. Select a base item template for the type and slot
4. Roll stat bonuses within the rarity's range, scaled to floor depth
5. Roll for skill attachment based on rarity's skill chance
6. If skill: select from pool appropriate to item type, roll cooldown within rarity's range
7. Generate a procedural name (prefix + base + suffix pattern, e.g., "Blessed Iron Greataxe of Cleaving")

### 4.7 Phase 4 Acceptance Criteria

- [ ] Items drop from enemies and spawn in chests/on ground
- [ ] Items have correct rarity distribution affected by floor depth and LCK
- [ ] Player can pick up, equip, unequip, and drop items
- [ ] All 7 equipment slots function correctly
- [ ] Equipped gear modifies player stats visibly in the HUD
- [ ] Gear-bound skills appear when gear is equipped and disappear when unequipped
- [ ] Skills activate on hotkey press, respect cooldown timers, and produce correct effects
- [ ] Belt allows quick-use of consumables via hotkeys 1-3
- [ ] Inventory is limited to 12 slots; player cannot pick up items when full
- [ ] Item generation produces varied, appropriate items for the floor depth

---

## Phase 5: Progression & Hub

Implement the meta-progression loop: the hub menu, persistent currency, the between-run shop, the item stash, and the achievement system. This is what makes the game a roguelite rather than a roguelike.

### 5.1 Meta-Currency

- **Name:** TBD (e.g., "Soul Shards", "Echoes", "Dread Marks") — should fit the dark/grim aesthetic
- **Earned:** During runs. Sources: enemy kills, floor completion, boss kills, challenge room clears. Amount scales with floor depth.
- **Retained:** 100% kept on death and on victory. This is the primary persistent reward.
- **Spent:** In the hub shop between runs.
- **Storage:** Persisted to localStorage as part of the save data object.

### 5.2 Hub Menu

The hub is a menu-based interface displayed between runs. It should have strong visual direction consistent with the game's dark/grim aesthetic but does not need to be an explorable space.

#### Hub Screens

| Screen | Description | Actions |
|--------|-------------|---------|
| Main Menu | Central hub screen showing currency balance, last run summary | Navigate to sub-screens, start run |
| Class Select | Choose Fighter, Archer, or Mage for next run | Select class, view base stats, confirm |
| Shop | Randomized inventory of upgrades and items | Browse, purchase with meta-currency |
| Stash | View and manage persistent item collection | View items, select 1 item to bring into next run |
| Achievements | View unlocked and locked achievements with descriptions | View progress, see active bonuses |
| Settings | Audio volume, key rebinding (stretch goal) | Adjust settings |

### 5.3 Between-Run Shop

The shop offers a randomized selection of purchases each time the player returns to the hub. Inventory re-rolls on each visit (after each run).

#### Shop Item Categories

| Category | Description | Examples | Persistence |
|----------|-------------|----------|-------------|
| Permanent Stat Bumps | +1 to a stat, stacking, increasingly expensive | +1 STR (50 shards), +1 STR again (100 shards) | Permanent, all future runs |
| Starting Gear | Begin next run with a specific item equipped | Common sword (30), Uncommon helmet (80) | Consumed on next run start |
| Consumable Packs | Start next run with consumables in belt | 3x Health Potions (40), 1x Scroll of Mapping (60) | Consumed on next run start |
| Passive Perks | Permanent unlockable modifiers | Potions heal 20% more, +1 belt slot, show traps on minimap | Permanent once purchased |

Shop inventory should contain 4-6 items per visit, drawn randomly from the available pool. Items already purchased (for permanent types) are excluded from future rolls.

### 5.4 Item Stash

#### Stash Rules

- ~30 slot persistent storage in the hub
- On death: player selects 1 item from their current inventory/equipment to save to stash
- On victory (beat floor 10 boss): player returns with full inventory, can stash anything
- Before starting a run: player can pull exactly 1 item from stash to bring along
- Stash persists across all runs indefinitely (saved to localStorage)
- If stash is full, player must discard an item to make room
- Legendary items (floor 10 boss drops) are primarily stash trophies but can be brought into runs

### 5.5 Achievement System

Achievements track player milestones and provide permanent passive bonuses when unlocked. Achievements persist in localStorage.

#### Example Achievements

| Achievement | Condition | Bonus |
|-------------|-----------|-------|
| Rat Slayer | Kill 50 rats across all runs | +5% damage to floor 1-2 enemies |
| Sharpshooter | Land 100 critical hits as Archer | +2% base crit chance for Archer |
| Arcane Mastery | Deal 1000 total magic damage | +1 base INT for Mage |
| Ironclad | Complete a run taking less than 50 total damage as Fighter | +1 base CON for Fighter |
| Descent | Reach floor 5 for the first time | Unlock Scroll of Mapping in shop |
| Deep Dweller | Reach floor 10 for the first time | Unlock Rare starting gear in shop |
| Vanquisher | Defeat the floor 10 boss | Unlock new shop tier |
| Collector | Have 15 items in stash simultaneously | +1 stash slot |

The full achievement list will be defined in Phase 6. The system should support easy addition of new achievements via a data-driven configuration.

### 5.6 Save Data Model

All persistent data is stored in a single localStorage key as a JSON object.

#### Save Data Structure

- **currency:** Number — current meta-currency balance
- **stash:** Array of Item objects (max ~30)
- **achievements:** Object mapping achievement IDs to { unlocked: bool, progress: number }
- **shopPurchases:** Array of purchased permanent upgrade IDs
- **permanentStats:** Object mapping stat names to permanent bonus values
- **permanentPerks:** Array of unlocked perk IDs
- **runHistory:** Array of run summary objects (class, floors reached, cause of death, currency earned)
- **settings:** Audio volume, any user preferences

### 5.7 Phase 5 Acceptance Criteria

- [ ] Hub menu displays correctly with all sub-screens accessible
- [ ] Meta-currency accumulates during runs and persists between runs
- [ ] Shop displays randomized inventory and allows purchases
- [ ] Purchased permanent upgrades apply to all future runs
- [ ] Stash allows saving 1 item on death and pulling 1 item before a run
- [ ] Achievements track progress and unlock bonuses when conditions are met
- [ ] All persistent data survives browser refresh (localStorage)
- [ ] Class selection screen shows base stats including any permanent bonuses
- [ ] Run summary displays on return to hub (floors reached, enemies killed, currency earned)

---

## Phase 6: Content

Populate the game with all enemy types, boss encounters, special room mechanics, consumable items, shrine blessings, and the full item pool. This phase turns the engine into a complete game.

### 6.1 Enemy Roster

#### Floors 1-2: The Warrens

| Enemy | Speed | Behavior | HP | Damage | Special |
|-------|-------|----------|-----|--------|---------|
| Rat | 100 | Rushdown | Low | ~1 (crit ~3) | None — basic enemy |
| Bat | 150 | Rushdown (erratic) | Very Low | ~1 | Fast, moves erratically (random adjacent tile bias) |
| Slime | 50 | Rushdown (slow) | Medium | ~2 | Slow but tanky, may split into 2 smaller slimes on death |

#### Floors 4-5: The Catacombs

| Enemy | Speed | Behavior | HP | Damage | Special |
|-------|-------|----------|-----|--------|---------|
| Skeleton | 100 | Rushdown | Medium | Scaled | Straightforward melee |
| Skeleton Archer | 100 | Kiting | Low-Med | Scaled | Maintains 4-5 tile distance, ranged attack |
| Shade | 120 | Ambush | Low | High | Invisible until within 2 tiles, first strike bonus damage |

#### Floors 7-8: The Sanctum

| Enemy | Speed | Behavior | HP | Damage | Special |
|-------|-------|----------|-----|--------|---------|
| Wraith | 120 | Kiting | Medium | Scaled (magic) | Ranged magic attack, partially ignores armor |
| Dark Knight | 80 | Rushdown | High | High | Slow but hard-hitting, high defense |
| Necromancer | 100 | Summoner | Low-Med | Scaled | Summons 1-2 skeleton minions every 4-5 turns |

### 6.2 Boss Encounters

#### Floor 3 — The Broodmother

- **Theme:** Giant spider/rat queen. Teaches priority targeting.
- **Sprite:** 32x32 or larger
- **HP:** High (roughly 8-10x a floor 3 normal enemy)
- **Speed:** 80 (slow)
- **Behavior:** Primarily stationary or slow-moving. Periodically spawns 2-3 broodlings (weak, fast enemies). Melee bite attack if player is adjacent (high damage).
- **Skill check:** Player must manage spawned adds while dealing damage to the boss. Ignoring adds leads to being overwhelmed.

#### Floor 6 — The Hollow Knight

- **Theme:** Armored revenant. Teaches patience and positioning.
- **Sprite:** 32x32 or larger
- **HP:** Very High
- **Speed:** 100
- **Behavior:** High base defense (reduces most damage significantly). Has a telegraphed heavy attack: spends 1 turn "charging" (visual indicator), then strikes on the next turn for massive damage in a line or cone. Player must move out of the telegraph zone.
- **Skill check:** Recognize telegraph patterns and reposition. Sustained damage is key; burst is less effective due to high defense.

#### Floor 9 — The Archlich

- **Theme:** Undead sorcerer. Teaches resource management and aggression.
- **Sprite:** 32x32 or larger
- **HP:** High
- **Speed:** 100
- **Behavior:** Summons undead every 3-4 turns. Casts AoE frost nova (damages and slows in radius around self). Ranged magic attack. If left alone too long, summon count increases.
- **Skill check:** Aggressive play rewarded. Must burn down the Archlich quickly before summons overwhelm. Resource management (consumables, skill cooldowns) is critical.

#### Floor 10 — Final Boss (Random from Pool)

One of three final bosses is randomly selected per run. Each has distinct mechanics requiring different strategies.

| Boss | Theme | Key Mechanic | Skill Check |
|------|-------|-------------|-------------|
| The Demon Lord | Aggressive, high damage, charges | Charges across the room in a straight line. High melee damage. Enrages at low HP (faster, harder hits). | Positioning, dodging charges, kiting |
| The Eldritch Horror | Unpredictable, warps terrain | Randomly transforms floor tiles into hazards. Tentacle attacks from unexpected angles. Phase shifts (teleports). | Adaptability, spatial awareness |
| The Fallen God | Phases, heals, endurance | Three phases with different attack patterns. Heals between phases. Final phase is most aggressive. | Endurance, resource conservation across phases |

### 6.3 Special Room Mechanics (Detailed)

#### Treasure Room

- Contains 1 chest in the center of the room
- Interacting with the chest spawns 1-2 guardian enemies (elite tier for the floor)
- Chest cannot be looted until guardians are defeated
- Chest contains 1 gear item at rarity +1 above floor average, plus gold

#### Trap Room

- Room contains hazard tiles: spike traps (damage on step), poison gas (DoT while in area), pressure plates (trigger projectiles from walls)
- Navigating to the far side of the room (or clearing all traps if possible) reveals a reward chest
- Traps are visible if player has high enough LCK or has the "Show Traps" perk
- Reward: consumables and gold

#### Mid-Run Shop

- Vendor NPC is present in the room (non-hostile)
- Sells 4-6 items: mix of gear and consumables appropriate to current floor
- Prices are in run gold (not meta-currency)
- Inventory is generated on room creation and does not refresh

#### Shrine

- Altar in center of room
- Interacting presents 3 randomly selected blessings
- Player chooses 1; the other 2 are lost
- Blessings last until end of run or death
- **Example blessings:** +20% damage, +3 FOV radius, regenerate 1 HP every 15 turns, +15% crit chance, enemies drop double gold, +2 speed

#### Rest Room

- Campfire in room center
- Interacting heals player for 30-50% of max HP (one-time use per room)
- Optional: spend gold to reroll one piece of equipped gear (same slot, re-generated at current floor depth)

#### Challenge Room

- Room has a sealed entrance (special door tile)
- Entering triggers a wave encounter: 2-3 waves of enemies, increasing difficulty
- Room is sealed until all waves are defeated; player cannot leave
- Reward: 1-2 high-rarity items + significant gold + meta-currency bonus

### 6.4 Consumable Items

| Consumable | Effect | Rarity | Notes |
|------------|--------|--------|-------|
| Health Potion (Minor) | Restore 25% max HP | Common | Bread and butter healing |
| Health Potion (Major) | Restore 60% max HP | Uncommon | Found on deeper floors |
| Scroll of Mapping | Reveal entire floor map | Uncommon | Does not reveal enemies |
| Scroll of Identify | Reveal all stats of a gear item | Common | Useful if gear stats are hidden until identified (optional mechanic) |
| Bomb | Deal AoE damage in 3x3 area | Uncommon | Thrown at target tile |
| Speed Potion | Double speed for 10 turns | Rare | Powerful tactical tool |
| Invisibility Potion | Enemies cannot detect player for 8 turns | Rare | Broken by attacking |
| Scroll of Teleportation | Teleport to random explored room | Rare | Emergency escape |

### 6.5 Phase 6 Acceptance Criteria

- [ ] All enemy types from all floor tiers are implemented with correct behaviors
- [ ] All 3 mini-bosses have unique mechanics and are beatable with skill
- [ ] All 3 final bosses are implemented with distinct mechanics
- [ ] Random final boss selection works correctly per run
- [ ] All 6 special room types function as specified
- [ ] All consumable types are implemented and usable
- [ ] Shrine blessings apply correctly and persist through the run
- [ ] Mid-run shops sell appropriate items at fair prices
- [ ] Enemy and item variety makes each run feel different
- [ ] Game is completable: a skilled player can reach and defeat the floor 10 boss

---

## Phase 7: Polish

Final polish pass: procedural audio, sprite refinement, game balance, visual effects, quality of life features, and full PWA setup with offline support.

### 7.1 Procedural Audio

All audio is generated via the Web Audio API using oscillators, noise generators, and envelope shaping. No audio file assets.

#### Sound Design

| Sound | Approach | Trigger |
|-------|----------|---------|
| Footstep | Short noise burst, low-pass filtered | Each player move |
| Melee hit | Quick noise + sine sweep down | Melee attack connects |
| Ranged shot | High-freq sine chirp | Ranged attack fired |
| Magic cast | Resonant sine chord + reverb | Magic attack fired |
| Enemy hit | Short noise burst, mid-freq | Enemy takes damage |
| Enemy death | Descending noise sweep | Enemy HP reaches 0 |
| Player hurt | Low sine thump + noise | Player takes damage |
| Item pickup | Ascending sine arpeggio (3-4 notes) | Item picked up |
| Level up / blessing | Major chord arpeggio | Shrine blessing chosen |
| Door open | Short mid-freq click | Door tile entered |
| Stairs descend | Descending sine sweep, reverb | Player descends stairs |
| Boss entrance | Low drone + percussion hit | Boss room entered |
| UI click | Short high sine blip | Menu interaction |

#### Ambient Audio

- Continuous low-frequency drone during dungeon exploration (subtle, atmospheric)
- Drone pitch/character shifts based on floor depth
- Boss rooms have distinct ambient tone (more ominous)
- All audio should have a global volume control saved in settings

### 7.2 Visual Polish

- **Damage numbers:** Float up from damaged entity, fade out. Color-coded (white normal, yellow crit, red player damage).
- **Attack animations:** Brief sprite flash or screen shake on hit. Projectile travel for ranged attacks (even if instant mechanically, visual should show a particle moving).
- **Death animations:** Enemy sprite flashes and fades. Optionally drops a small particle burst.
- **Status effects:** Visual indicators on affected entities (slow = blue tint, poison = green particles).
- **Fog of war:** Smooth gradient at LOS boundary rather than hard tile cutoff (optional, performance-dependent).
- **Boss telegraph:** Highlighted tiles showing incoming attack zones (red overlay).
- **Screen transitions:** Brief fade to black between floors.

### 7.3 Balance Pass

With all content in place, perform a balance tuning pass. Key tuning levers:

- Enemy HP and damage scaling per floor
- Item stat ranges per rarity tier
- Meta-currency earn rates (should feel rewarding but not trivialize the shop in 3-4 runs)
- Shop prices (permanent upgrades should require multiple runs to afford)
- Consumable effectiveness and availability
- Boss HP and damage (should be challenging but fair with floor-appropriate gear)
- Skill cooldowns (should feel impactful but not spammable)
- Crit multiplier and chance curve
- Stat soft-gating effectiveness percentage

### 7.4 Quality of Life

- **Auto-pickup gold:** Walking over gold tiles automatically collects it.
- **Tooltip system:** Hovering/examining items shows full stat comparison with currently equipped item.
- **Turn history:** Message log is scrollable to review past events.
- **Minimap toggle:** Player can toggle minimap visibility.
- **Confirmation dialogs:** Dropping rare+ items, descending stairs, using the stash.
- **Run statistics:** Track enemies killed, damage dealt, items found, turns taken per run.

### 7.5 PWA Setup

- **Service Worker:** Inline service worker registration that caches the single HTML file for offline play.
- **Manifest:** Inline data URI manifest with app name, icons (can be data URI or generated), theme color, and display: standalone.
- **Installability:** Meets all PWA install criteria so browsers offer "Add to Home Screen."
- **Offline:** Game is fully playable without network after first load.
- **Viewport:** Proper meta viewport tag for consistent rendering.

### 7.6 Phase 7 Acceptance Criteria

- [ ] All sound effects play at appropriate triggers with no audio glitches
- [ ] Ambient audio creates atmosphere and responds to game state
- [ ] Volume control works and persists in settings
- [ ] Damage numbers, attack animations, and death effects render correctly
- [ ] Boss telegraph system clearly communicates incoming attacks
- [ ] Game balance allows a skilled player to complete the game within 3-5 attempts after learning mechanics
- [ ] Meta-progression feels rewarding: meaningful purchases available every 2-3 runs
- [ ] PWA installs correctly on desktop and mobile browsers
- [ ] Game works fully offline after first load
- [ ] All localStorage data persists correctly across sessions
- [ ] No performance issues: stable 60fps rendering on mid-range hardware
- [ ] Single HTML file, no external dependencies or assets

---

## Appendix: Data Model Reference

Quick reference for the core data structures used throughout the spec.

### Entity

```
id: string
type: 'player' | 'enemy' | 'npc'
position: { x: number, y: number }
stats: { STR, DEX, CON, INT, WIS, LCK }
hp: number
maxHp: number
energy: number
speed: number
behavior: BehaviorType (enemies only)
equipment: { head, torso, legs, leftHand, rightHand, accessory1, accessory2 }
inventory: Item[] (max 12)
belt: Item[] (max 3, consumables only)
activeSkills: Skill[] (derived from equipped gear)
activeBlessings: Blessing[] (from shrines, current run only)
```

### Item

```
id: string
name: string
type: 'weapon' | 'head' | 'torso' | 'legs' | 'accessory' | 'consumable'
rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
slot: EquipmentSlot (gear only)
statBonuses: { [statName]: number }
skill: Skill | null
effect: ConsumableEffect | null (consumables only)
floorLevel: number
description: string
sprite: string
```

### Skill

```
name: string
description: string
cooldown: number (turns)
currentCooldown: number
range: number
area: { type: 'single' | 'cone' | 'line' | 'circle', size: number }
damage: number
statScaling: string (stat name)
effect: SkillEffect | null
```

### Map

```
width: number
height: number
tiles: number[][] (2D array of tile type IDs)
explored: boolean[][] (fog of war tracking)
visible: boolean[][] (current LOS)
rooms: Room[]
entities: Entity[]
items: { item: Item, position: { x, y } }[]
```

### SaveData

```
currency: number
stash: Item[]
achievements: { [id]: { unlocked: boolean, progress: number } }
shopPurchases: string[]
permanentStats: { [stat]: number }
permanentPerks: string[]
runHistory: RunSummary[]
settings: { volume: number }
```

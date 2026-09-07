# Minimum Viable Town — Implementation Plan

**Goal:** make the town do something and make materials mean something, without building the full v2 spec (ten buildings, NPC roster, adjacency matrix, ranks and tiers). Seven buildings, each with one service that touches the next dungeon run, placed on the existing walkable town grid and paid for with the materials that already drop.

**Design rule:** every building must change the *dungeon* in a way the player can feel within one run. No building exists only to unlock another building.

---

## 1. Materials become spendable

- `SaveData` gains `buildings`, `blueprints`, `brewedPotions` and `preRunBlessing`. Old saves default to empty.
- Secondary materials trickle at rank 1 (10%), not only at rank 3+, so a player who keeps dying on floor 3 still sees a little stone and can afford a second building.
- The town bar shows the material totals and the town level. The build menu shows costs in the same colours.

## 2. Buildings

All footprints are 2×2 with a door tile directly below the bottom-left corner. Three are available from the start; four are unlocked by a blueprint that drops the first time a boss dies.

| Building | Source | Build | L2 | L3 | What it does |
|----------|--------|-------|----|----|--------------|
| Farm | start | 20 timber | 30 timber, 10 stone | 20 stone, 10 iron | Income per run: +4 timber / +7 timber +2 stone / +10 timber +4 stone |
| Mine | start | 20 timber | 15 timber, 15 stone | 20 stone, 10 iron | Income per run: +3 stone / +5 stone +2 iron / +7 stone +4 iron +1 crystal |
| Watchtower | start | 15 timber | 20 timber, 10 stone | 15 stone, 10 iron | The first 1 / 2 / 3 floors of a run start with a third of the map explored |
| Library | start | 20 stone, 10 iron | 15 iron, 5 crystal | 15 crystal, 5 aether | Respec all skill points for 3 aether / 2 aether / free; L3 also +10% XP |
| Forge | Brood Mother | 20 timber, 15 stone | 20 stone, 15 iron | 20 iron, 10 crystal | Work on stashed gear: Reroll stats (5 stone) / Temper +1 rarity (10 iron, 3 crystal) / Socket a new +3 stat (5 crystal, 2 aether) |
| Apothecary | Rat King | 15 timber, 10 stone | 20 stone, 10 iron | 15 iron, 10 crystal | Brew potions for the next run: Minor (3 timber, up to 3) / Major (4 stone, up to 2) / Speed or Invisibility (3 iron each) |
| Shrine | Bone Lord | 15 stone, 10 iron | 15 iron, 10 crystal | 10 crystal, 5 aether | Choose a blessing for the next run (2 aether): Vigor +15% HP, Might +10% damage, Fortune +10 crit, Haste +10 speed. L2 ×1.5, L3 ×2 |

Town level = floor(sum of building levels / 3), displayed now, a hook for ranks later.

## 3. Placement

- **B** (or the Build button in the town bar) opens the build menu: every building with its cost, whether the blueprint is owned, and whether it is affordable.
- Choosing one enters placement mode: a ghost footprint starts next to the player, arrows or swipes move it, a tap moves it to that tile, Enter or tapping the ghost confirms, Esc cancels. Valid placement is green, invalid red. Rules: all four tiles grass, the door tile walkable, nothing overlapping.
- Confirming spends the materials, stamps the tiles (`TILE.BUILDING`, `TILE.BUILDING_ENTRANCE`) and saves.
- Buildings render as a coloured block with a roof strip and their name; the door tile matches the shelter door.

## 4. Using a building

- Stand on a building's door (or tap the building to walk there) and press Enter: a service menu opens with the building's level, its current effect, its actions with costs, an Upgrade row and Leave.
- Forge: pick a stash item, then an operation. Apothecary: brew rows with a per-run cap. Shrine: blessing rows. Library: Respec row. Farm and Mine: income summary and Upgrade only.
- Income is paid in `finalizeRun()` on every run end and reported in the town notice.
- Brewed potions and the chosen blessing are consumed at run start (`applyPendingHubLoadout()`); the blessing folds into the passive effects the way tree passives do and is saved with the run.
- Watchtower reveals whole rooms until roughly a third of the walkable tiles are explored.

## 5. Blueprints

`handleEnemyDeath()` on a boss checks `saveData.blueprints`; a first kill adds the blueprint with a message. Blueprints survive death (they are written to the save immediately).

## 6. Tests

`tests/town-buildings.test.js`: definitions have costs for all three levels, placement validation (overlap, terrain, door), spending and income maths, blueprint gating, forge reroll/temper/socket on an item, respec refund, blessing application. `tests/game-floor.test.js`: watchtower reveal. `scripts/playtest.mjs`: after the run, grant materials, place a Farm by keyboard, open it, upgrade it, and check the save.

## Order of work

1. `town-buildings.js` (definitions, validation, costs, income, services) + save fields + tiles/sprites + tests.
2. Town states in `game.js` (build menu, placement, building menu) and their draw functions; building rendering; tap handling.
3. Run hooks: income, watchtower, potions, blessing, respec, blueprints, rank-1 secondary drops.
4. Playtest extension, README, CLAUDE.md.

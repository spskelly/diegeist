# DIEGEIST v2.0 — EXPANSION SPECIFICATION

**Roguelite Dungeon Crawler + Persistent Town Builder**
*Extension Specification — Built on the Diegeist v1 Engine*
*February 2026*

---

## Table of Contents

1. [Design Philosophy & Core Loop](#1-design-philosophy--core-loop)
2. [Resource System](#2-resource-system)
3. [Class Skill Trees](#3-class-skill-trees)
4. [Dungeon Rank & Modifier System](#4-dungeon-rank--modifier-system)
5. [Dungeon Tier Structure](#5-dungeon-tier-structure)
6. [Town System](#6-town-system)
7. [Building Definitions & Services](#7-building-definitions--services)
8. [NPC System](#8-npc-system)
9. [Lore & Environmental Storytelling](#9-lore--environmental-storytelling)
10. [Town Portal Mechanic](#10-town-portal-mechanic)
11. [Data Models](#11-data-models)
12. [Integration with Existing Codebase](#12-integration-with-existing-codebase)
13. [Phased Build Plan](#13-phased-build-plan)
14. [Balance Framework](#14-balance-framework)
- [Appendix A: Building Adjacency Matrix](#appendix-a-building-adjacency-matrix)
- [Appendix B: NPC Quick Reference](#appendix-b-npc-quick-reference)
- [Appendix C: Modifier Quick Reference](#appendix-c-modifier-quick-reference)
- [Appendix D: Skill Tree Quick Reference](#appendix-d-skill-tree-quick-reference)

---

## 1. Design Philosophy & Core Loop

Diegeist v2 extends the existing roguelite dungeon crawler with a persistent town-building layer. The primary inspirations are **Dark Cloud** (town building as the meta-progression, placement puzzle, NPC satisfaction system) and **Baldur's Gate: Dark Alliance** (branching class skill trees, workshop gear enhancement, recall mechanic, atmospheric environmental storytelling, satisfying character growth independent of gear).

The core design principle is **bidirectional dependency**: the dungeon feeds the town, and the town feeds the dungeon. Neither mode is cosmetic or optional; progress in one directly enables progress in the other.

### 1.1 The Core Loop

The gameplay rhythm alternates between two modes:

**Dungeon Phase:** Select a dungeon tier and rank. Optionally activate difficulty modifiers. Enter a 3-floor procedurally generated dungeon. Fight enemies, collect gear, gather materials, discover blueprints, rescue NPCs, find lore fragments, and earn XP for the class skill tree. Optionally use a Town Portal scroll to bank progress mid-run. Defeat the tier boss or die trying. Return to town.

**Town Phase:** Walk freely around the persistent town grid. Place and upgrade buildings using gathered materials and blueprints. Assign NPCs to buildings. Use building services: forge upgrades gear, apothecary brews potions, barracks hires companions, library unlocks passive skills, shrine provides blessings, tavern offers intelligence. Invest skill points in the class skill tree. Read discovered lore at the library. Select the next dungeon tier and rank.

### 1.2 Character Growth Philosophy (BG:DA Influence)

In v1, all player power comes from gear. This makes character identity feel thin — a Fighter with an Archer's bow plays almost identically to an Archer. V2 introduces a branching skill tree per class that provides permanent, meaningful power growth independent of equipment. Characters gain XP from combat and dungeon completion, level up, and invest skill points into abilities that define their playstyle.

This creates three axes of power growth: **gear** (dungeon drops + forge enhancement), **town services** (library skills, shrine blessings, apothecary potions), and **character skills** (XP-based skill tree). Each axis is sourced from the dungeon but progresses independently, giving the player multiple dimensions of advancement to pursue.

### 1.3 Design Constraints

Single HTML file PWA. All systems must work within this constraint. No external assets, no server communication. All state persisted to localStorage. Turn-based grid movement in both dungeon and town. Keyboard-only input. Procedural audio via Web Audio API. 16×16 pixel sprites rendered programmatically to canvas.

### 1.4 What Changes vs. v1

The existing Diegeist v1 engine is preserved and extended. The tile map, entity system, camera, BSP dungeon generation, A* pathfinding, energy-based turn system, combat math, stat system, FOV, enemy AI, item generation, gear-bound skills, audio system, and sprite registry all remain. New systems are additive. The Game class state machine gains new states for town navigation, building placement, dungeon selection, skill tree management, and building service UIs.

---

## 2. Resource System

Resources are the connective tissue between dungeon runs and town development. Three resource categories exist: **materials** (common, steady drip), **blueprints** (rare, milestone unlocks), and **NPCs** (rarest, high-impact).

### 2.1 Materials

Five core material types, loosely biome-aligned but not exclusive. Every dungeon run generates material income regardless of success, though death reduces the haul.

| Material | Primary Source | Secondary Sources | Primary Use |
|----------|---------------|-------------------|-------------|
| Timber | Overgrowth enemies | Floor clear bonuses | Basic buildings, farm, barracks, structural foundations |
| Stone | Burrows enemies | Floor clear bonuses | Structural upgrades, walls, watchtower, forge foundation |
| Iron | Deep Mines enemies | Mining building passive income | Forge, advanced upgrades, weapons shop, barracks upgrades |
| Crystal | Abyssal Halls enemies | Rare drops from any tier at high rank | Library, shrine, magical buildings, highest-tier upgrades |
| Aether | Boss kills only | Rank 5+ bonus drops | Unique buildings, final upgrade tiers, endgame content |

### 2.2 Material Drop Mechanics

Enemy kills have a base material drop chance of **40%**. When a material drops, the quantity is 1–2 at Rank 1, scaling by approximately **+35% per rank**. Higher ranks also introduce secondary material types: at Rank 3+ in a biome, that biome's secondary material begins appearing at a 15% rate; at Rank 5+, tertiary materials appear at 8%.

Floor clear bonuses award a fixed material bundle: 3–5 of the biome's primary material at Rank 1, scaling with rank. Boss kills always drop 2–4 Aether plus a biome-appropriate material bundle.

**On death:** The player retains **50% of materials** gathered during that run (rounded up). Blueprints found during the run are auto-saved (not subject to death penalty). Rescued NPCs found during the run ARE lost unless the player uses their one-item death save on them. On victory (tier boss defeated), all materials are retained at 100%.

### 2.3 Blueprints

Blueprints unlock building types in the town. Each building has exactly one blueprint. Blueprints are found in specific locations:

**Tier bosses:** Each tier boss drops a specific critical-path blueprint on first defeat. The Overgrowth boss drops the Mine blueprint. The Burrows boss drops the Forge blueprint. The Deep Mines boss drops the Library blueprint. The Abyssal Halls boss drops the Shrine blueprint.

**Special rooms:** Treasure rooms and challenge rooms (currently inert in v1) become blueprint sources. Each has a weighted chance to contain a blueprint from a pool appropriate to the current tier. This activates the special room types that were designated but not implemented in v1.

**High-rank bonus:** Running any tier at Rank 5+ adds a small chance (5–10%) for the tier boss to drop a non-critical-path blueprint (cosmetic buildings, advanced service buildings, unique structures).

Blueprints are one-time finds. Once discovered, a blueprint is **permanently added** to the player's collection regardless of run outcome (auto-saved, not subject to death choice). This prevents the frustration of losing a rare blueprint to death.

### 2.4 NPCs

NPCs are rescued from dungeon encounters and staff buildings in the town. Each NPC has a role, personality traits, and placement preferences. NPCs are found in two ways:

**Rescue encounters:** Special rooms (specifically the rest room and shrine room types from v1) can contain an NPC rescue event. The player finds a trapped or lost NPC and can choose to rescue them. Rescued NPCs are added to the town roster.

**Tier boss rewards:** First-time tier boss kills (alongside the blueprint) also rescue a specific NPC associated with that tier. This guarantees a steady NPC supply along the critical path.

Unlike blueprints, NPCs found during a run **ARE subject to death loss**. If the player dies, they must choose what to save: a piece of gear, a material haul, or a rescued NPC. This creates meaningful death decisions, especially when an NPC was found on a deep floor.

---

## 3. Class Skill Trees

*Inspired by Baldur's Gate: Dark Alliance's branching skill investment system.*

### 3.1 Overview

Each of the three player classes (Fighter, Archer, Mage) has a unique skill tree with 3 branches and approximately 15–18 total skills. Players earn **XP** from enemy kills and dungeon completion, level up, and receive **skill points** to invest. Skill points are permanent — they persist across runs and are never lost to death.

XP is tracked per-character-class. Starting a new run with a different class does not share XP or skill points. This encourages class mastery and gives replayability across all three classes.

### 3.2 XP and Leveling

XP is earned from enemy kills (scaled by enemy difficulty and rank), floor clears, and boss defeats. The XP curve follows a standard exponential: each level requires approximately 25% more XP than the previous level. The level cap is **20**, providing a long progression tail.

| Level Range | XP per Level (approx.) | Skill Points per Level | Cumulative Points |
|-------------|----------------------|----------------------|-------------------|
| 1–5 | 100–200 | 1 | 5 |
| 6–10 | 250–500 | 1 | 10 |
| 11–15 | 600–1200 | 1 | 15 |
| 16–20 | 1500–3000 | 2 | 25 |

Total skill points at level 20: approximately **25 points**. This is intentionally fewer than the total number of skills, forcing specialization. A player cannot max every branch; they must choose.

XP sources per kill scale with rank: base XP × (1 + (rank - 1) × 0.20). Boss kills award 10× the XP of a standard enemy. Floor clears award a flat bonus equal to approximately 5 standard enemy kills.

### 3.3 Fighter Skill Tree

**Branch: Warfare** — Offensive melee power.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Heavy Strike | 3 | Melee damage +8% per rank | None |
| 1 | Conditioning | 3 | Max HP +6% per rank | None |
| 2 | Cleave | 3 | 15%/25%/35% chance melee hits splash to one adjacent enemy | Heavy Strike 1 |
| 2 | Staggering Blow | 2 | Melee crits stun target for 1/2 turns (skip turn) | Heavy Strike 2 |
| 3 | Berserker Rage | 1 | Active: +40% damage, -20% defense for 5 turns. 15-turn cooldown | Cleave 2, Conditioning 2 |

**Branch: Bulwark** — Defensive staying power.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Iron Hide | 3 | Damage taken reduced by 3%/6%/9% | None |
| 1 | Regeneration | 3 | Passive regen: heal 1 HP every 20/15/10 turns | None |
| 2 | Shield Wall | 2 | Block chance 10%/18% (negate hit entirely) when not moving | Iron Hide 1 |
| 2 | Retaliation | 2 | When hit in melee, 20%/35% chance to counter-attack for 50% damage | Iron Hide 2 |
| 3 | Unbreakable | 1 | Survive one killing blow per floor at 1 HP. Triggers once, resets per floor. | Shield Wall 2, Regeneration 2 |

**Branch: Vanguard** — Mobility and control.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Rush | 2 | Active: move 2/3 tiles in a direction, dealing damage to first enemy hit. 8-turn cooldown. | None |
| 1 | Vigilance | 3 | +5%/10%/15% dodge chance | None |
| 2 | War Shout | 2 | Active: all enemies in FOV have speed reduced 15%/25% for 4 turns. 12-turn cooldown. | Rush 1 |
| 2 | Tactical Advance | 2 | Moving into a tile adjacent to an enemy grants +15%/25% damage on next attack | Vigilance 2 |
| 3 | Warlord | 1 | Companions deal +30% damage and gain +20% HP when hired | War Shout 1, Tactical Advance 1 |

### 3.4 Archer Skill Tree

**Branch: Marksmanship** — Ranged damage and precision.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Steady Aim | 3 | Ranged damage +8% per rank | None |
| 1 | Eagle Eye | 3 | Crit chance +5%/10%/15% | None |
| 2 | Piercing Shot | 3 | Ranged attacks have 15%/25%/35% chance to hit a second target behind the first | Steady Aim 1 |
| 2 | Lethal Focus | 2 | Crit damage multiplier +25%/50% (base is 1.5×) | Eagle Eye 2 |
| 3 | Deadeye | 1 | Active: next 3 ranged attacks auto-crit. 18-turn cooldown. | Piercing Shot 2, Lethal Focus 1 |

**Branch: Survival** — Evasion and self-sustain.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Evasion | 3 | Dodge chance +5%/10%/15% | None |
| 1 | Quick Recovery | 3 | Potion healing +10%/20%/30% | None |
| 2 | Disengage | 2 | Active: leap 2/3 tiles away from nearest enemy. 6-turn cooldown. | Evasion 1 |
| 2 | Vital Strike | 2 | Killing an enemy heals 3%/6% of max HP | Quick Recovery 1 |
| 3 | Shadow Step | 1 | Active: become invisible for 3 turns. Attacking breaks invisibility but guarantees crit. 20-turn cooldown. | Disengage 2, Vital Strike 1 |

**Branch: Trapper** — Area control and utility.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Trap Mastery | 3 | Traps deal 50%/75%/100% less damage to player. Player can disarm traps. | None |
| 1 | Scavenger | 3 | +10%/20%/30% item drop rate from enemies | None |
| 2 | Caltrops | 2 | Active: place a 3×3 area of caltrops that slow enemies by 30%/50% for 3 turns. 10-turn cooldown. | Trap Mastery 1 |
| 2 | Salvage | 2 | Can break down gear for 1/2 materials of the biome-appropriate type | Scavenger 2 |
| 3 | Ambush Predator | 1 | First attack on an unaware enemy (not yet in combat) deals 3× damage | Caltrops 1, Salvage 1 |

### 3.5 Mage Skill Tree

**Branch: Destruction** — Raw magical damage.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Arcane Power | 3 | Magic damage +8% per rank | None |
| 1 | Mana Surge | 3 | Skill cooldowns reduced by 1/1/2 turns | None |
| 2 | Chain Lightning | 3 | Magic attacks have 15%/25%/35% chance to arc to a second target for 50% damage | Arcane Power 1 |
| 2 | Overcharge | 2 | Active skills deal +20%/35% damage but cost 5% max HP per use | Mana Surge 2 |
| 3 | Meteor | 1 | Active: deal massive damage to a 3×3 area. 25-turn cooldown. | Chain Lightning 2, Overcharge 1 |

**Branch: Warding** — Protection and mitigation.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Arcane Barrier | 3 | +5%/10%/15% magic damage resistance | None |
| 1 | Enchanted Flesh | 3 | Max HP +4%/8%/12% | None |
| 2 | Mana Shield | 2 | Passive: absorb 15%/25% of incoming damage (absorbed damage reduces skill cooldown recovery by 1 turn per 10 damage absorbed) | Arcane Barrier 2 |
| 2 | Counterspell | 2 | 15%/25% chance to negate a magic-type enemy attack entirely | Arcane Barrier 1 |
| 3 | Temporal Stasis | 1 | Active: freeze all enemies in FOV for 2 turns. 30-turn cooldown. | Mana Shield 1, Counterspell 1 |

**Branch: Mysticism** — Utility and resource generation.

| Tier | Skill | Max Rank | Effect per Rank | Prereq |
|------|-------|----------|----------------|--------|
| 1 | Insight | 3 | +10%/20%/30% XP gained from all sources | None |
| 1 | Transmutation | 3 | +10%/20%/30% material drop quantity | None |
| 2 | Identify | 2 | Gear drops have +1/+2 to effective floor level for stat generation | Insight 1 |
| 2 | Enchant | 2 | Active: buff a piece of equipped gear for the rest of the run with +2/+4 to its highest stat. Once per floor. | Transmutation 1 |
| 3 | Archmage | 1 | All active skill cooldowns reduced by an additional 3 turns. Skill damage +15%. | Identify 1, Enchant 1 |

### 3.6 Skill Tree UI

The skill tree is accessed from either the town (at any time) or the dungeon (during inventory/pause). It shows the 3 branches in a top-to-bottom tree layout. Each skill node shows: name, current rank/max rank, effect description, prerequisite status, and cost (1 skill point per rank). Nodes are greyed out if prerequisites are unmet. The player can invest points between runs or immediately upon leveling during a run.

Respeccing is available at the Library building (Level 2+): full respec costs Crystal, refunds all skill points. This prevents permanent mistakes without making respecs trivially cheap.

---

## 4. Dungeon Rank & Modifier System

The Rank system solves the core scaling problem: as the player accumulates powerful gear, skill tree investment, and town bonuses, content must scale to remain challenging and rewarding. Rank provides player-driven difficulty selection with proportional reward scaling.

### 4.1 Rank Fundamentals

Each dungeon tier has an independent Rank that the player selects before entering. Rank 1 is the baseline difficulty. Higher ranks apply multiplicative scaling to enemy stats and proportional scaling to rewards.

### 4.2 Enemy Scaling Per Rank

Enemies receive the following multipliers per rank above 1. These compound with existing floor-based scaling from v1.

| Stat | Per-Rank Multiplier | Rank 5 Example | Design Rationale |
|------|-------------------|----------------|------------------|
| HP | +22% per rank | 1.88× base HP | Fights last longer, resource management matters more |
| Damage stats (STR/DEX/INT) | +18% per rank | 1.72× base stats | Hits hurt more, healing resources become precious |
| Speed | +4% per rank | 1.16× base speed | Subtle; prevents overwhelming action economy at high ranks |
| Elite spawn chance | +5% per rank (base 3%) | 23% at Rank 5 | More elites creates tactical variety, not just stat inflation |

The scaling formula applied in `scaleEnemyTemplate` becomes: `effectiveStat = baseStat × floorScale × rankScale`, where `rankScale = 1 + (rank - 1) × perRankMultiplier`.

Speed scaling is deliberately conservative. A Rank 8 bat at 145 base speed would reach ~190 speed, giving it roughly 1.9 turns per player turn. This is pressuring but not overwhelming. If speed scaling proves frustrating in playtesting, it can be reduced to +2% per rank or removed entirely without affecting other balance.

### 4.3 New Enemy Variants at Higher Ranks

Beyond raw number scaling, specific ranks introduce new enemy types within each biome's pool. These are added to the existing weighted template selection, not replacements.

| Biome | Rank Threshold | New Variant | Behavior |
|-------|---------------|-------------|----------|
| Overgrowth | Rank 3+ | Venomous Leech | Rushdown; applies poison DOT (2 dmg/turn for 3 turns) on hit |
| Overgrowth | Rank 5+ | Elder Slime | Ambush; splits into 2 smaller slimes at 30% HP |
| Burrows | Rank 3+ | Armored Rat | Rushdown; +50% CON, slower speed, drops extra iron |
| Burrows | Rank 5+ | Dire Bat | Rushdown; 180 speed, attacks twice per turn at low HP |
| Deep Mines | Rank 3+ | Bone Archer | Kiting; ranged skeleton with poison-tipped arrows |
| Deep Mines | Rank 5+ | Revenant | Rushdown; resurrects once at 50% HP after 3-turn delay |
| Abyssal Halls | Rank 3+ | Void Stalker | Ambush; teleports to random tile after taking damage |
| Abyssal Halls | Rank 5+ | Arch-Demon | Summoner; summons 2 imps at once, has magic ranged attack |

### 4.4 Reward Scaling Per Rank

Higher rank proportionally increases all reward types:

**Material quantity:** +35% per rank above 1. Rank 1 drops 1–2 per kill; Rank 5 drops 2–4 per kill. This is the primary incentive for pushing rank on farmed dungeons.

**Secondary material chance:** Rank 3+ adds 15% chance for biome secondary material. Rank 5+ adds 8% chance for tertiary. Rank 7+ adds 3% chance for Aether from non-boss enemies.

**Gear rarity floor:** Rank 1–2 has standard drop tables. Rank 3–4 removes Common drops (minimum Uncommon). Rank 5–6 boosts Rare+ rates by 20%. Rank 7+ boosts Epic+ rates by 15% and gear generates at +2 effective floor level.

**Boss drops:** +1 rarity tier at Rank 3+. Unique item chance at Rank 5+ (10%). Rare blueprint chance at Rank 7+ (8%). Double Aether at Rank 5+.

**XP bonus:** +20% XP per rank above 1. This makes high-rank runs the most efficient path for character leveling, reinforcing the risk/reward curve.

**Essence (currency):** +25% per rank above 1, applied to all enemy kill rewards and floor clear bonuses.

### 4.5 Rank Unlock Progression

Rank unlocks use a dual-gate system: **skill gate** plus **town gate**.

**Skill gate:** Defeating a dungeon tier at Rank N unlocks Rank N+1 for that specific tier. You prove you can handle the difficulty before accessing the next level. Rank 1 is always available for all unlocked tiers.

**Town gate:** Global rank cap equals Town Level + 1. Town Level 0 caps at Rank 1. Town Level 4 caps at Rank 5. This prevents a skilled player from infinitely out-farming their town progression; you must invest in infrastructure to access the highest difficulty tiers.

Both gates must be satisfied. A player who has beaten Overgrowth Rank 6 but only has Town Level 3 is capped at Rank 4 until they build more. Conversely, a player at Town Level 8 but who has never beaten Overgrowth Rank 2 must still climb the ranks sequentially.

### 4.6 Dungeon Modifiers

Modifiers are optional toggles that each add +1 to the **effective rank for reward calculation** (but do not add to stat scaling; instead they apply their specific gameplay effect). This allows skilled players to increase rewards without pure stat inflation. Modifiers are unlocked gradually: one new modifier becomes available every 2 Town Levels.

| Modifier | Effect | Unlock | Reward Bonus |
|----------|--------|--------|-------------|
| Famished | No natural HP regen between floors; rest rooms heal 50% less | Town Level 2 | +1 effective rank (rewards only) |
| Haunted | Cleared rooms respawn 1–2 enemies after 40 turns | Town Level 2 | +1 effective rank (rewards only) |
| Blind | FOV radius reduced by 3 tiles (8 → 5) | Town Level 4 | +1 effective rank (rewards only) |
| Relentless | All enemy speed +15% | Town Level 4 | +1 effective rank (rewards only) |
| Barren | No mid-floor item drops; all loot consolidated at floor-end chest | Town Level 6 | +1 effective rank (rewards only) |
| Cursed | Traps deal double damage and are invisible (ignores Show Traps perk) | Town Level 6 | +1 effective rank (rewards only) |
| Volatile | Player takes 10% max HP damage when using any skill | Town Level 8 | +1 effective rank (rewards only) |
| Ironman | Death saves disabled; all materials and NPCs lost on death | Town Level 8 | +2 effective rank (rewards only) |

Multiple modifiers can be active simultaneously. A Rank 3 run with Famished + Blind + Haunted has base Rank 3 stat scaling but Rank 6 reward scaling. This creates a rich space of risk/reward optimization: modifiers that the player has mastered become "free" reward bonuses.

---

## 5. Dungeon Tier Structure

The single 10-floor dungeon from v1 is restructured into multiple dungeon tiers, each a self-contained 3-floor run gated by town progression. This provides natural pacing, replayability through rank scaling, and a reason to revisit earlier tiers for specific materials.

### 5.1 Tier Definitions

| Tier | Name | Floors | Biome | Town Level Required | Primary Material |
|------|------|--------|-------|-------------------|-----------------|
| 1 | The Overgrowth | 1–3 | Jungle | 0 (starting) | Timber |
| 2 | The Burrows | 4–6 | Dirt Cave | 2 | Stone |
| 3 | The Deep Mines | 7–9 | Stone Cave | 4 | Iron |
| 4 | The Abyssal Halls | 10–12 | Dungeon | 6 | Crystal |
| 5 | The Void | 13–15 | Void (new biome) | 8 | Aether + mixed |

Each tier reuses the existing biome system from v1 (palette, archetype weights, water/trap density, ambient audio profiles). Tier 5 introduces a new Void biome with its own palette, enemy pool, and audio profile. Tiers map directly to the existing floor numbering: Tier 1 uses floors 1–3, Tier 2 uses floors 4–6, etc. The existing `getBiome()` function and floor-based scaling remain unchanged; the tier system just controls which floor range the player enters.

### 5.2 Tier Flow

A tier run consists of 3 procedurally generated floors. Floors 1 and 2 of a tier contain standard rooms, enemies, loot, and special rooms (now with active mechanics). Floor 3 contains the tier boss in the boss room. Defeating the tier boss clears the run and returns the player to town with all gathered resources.

Stairs on floor 3, after the boss is defeated, trigger the **return-to-town transition** rather than descending to a new floor. This replaces the linear 10-floor descent with a town→dungeon→town rhythm.

### 5.3 Tier Boss Definitions

The existing boss templates (Brood Mother, Rat King, Bone Lord, Void Tyrant) map to tiers 1–4. Tier 5 introduces a new final boss. Boss stats scale with rank using the same formula as regular enemies, making high-rank boss fights substantially harder.

| Tier | Boss | Behavior | Special Mechanic | Critical Drop |
|------|------|----------|-----------------|---------------|
| 1 | Brood Mother | Summoner | Spawns leeches; enrages (speed +30%) below 25% HP | Mine Blueprint + Blacksmith NPC (Kael) |
| 2 | Rat King | Summoner | Spawns rats; crown projectile AoE attack every 4 turns | Forge Blueprint + Alchemist NPC (Mira) |
| 3 | Bone Lord | Summoner | Spawns skeletons; raises dead enemies as bone minions | Library Blueprint + Scholar NPC (Aldric) |
| 4 | Void Tyrant | Rushdown | Charge attack (3-tile dash); enrage phases at 66%/33% HP | Shrine Blueprint + Seer NPC (Sable) |
| 5 | The Hollow | Phase-shift | 3 phases: melee rushdown → ranged kiting → summoner. Terrain warps (tiles become traps) between phases. | Unique Void building blueprint |

First-time boss defeats (regardless of rank) drop the critical-path blueprint and NPC. Subsequent defeats at the same or lower rank drop standard boss loot. Subsequent defeats at a new highest rank for that tier drop enhanced loot per the rank reward scaling table.

### 5.4 Special Room Activation

The v1 codebase designates special room types (treasure, trap, shop, shrine, rest, challenge) during dungeon generation but does not implement their mechanics. V2 activates all six:

**Treasure Room:** Contains a guarded chest. Stepping on the chest tile spawns 1–2 guardians (elite-tier enemies). Defeating all guardians unlocks the chest, which contains a guaranteed gear drop at +1 rarity tier above normal floor drops, plus a material bonus. At Rank 3+, treasure rooms have a 12% chance to contain a blueprint.

**Trap Room:** Dense trap tile coverage (60–80% of floor tiles are traps). A reward chest sits on the far side. Navigate through or clear all traps to reach it. Reward: consumable bundle + gold + materials. The Show Traps perk from v1 reveals trap locations in this room (except under Cursed modifier).

**Shop Room:** Contains a vendor NPC with 4–6 items for sale: gear, consumables, and (at Rank 3+) materials. Prices use run-earned essence. Inventory is generated on room creation and does not refresh. If the player has built a Market in town, shop prices are reduced by 15–25% depending on Market level.

**Shrine Room:** Contains an altar. Interaction presents a choice of 3 blessings from a pool. Blessings last for the remainder of the current run. Examples: +20% damage, +3 FOV, regen 1 HP/15 turns, +15% crit, double gold drops, +2 speed. Each shrine room also has a 15% chance to contain a trapped NPC for rescue.

**Rest Room:** Contains a campfire. One-time heal of 30–50% max HP. Optional: spend materials (not essence) to reroll one equipped gear piece at the current floor's rarity table. Rest rooms have a 10% chance to contain a stranded NPC. Under the Famished modifier, rest room healing is reduced by 50%.

**Challenge Room:** Sealed room. Entering triggers 2–3 enemy waves; the player cannot leave until all waves are cleared. Reward: 1–2 high-rarity items + significant essence + material bonus + guaranteed blueprint fragment (3 fragments = 1 random blueprint). Challenge rooms also award bonus XP (2× standard enemy XP for all kills within).

---

## 6. Town System

The town is a persistent tile grid where the player places buildings, assigns NPCs, and accesses services between dungeon runs. It replaces the v1 menu-based hub with a physical space that grows visibly over time.

### 6.1 Town Grid

The town occupies a **32×32 tile grid** using the same GameMap class from v1. Tile types include: grass (walkable, buildable), path (walkable, not buildable, player-placeable), water (not walkable, not buildable, fixed terrain feature), rock (not walkable, not buildable, fixed terrain feature), hill (walkable, not buildable, provides height bonus for watchtower), building footprint (walkable for the player, occupied by a structure), and building interior (entered to access services).

The grid is pre-seeded with fixed terrain features: a river running roughly north-south through the eastern third, rocky outcrops in the northwest, a hillside in the south, and a central clearing where the player's starting shelter is placed. These features are **deterministic** (not procedural) so that town layouts are consistent across saves.

The player walks freely around the town grid using the same movement controls as in-dungeon (arrow keys). There is no turn system, no enemies, no energy costs. Movement is real-time frame-based with a short input delay (~120ms) to prevent unintentional fast movement. The camera follows the player using the existing Camera class.

### 6.2 Building Placement

Buildings occupy rectangular footprints on the grid (typically 2×2, 2×3, or 3×3 tiles). Placement rules:

**Buildable terrain:** Buildings can only be placed on grass tiles. Water, rock, hill, path, and existing building tiles reject placement.

**Blueprint required:** The player must own the building's blueprint before it appears in the placement menu.

**Material cost:** Each building has a construction cost in materials. The player must have sufficient materials on hand. Materials are deducted on placement.

**No overlap:** Building footprints cannot overlap with each other or with fixed terrain.

**Connectivity:** At least one tile adjacent to the building footprint must be walkable (grass or path) so the player can reach the building entrance.

### 6.3 Adjacency Bonuses

Each building has a set of adjacency tags: features it "likes" and "dislikes" being near. Adjacency is checked within a **2-tile radius** of the building's footprint edge. When all "like" conditions are met and no "dislike" conditions are present, the building gains a bonus tier that improves its services.

| Building | Likes (within 2 tiles) | Dislikes (within 2 tiles) | Bonus When Satisfied |
|----------|----------------------|--------------------------|---------------------|
| Forge | Mine, Water | Farm, Library | Upgrade costs reduced 20%; unlocks masterwork recipes |
| Farm | Water, Open grass (3+ empty tiles) | Forge, Graveyard | Yields +50%; grows rare herbs for apothecary |
| Library | Shrine, Quiet (no forge/barracks nearby) | Forge, Barracks | Skill research 30% faster; unlocks advanced tomes |
| Watchtower | Hill tile, High ground | Surrounded by buildings | FOV bonus +2 (stacks with base); reveals secret rooms |
| Barracks | Forge, Training ground (open grass) | Library, Shrine | Companions start with +10% HP; unlock elite companions |
| Apothecary | Farm, Water | Graveyard | Potion potency +25%; unlocks rare potion recipes |
| Tavern | Central placement (near 3+ buildings) | Edge of map | Rumor quality improved; hints about blueprint locations |
| Shrine | Library, Water, Isolated (few buildings nearby) | Tavern, Barracks | Blessing potency +20%; fourth blessing option added |
| Market | Tavern, Path tiles nearby | Isolated placement | Shop prices -10% additional; rare items appear more often |
| Mine | Rock terrain nearby | Water, Farm | Iron yield +40%; chance for crystal in output |

The adjacency system is **transparent to the player**. When selecting a building for placement, the UI highlights which adjacency conditions are met and unmet for the currently hovered tile. Green indicators for "likes" satisfied, red for "dislikes" present, grey for conditions neither met nor violated. The player can always place a building without satisfying adjacency (it still functions, just without the bonus), so the system rewards optimization without punishing casual placement.

### 6.4 Building Levels

Each building has **3 upgrade levels**. Level 1 is initial construction. Levels 2 and 3 cost progressively more materials and may require materials from higher-tier dungeons. Each level improves the building's services and may unlock new capabilities.

Example: the Forge at Level 1 allows rerolling one stat on a piece of gear. At Level 2 it can upgrade gear rarity (Uncommon → Rare) at a high material cost. At Level 3 it can socket a bonus stat onto gear that has no skill, creating a custom item. Each level also improves the adjacency bonus magnitude.

Upgrading a building does not change its footprint or position. The building sprite changes to reflect its level (visual progression).

### 6.5 Town Level Calculation

Town Level = sum of all building levels ÷ 3, rounded down.

| Buildings Constructed | Average Level | Town Level | Unlocks |
|----------------------|--------------|-----------|---------|
| 2 buildings at Level 1 | — | 0 | Tier 1 dungeon, Rank 1 cap |
| 3 buildings at Level 1 | — | 1 | Rank 2 cap |
| 3 buildings at Level 2 | — | 2 | Tier 2 dungeon, Rank 3 cap, first modifiers |
| 5 buildings avg Level 2–3 | — | 4 | Tier 3 dungeon, Rank 5 cap, second modifiers |
| 7 buildings avg Level 2–3 | — | 6 | Tier 4 dungeon, Rank 7 cap, third modifiers |
| 9+ buildings at Level 3 | — | 8+ | Tier 5 dungeon, Rank 9+ cap, all modifiers |

This formula means the player must invest **broadly** (many buildings) rather than deeply (one maxed building) to progress. Progression naturally encourages building variety, which in turn exposes the player to more services.

---

## 7. Building Definitions & Services

Ten buildings are defined for v2. Each has a footprint, construction cost, upgrade costs, adjacency preferences, and per-level service descriptions. The player's starting shelter is pre-placed and cannot be moved.

### 7.1 Starter Shelter (Pre-placed)

The shelter is a 2×2 building placed at town center during initial town generation. It provides the stash (carried over from v1), the dungeon selection interface, the skill tree interface, and basic run preparation. The shelter cannot be destroyed, moved, or upgraded. It serves as the anchor point for the rest of the town.

### 7.2 Building Costs Reference

| Building | Size | Blueprint Source | Build Cost | L2 Cost | L3 Cost |
|----------|------|-----------------|-----------|---------|---------|
| Forge | 2×3 | Burrows boss | 15 Stone, 10 Iron | 25 Stone, 20 Iron, 5 Crystal | 40 Iron, 15 Crystal, 3 Aether |
| Farm | 3×3 | Overgrowth special rooms | 20 Timber, 5 Stone | 30 Timber, 15 Stone | 20 Stone, 10 Iron, 5 Crystal |
| Barracks | 2×3 | Burrows special rooms | 20 Timber, 10 Stone | 15 Stone, 15 Iron | 30 Iron, 10 Crystal |
| Mine | 2×2 | Overgrowth boss | 10 Timber, 10 Stone | 20 Stone, 10 Iron | 30 Iron, 10 Crystal |
| Library | 2×3 | Deep Mines boss | 15 Stone, 10 Crystal | 20 Crystal, 10 Iron | 30 Crystal, 5 Aether |
| Shrine | 2×2 | Abyssal Halls boss | 10 Stone, 15 Crystal | 25 Crystal, 5 Aether | 15 Aether |
| Apothecary | 2×2 | Deep Mines special rooms | 15 Timber, 10 Stone, 5 Crystal | 15 Iron, 15 Crystal | 20 Crystal, 5 Aether |
| Watchtower | 2×2 | Overgrowth special rooms | 15 Timber, 15 Stone | 20 Stone, 10 Iron | 15 Iron, 10 Crystal |
| Market | 2×3 | Burrows special rooms | 20 Timber, 15 Stone | 20 Stone, 15 Iron | 20 Iron, 15 Crystal |
| Tavern | 2×2 | Deep Mines special rooms | 15 Timber, 10 Stone | 15 Stone, 10 Iron | 15 Iron, 10 Crystal |

### 7.3 Service Descriptions Per Level

**Forge**
L1: Reroll one stat on a piece of gear (costs iron). L2: Upgrade gear rarity by one tier, Uncommon→Rare→Epic (costs iron + crystal). L3: Socket a bonus stat onto gear with no skill (costs crystal + aether). Staffed by Blacksmith NPC (Kael). Without NPC: only L1 reroll available regardless of building level.

**Farm**
L1: Passive income of 2–3 Timber per run completed. L2: Also produces 1–2 Stone passively; herbs available for apothecary recipes. L3: Produces small amounts of all basic materials; rare herbs for unique potions. Staffed by Farmer NPC (Lena). Without NPC: produces at 50% rate.

**Barracks**
L1: Hire a basic NPC companion for one run (rushdown AI, ~60% of player HP, basic melee). L2: Companions are stronger (80% HP, can use items); choose from 2 companion types. L3: Elite companions (100% HP, unique abilities); choose from 3 types including ranged and support. Staffed by Captain NPC (Bronk). Without NPC: only basic companion available.

**Mine**
L1: Passive income of 2–3 Stone per run completed. L2: Also produces 1 Iron passively. L3: Produces 2–3 Iron and has 15% chance of Crystal per run. Staffed by Miner NPC (Grist). Without NPC: produces at 50% rate. Adjacency with Rock terrain increases all yields by 40%.

**Library**
L1: Browse skill tree (accessible from shelter too). Respec all skill points (costs Crystal). Access lore archive. L2: Respec costs reduced 50%. Learn one permanent passive skill per run from a pool of 4 (e.g., +5% crit, +1 FOV, +10% trap damage resistance, +5% dodge). L3: Passive skill pool expands to 8. Can hold 3 passive skills simultaneously (up from 2 at L2, 1 at L1). Staffed by Scholar NPC (Aldric). Without NPC: can browse but not learn passive skills or respec.

**Shrine**
L1: Choose one persistent pre-run blessing (weaker than in-dungeon shrine blessings but lasts the entire run). L2: Expanded blessing pool; blessings are 20% stronger. L3: Can hold 2 simultaneous pre-run blessings. Staffed by Seer NPC (Sable). Without NPC: random blessing assigned (no choice).

**Apothecary**
L1: Brew Minor Health Potions at material cost (cheaper than finding them). Can brew 5 per run. L2: Brew Major Health Potions and utility potions (speed, invisibility). Brew limit increases to 8. L3: Brew unique potions not found in dungeons (resistance potions, stat-boost potions, Town Portal scrolls). Brew limit 12. Staffed by Alchemist NPC (Mira). Without NPC: only Minor Health Potions available.

**Watchtower**
L1: First floor of each dungeon run starts with 25% of tiles pre-explored. L2: 40% pre-explored; hidden enemies within FOV are revealed with a shimmer effect. L3: 60% pre-explored; minimap always visible; secret rooms (if implemented) are marked. Staffed by Scout NPC (Wren). Without NPC: 15% / 25% / 35% exploration instead.

**Market**
L1: In-dungeon shop rooms have 2 additional items; prices reduced 10%. L2: Shop items can include Rare+ gear; prices reduced 20%. Can sell unwanted gear for materials during runs. L3: Shops may contain blueprints and NPCs for rescue; prices reduced 30%. Staffed by Merchant NPC (Thessa). Without NPC: price reduction halved.

**Tavern**
L1: Before each run, receive a vague hint about one special room on the next floor ("I heard there's a shrine somewhere on floor 2"). L2: Hints are more specific (room type + general direction); also hints about which rank thresholds unlock new enemy variants in target dungeon. L3: Full floor previews showing special room locations; hints about boss weak points and optimal gear types. Also shares lore rumors (see section 9). Staffed by Barkeep NPC (Duff). Without NPC: hints are less reliable (30% chance of being wrong).

---

## 8. NPC System

NPCs staff buildings and provide the skilled labor that unlocks advanced building services. Each NPC has a role, a set of placement preferences, and personality traits that affect dialogue.

### 8.1 NPC Roster

| NPC | Role | Source | Staffs | Placement Preferences |
|-----|------|--------|--------|----------------------|
| Kael | Blacksmith | Tier 1 boss (first kill) | Forge | Near forge, near water, away from library |
| Mira | Alchemist | Tier 2 boss (first kill) | Apothecary | Near apothecary, near farm, away from mine |
| Aldric | Scholar | Tier 3 boss (first kill) | Library | Near library, near shrine, away from barracks |
| Sable | Seer | Tier 4 boss (first kill) | Shrine | Near shrine, near water, isolated (few buildings nearby) |
| Bronk | Captain | Burrows special rooms | Barracks | Near barracks, near forge, away from library |
| Wren | Scout | Overgrowth special rooms | Watchtower | Near watchtower, high ground, away from tavern |
| Thessa | Merchant | Deep Mines special rooms | Market | Near market, near tavern, near path tiles |
| Duff | Barkeep | Deep Mines special rooms | Tavern | Near tavern, central location, near path tiles |
| Lena | Farmer | Overgrowth special rooms | Farm | Near farm, near water, away from forge |
| Grist | Miner | Burrows special rooms | Mine | Near mine, near rock terrain, away from farm |

### 8.2 NPC Housing

NPCs do not require separate houses in v2 (scope reduction). They are "assigned" to a building through the building's service menu and are considered to live there. If an NPC's placement preferences are satisfied (their assigned building meets certain adjacency conditions), they become "content" and provide a passive bonus: +5% to their building's service output. If all preferences are satisfied, they become "delighted" and provide +15% and unlock a unique dialogue line or recipe.

NPCs can be reassigned between compatible buildings (e.g., the Blacksmith can staff the Forge or the Mine at reduced effectiveness). Reassignment is free but takes effect after the next dungeon run (not immediately), preventing mid-session optimization exploits.

### 8.3 NPC Dialogue

Each NPC has 3–5 dialogue lines per content state (neutral, content, delighted) and 1–2 lines that trigger on specific events (first assignment, building upgrade, post-boss-kill). Dialogue is displayed in a text box overlay when the player interacts with a staffed building. Dialogue adds personality to the town without requiring complex conversation trees. Lines are stored as string arrays in the NPC data model.

---

## 9. Lore & Environmental Storytelling

*Inspired by Baldur's Gate: Dark Alliance's atmospheric worldbuilding.*

### 9.1 Overview

Diegeist v2 introduces a lore system that builds the world gradually through discoverable fragments. The lore does not affect gameplay mechanically (no stat bonuses from reading lore) but enriches the experience and gives the Library building additional purpose as a lore archive.

### 9.2 Lore Fragments

Lore fragments are short text entries (2–4 sentences each) discovered in dungeons. They are found in several ways:

**Environmental lore:** Certain tiles in dungeon rooms (bookshelves, wall carvings, corpse notes) contain lore that the player can read by stepping on the tile and pressing a key. Each biome has a pool of 8–12 fragments that reveal the history of that dungeon tier.

**Boss lore:** Defeating a tier boss for the first time unlocks a lore entry about that boss — who they were before they became a monster, what they guard, why the dungeon exists.

**NPC lore:** Rescued NPCs, once assigned and at "content" or "delighted" contentment, reveal personal backstory lore entries through dialogue. These connect the NPCs to the dungeon world.

**Tavern rumors:** The Tavern at Level 3 periodically generates lore-adjacent "rumor" entries that hint at deeper world mysteries and foreshadow later tier content.

### 9.3 Lore Archive

The Library building houses the lore archive. Discovered fragments are organized by source (biome, boss, NPC, rumor) and can be re-read at any time. The archive tracks completion percentage per category, giving completionists a secondary goal.

Total lore entries target: approximately 60–80 across all categories. This is enough to feel substantial without requiring a massive writing effort. Entries are stored as string arrays indexed by ID in the save data.

### 9.4 Environmental Tiles

Lore-containing tiles are a new tile type added to dungeon generation. They are visually distinct (e.g., a bookshelf tile or a carved wall tile) and placed in rooms at a low density (0–2 per floor). They are walkable and interactive. Stepping on them and pressing the interact key displays the lore text in a message overlay. Each lore tile is flagged with a fragment ID; once read, the fragment is permanently saved and the tile becomes non-interactive on subsequent visits.

---

## 10. Town Portal Mechanic

*Inspired by Baldur's Gate: Dark Alliance's recall potion system.*

### 10.1 Overview

The Town Portal is a consumable item that allows the player to return to town mid-dungeon-run, bank materials and gear, use town services, and then return to the dungeon at the exact point they left. This introduces strategic depth: do you use the portal now to lock in a valuable blueprint, or push deeper for better rewards?

### 10.2 Obtaining Town Portal Scrolls

Town Portal scrolls are **not dropped in dungeons** — they are exclusively crafted at the Apothecary (Level 3) at a significant material cost (5 Crystal + 1 Aether per scroll). This gates the mechanic behind meaningful town investment and makes each scroll a considered resource.

The player can carry a maximum of **1 Town Portal scroll per run** (belt slot item). Using it is a one-way trip to town with a return ticket; the scroll is consumed.

### 10.3 Portal Mechanics

**Activation:** Using the Town Portal scroll from the belt opens a portal on the player's current tile. The game state is frozen: enemy positions, HP values, cooldowns, floor layout — everything is preserved exactly as-is.

**Town visit:** The player is transported to town with all current inventory, gathered materials, and rescued NPCs. They can use any town service: bank materials, stash gear, upgrade buildings, assign NPCs, brew potions, etc. The only restriction is they **cannot start a new dungeon run** while a portal is active.

**Return:** Interacting with the portal anchor (displayed at the shelter) returns the player to the exact tile where they activated the portal. The dungeon state is restored. The portal closes and the scroll is consumed.

**Timeout:** If the player spends more than 100 turns (actions) in town before returning, the portal destabilizes and closes. The player keeps everything they banked but cannot return to the dungeon run — it counts as an abandoned run (no death penalty, but no boss rewards).

### 10.4 Death While Portal Is Active

If the player dies in the dungeon after creating a portal (e.g., they returned from town and then died on a subsequent floor), normal death rules apply — the portal does not protect against death. However, any materials/gear banked during the town visit remain safely banked.

This creates the strategic play: portal back to bank your valuable findings mid-run, return to the dungeon with a lighter inventory to continue pushing. If you die after banking, you lose only what you gathered post-portal.

---

## 11. Data Models

All new data structures are extensions of or companions to the existing v1 models. The existing Entity, Item, GameMap, SaveData, and related structures remain unchanged unless noted.

### 11.1 SaveData Extensions

The v1 SaveData class gains the following new fields. All existing fields (currency, stash, achievements, shopPurchases, permanentStats, permanentPerks, runHistory, settings) are preserved.

| Field | Type | Description |
|-------|------|-------------|
| `materials` | `{ timber, stone, iron, crystal, aether }` | Persistent material inventory. Survives death (with 50% penalty on current-run materials). |
| `blueprints` | `string[]` | Array of building type IDs the player has discovered. Auto-saved on find. |
| `townGrid` | `TownTile[][]` | 32×32 grid of town tile data including terrain type and building references. |
| `buildings` | `Building[]` | Array of placed buildings with position, type, level, and assigned NPC. |
| `npcs` | `NPC[]` | Array of rescued NPCs with role, assignment, contentment state, and dialogue state. |
| `unlockedTiers` | `number[]` | Array of dungeon tier IDs the player has access to. |
| `tierRanks` | `{ [tierId]: number }` | Highest rank beaten per tier. Determines rank unlock for each tier. |
| `unlockedModifiers` | `string[]` | Array of modifier IDs the player has unlocked via town level. |
| `librarySkills` | `string[]` | Array of permanent passive skill IDs learned at the library. |
| `preRunBlessings` | `string[]` | Array of active pre-run blessing IDs selected at the shrine. |
| `townLevel` | `number` | Cached town level. Recalculated on building place/upgrade. |
| `blueprintFragments` | `number` | Fragment count. 3 fragments = 1 random blueprint. |
| `runMaterials` | `{ timber, stone, iron, crystal, aether }` | Materials gathered in current run. Subject to 50% death penalty. |
| `classXP` | `{ fighter, archer, mage }` | XP per class. Persistent, never lost to death. |
| `classLevels` | `{ fighter, archer, mage }` | Level per class. Derived from XP but cached. |
| `skillPoints` | `{ fighter, archer, mage }` | Unspent skill points per class. |
| `skillInvestments` | `{ fighter: {}, archer: {}, mage: {} }` | Map of skill ID → invested ranks per class. |
| `loreFragments` | `string[]` | Array of discovered lore fragment IDs. |
| `portalState` | `PortalState | null` | Frozen dungeon state when Town Portal is active. Null when no portal is open. |

### 11.2 Building Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique instance ID (e.g., "forge_1708901234") |
| `type` | `string` | Building type ID matching blueprint (e.g., "forge", "farm") |
| `position` | `{ x, y }` | Top-left corner of footprint on town grid |
| `footprint` | `{ width, height }` | Size in tiles (e.g., `{ width: 2, height: 3 }`) |
| `level` | `number` | 1–3. Determines service tier and sprite variant. |
| `assignedNpc` | `string | null` | NPC ID assigned to staff this building, or null. |
| `adjacencyBonus` | `boolean` | Whether all adjacency conditions are currently met. |

### 11.3 NPC Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique NPC ID (e.g., "kael", "mira") |
| `name` | `string` | Display name |
| `role` | `string` | Functional role (blacksmith, alchemist, scholar, etc.) |
| `preferredBuilding` | `string` | Building type this NPC is most effective in |
| `placementPrefs` | `{ likes: string[], dislikes: string[] }` | Adjacency preferences for contentment |
| `contentment` | `string` | `"neutral" | "content" | "delighted"` |
| `assignedTo` | `string | null` | Building instance ID this NPC is assigned to |
| `dialogue` | `{ neutral: string[], content: string[], delighted: string[], events: {} }` | Dialogue lines per state |
| `spriteKey` | `string` | Sprite registry key for rendering |

### 11.4 Skill Tree Node Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique skill ID (e.g., "fighter_heavy_strike") |
| `name` | `string` | Display name |
| `branch` | `string` | Branch name (e.g., "warfare", "bulwark", "vanguard") |
| `tier` | `number` | 1–3. Determines vertical position in tree. |
| `maxRank` | `number` | Maximum ranks investable (1–3) |
| `costPerRank` | `number` | Skill points per rank (always 1) |
| `prerequisites` | `{ skillId: string, minRank: number }[]` | Required skill investments to unlock |
| `effectPerRank` | `object[]` | Array of effect descriptors per rank |
| `description` | `string` | Player-facing description text |
| `skillType` | `string` | `"passive" | "active"`. Active skills gain a cooldown and are usable in combat. |
| `cooldown` | `number | null` | Turn cooldown for active skills. Null for passives. |

### 11.5 Dungeon Run Config

A new DungeonRunConfig object is created when the player begins a run from the shelter, replacing the simple class selection from v1.

| Field | Type | Description |
|-------|------|-------------|
| `tierId` | `number` | Which dungeon tier (1–5) |
| `rank` | `number` | Selected rank (1 to max unlocked) |
| `modifiers` | `string[]` | Active modifier IDs |
| `effectiveRank` | `number` | rank + sum of modifier reward bonuses |
| `classKey` | `string` | Player class (fighter, archer, mage) |
| `playerLevel` | `number` | Current class level at run start |
| `activeTreeSkills` | `object` | Resolved skill effects from tree investments |
| `companion` | `CompanionConfig | null` | Hired companion from barracks, if any |
| `preRunBlessings` | `string[]` | Active blessings from town shrine |
| `librarySkills` | `string[]` | Active permanent skills from library |
| `brewedPotions` | `Item[]` | Potions brewed at apothecary for this run |
| `watchtowerReveal` | `number` | Percentage of tiles to pre-explore on floor start |
| `shopDiscount` | `number` | Price reduction for in-dungeon shops (from Market) |
| `townPortalCount` | `number` | Town Portal scrolls available (0 or 1) |

### 11.6 Lore Fragment Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique fragment ID (e.g., "overgrowth_history_03") |
| `category` | `string` | `"environment" | "boss" | "npc" | "rumor"` |
| `biome` | `string | null` | Associated biome (null for NPC/rumor) |
| `text` | `string` | The lore text (2–4 sentences) |
| `source` | `string` | Where it was found (for archive display) |

---

## 12. Integration with Existing Codebase

The v2 expansion is designed to integrate with the existing 6,855-line Diegeist codebase. This section catalogs specific integration points.

### 12.1 Reused As-Is

The following systems require no modifications:

GameMap class (tile storage, bounds checking, walkability, LOS, visibility, exploration tracking). Entity class (position, stats, HP, energy, equipment, inventory, belt, status effects). Camera class (zoom, viewport, tile-to-screen conversion, centering). TurnSystem class (energy accumulation, ready queue, turn ordering). A* pathfinding (findPath function, blocked position handling). FOV computation (computeFOV, castRay). Combat math (calculateDamage, resolveAttack, all status effect interactions). AI behaviors (rushdown, kiting, ambush, summoner, wander). BSP dungeon generation (BSPNode, createRoom, carveRoom, carveCorridor, connectRooms, placeDoors). Item generation (generateItem, generateConsumable, ITEM_TEMPLATES, SKILL_POOL). Inventory management (addToInventory, equipItem, unequipItem, belt operations). Gear-bound skill system (updateActiveSkills, tickCooldowns, class skills). Sprite definitions (all existing SPRITE_DEFINITIONS entries). Audio manager (all SFX and ambient audio). Message log. Input handler and KEY_MAP.

### 12.2 Requires Modification

**Game class state machine:** Add new states: `"town"`, `"townBuilding"`, `"townBuildingService"`, `"dungeonSelect"`, `"skillTree"`, `"npcDialogue"`, `"loreView"`. The existing state transitions remain; new states are added alongside them.

**`scaleEnemyTemplate()`:** Add rank multiplier parameter. The function signature becomes `scaleEnemyTemplate(template, rank = 1)`. Scaling formulas multiply by rankScale in addition to existing floor-based scaling.

**`getEnemyBaseTemplatesForFloor()`:** Add rank-gated enemy variant injection. Check if `rank >= variant.rankThreshold` before adding to the weighted pool.

**`generateItem()` / `generateConsumable()`:** Accept optional `rankBonus` parameter that shifts rarity weights and effective floor level.

**SaveData class:** Add all new fields from section 11.1. Extend `serialize()` and `deserialize()` to include them. Backward-compatible: missing fields default to empty/zero on old saves.

**`startFloor()`:** Accept DungeonRunConfig. Apply watchtower pre-exploration. Set FOV_RADIUS adjustment for Blind modifier. Configure regen for Famished modifier. Spawn companion entity if configured. Apply skill tree passive effects to player entity. Place lore tiles in rooms.

**`handleFloorTransition()`:** After floor 3 of a tier, trigger return-to-town instead of descending. Award material bonuses and XP bonuses. Calculate death-save vs. victory-keep for materials.

**`handleEnemyDeath()`:** Add material drop rolls alongside existing gear/consumable/currency drops. Award XP to current class. Track runMaterials accumulation. Apply skill tree effects (e.g., Vital Strike healing, Scavenger drop bonus, Transmutation material bonus).

**Combat resolution (`resolveCombat`):** Apply skill tree combat modifiers: Cleave splash, Staggering Blow stun, Chain Lightning arc, Piercing Shot passthrough, block chance from Shield Wall, Retaliation counter-attacks, crit modifiers from Eagle Eye / Lethal Focus / Deadeye.

**Special room processing:** In `startFloor()`, after room type designation, spawn appropriate interactables: treasure chest entities, shop vendor entities, shrine altar entities, rest campfire entities, challenge room seals, lore tiles.

**HUD:** Add material counter display. Add XP bar / level indicator. Existing HP bar, belt, skills, stats line remain unchanged.

### 12.3 Entirely New Systems

These are new classes/modules that do not exist in v1:

TownMap class (extends or parallels GameMap for town-specific tile types and fixed terrain). TownRenderer (renders town grid, buildings, NPCs, terrain features). BuildingSystem (placement validation, adjacency calculation, upgrade logic, service menus). NPCManager (NPC roster, assignment, contentment calculation, dialogue state). DungeonSelector (UI for tier/rank/modifier selection, requirement checking). SkillTreeSystem (skill definitions per class, point investment, effect resolution, UI rendering). CompanionAI (simplified entity that follows player, attacks nearest enemy). ResourceManager (material tracking, death penalty calculation, passive income from buildings). LoreManager (fragment tracking, archive UI, lore tile placement during generation). PortalSystem (dungeon state freeze/restore, town visit session, timeout tracking). TownAudioManager (separate ambient profile for town).

---

## 13. Phased Build Plan

Nine build phases, ordered by dependency. Each phase produces a playable increment. Phase 1 can begin immediately on the existing codebase.

### Phase 1: Resource System & Material Drops

Add the material resource layer to the existing dungeon loop. Enemies drop materials alongside existing gear/consumable drops. Materials accumulate during a run and are committed to persistent storage on run completion or death (with 50% penalty). The existing SaveData is extended with material fields.

**Key Implementation:** Extend `handleEnemyDeath()` with material drop roll. Add `runMaterials` tracking to Game class. Extend SaveData with materials and runMaterials. Modify `finalizeRun()` to commit materials (100% on victory, 50% on death). Add material counter to HUD. Extend death-save choice to include "save material haul" option alongside existing "save 1 item" option.

**Status: COMPLETE** (2026-02-16)

**Acceptance Criteria:**
- [x] Enemies drop 1-2 materials on kill (40% chance) appropriate to current biome
- [x] Floor clear awards 3-5 materials
- [x] Boss kills award 2-4 Aether plus biome materials
- [x] HUD displays current run material counts
- [x] Materials persist to SaveData on victory (100%) and death (50%)
- [x] Death save screen offers choice: save 1 item OR save full material haul
- [x] SaveData serialization includes materials; backward-compatible with v1 saves

**Implementation Notes:**
- `src/resources.js` — Material types, biome mapping, drop/clear/boss functions, `MATERIAL_COLORS`
- `src/progression.js` — `SaveData.materials`, `addMaterials()`, `canAfford()`, `spendMaterials()`, serialize/deserialize with backward-compat
- `src/game.js` — `runMaterials`/`currentRank` state, material drops in `handleEnemyDeath()`, floor clear bonuses in `handleFloorTransition()`, 100%/50% commit in `finalizeRun()`, `deathSaveChoice` state, material summaries on death/victory screens, colored floating text VFX on material drops
- `src/hud.js` — Bold material counters with drop shadow, colored message log entries
- `src/message-log.js` — Optional `color` parameter on `add()`
- `tests/resources.test.js` — 14 tests covering all resource functions
- `tests/progression.test.js` — 7 new tests for material fields (28 total)

### Phase 2: Class Skill Trees & XP — **Status: COMPLETE** (2026-02-16)

Implement the 3-branch skill tree for each class, XP gain from combat, leveling, and skill point investment. Skill tree is accessible from inventory/pause during dungeon and from shelter in town (once town exists in Phase 3).

**Key Implementation:** Define all skill nodes per class with prerequisites, ranks, effects. XP award on enemy kill (scaled by rank) and floor clear. Level-up logic with skill point grants. Skill tree UI (3-column branch display, node selection, point investment). Resolve passive skill effects into player stat modifiers at run start and on level-up. Hook active skills into combat system alongside gear-bound skills. Persist XP, levels, skill points, and investments in SaveData per class.

**Implementation Notes:**
- `src/skill-tree.js` — Full skill tree data for 3 classes (15 nodes each), XP table, leveling, investment, effect resolution (42 tests)
- `src/combat.js` — `resolveAttack()` extended with `attackerTreeEffects`/`defenderTreeEffects` for damage multipliers, dodge, crit, block, damage reduction
- `src/progression.js` — `SaveData` extended with `classXP`, `classLevels`, `skillPoints`, `skillInvestments` (backward-compatible)
- `src/hud.js` — XP bar and level indicator added to HUD
- `src/game.js` — XP awards on kill/floor clear, resolveCombat tree injection, combat hooks (Cleave, Stagger, Retaliation, Vital Strike, passive regen), skill tree UI with navigation and investment, drawSkillTree
- Active skills (Rush, Meteor, etc.) are defined with cooldowns but targeting UI deferred to follow-up task
- `build.js` — `skill-tree.js` added to SOURCE_ORDER

**Acceptance Criteria:**
- [x] All 3 classes have complete skill trees (3 branches, 15 skills each)
- [x] XP awards on enemy kill, floor clear, boss kill with rank scaling
- [x] Level progression from 1-20 with appropriate XP curve
- [x] Skill point investment UI with prerequisite validation
- [x] Passive skills modify player stats correctly
- [x] Active skills defined with cooldowns (targeting UI deferred)
- [x] Combat hooks for Cleave, Staggering Blow, etc.
- [x] Defensive hooks for Shield Wall (block), Retaliation, damage reduction, etc.
- [x] XP, levels, skill points, investments persist per class across sessions
- [x] Skill tree accessible from pause menu during dungeon

### Phase 3: Town Grid & Basic Navigation

Create the town as a separate game mode. Build the 32×32 town grid with fixed terrain features. Implement free-movement navigation. Add the state machine transitions between town and dungeon. The starter shelter is pre-placed and provides access to the stash, skill tree, and a simple "enter dungeon" option.

**Key Implementation:** Create TownMap with terrain tile types. Seed fixed terrain. Implement town-mode movement (frame-based, no turn system). Add town rendering with terrain sprites. Add "town" state to Game class. Transition: startMenu → town. Shelter interaction → stash, skill tree, or dungeon entry. Town ambient audio profile.

**Acceptance Criteria:**
- [x] Town grid renders with grass, water, rock, hill, and path tile types
- [x] Fixed terrain features are present (river, rocks, hill, clearing)
- [x] Player spawns at shelter and can walk freely around town
- [x] Movement is smooth frame-based (not turn-based) with ~120ms input delay
- [x] Camera follows player using existing Camera class
- [x] Interacting with shelter opens stash, skill tree, and dungeon entry
- [x] Entering dungeon from shelter transitions to existing dungeon flow
- [x] Completing/dying in dungeon returns player to town (not startMenu)
- [x] Town has its own ambient audio profile
- [ ] Town state persists across sessions via SaveData

### Phase 4: Building System & Placement

Implement building definitions, the placement UI, and construction logic. Buildings render as multi-tile sprites on the town grid. Adjacency bonus calculation is active.

**Key Implementation:** Define all 10 building types with footprints, costs, adjacency tags. Build placement mode UI. Placement validation. Material deduction on placement. Building sprite rendering. Adjacency bonus calculation. Building upgrade UI. Town Level calculation. Persist building data in SaveData.

**Acceptance Criteria:**
- [ ] All 10 building types defined with footprint, costs, and adjacency tags
- [ ] Placement mode shows ghost footprint and adjacency satisfaction indicators
- [ ] Buildings can only be placed on valid grass tiles with no overlap
- [ ] Placement deducts materials from persistent inventory
- [ ] Placed buildings render on town grid with correct multi-tile sprites
- [ ] Adjacency bonuses calculate correctly within 2-tile radius
- [ ] Buildings can be upgraded from Level 1 to 2 to 3 with escalating costs
- [ ] Town Level recalculates on every build/upgrade action
- [ ] Building data persists in SaveData across sessions
- [ ] Player cannot place buildings for which they lack the blueprint

### Phase 5: Blueprint & NPC Drops + Special Rooms

Add blueprints and NPCs as dungeon rewards. Activate all six special room mechanics. Tier bosses drop critical-path blueprints and NPCs on first kill.

**Key Implementation:** Blueprint and NPC drop tables. Blueprint auto-save mechanic. NPC rescue encounters. Activate all 6 special room types. Blueprint fragment system. Lore tile placement and interaction. Persist blueprints, NPCs, and lore in SaveData.

**Acceptance Criteria:**
- [ ] Tier bosses drop specified blueprint + NPC on first kill
- [ ] Blueprints are auto-saved; NPCs are subject to death penalty
- [ ] All 6 special room types function with defined mechanics
- [ ] Treasure rooms: guardians + chest with enhanced loot + blueprint chance
- [ ] Shrine rooms: 3-blessing choice + NPC rescue chance
- [ ] Rest rooms: heal + gear reroll + NPC rescue chance
- [ ] Shop rooms: vendor with rank-scaled inventory
- [ ] Challenge rooms: enemy waves + fragments + bonus XP
- [ ] Trap rooms: dense traps + reward chest
- [ ] Lore tiles spawn in rooms and are readable/collectible
- [ ] 3 blueprint fragments combine into 1 random blueprint

### Phase 6: Dungeon Tier & Rank System

Replace the single linear dungeon with tiered dungeon selection. Implement rank scaling for enemies and rewards. Gate tier access by Town Level and rank by completion + Town Level.

**Key Implementation:** Dungeon selection screen. Tier definitions. Rank scaling in `scaleEnemyTemplate`. Rank-based reward multipliers. 3-floor-per-tier structure with return-to-town. Rank-gated enemy variants.

**Acceptance Criteria:**
- [ ] Dungeon selection UI shows available tiers and current rank per tier
- [ ] Tiers gated by Town Level
- [ ] Rank gated by previous-rank completion AND Town Level cap
- [ ] Enemy stats scale correctly with rank multipliers
- [ ] Material drop quantities scale with rank (+35% per rank)
- [ ] Gear rarity floor rises at Rank 3+ and 5+
- [ ] Rank-gated enemy variants appear at correct thresholds
- [ ] Floor 3 completion returns player to town with rewards
- [ ] XP and essence rewards scale with rank

### Phase 7: NPC Assignment & Building Services

Implement NPC assignment to buildings and all building service UIs. Each building becomes interactive when the player walks to it in town.

**Key Implementation:** Building interaction system. NPC assignment UI. NPC contentment calculation. Per-building service UI: Forge, Apothecary, Barracks, Library (passive skills + respec + lore archive), Shrine, Watchtower, Market, Tavern (hints + lore rumors), Farm/Mine (passive income). Service output modified by NPC staffing and contentment.

**Acceptance Criteria:**
- [ ] Player can interact with placed buildings to open service menus
- [ ] NPCs can be assigned to compatible buildings
- [ ] NPC contentment calculates from placement preferences
- [ ] All 10 building services function per spec at all 3 levels
- [ ] Unstaffed buildings offer reduced services per spec
- [ ] NPC dialogue displays based on contentment state
- [ ] Library hosts lore archive and skill respec
- [ ] Tavern provides hints and lore rumors
- [ ] Farm and Mine generate passive income on run completion

### Phase 8: Dungeon Modifiers & Town Portal

Implement modifier selection and all modifier effects. Implement the Town Portal scroll mechanic.

**Key Implementation:** Modifier definitions with unlock thresholds. Modifier toggle UI. Effective rank calculation. Per-modifier effect hooks. Town Portal scroll as Apothecary L3 recipe. Portal activation, town visit with restrictions, return mechanic, timeout. Dungeon state serialization for portal freeze/restore.

**Acceptance Criteria:**
- [ ] Modifier unlock triggers at correct Town Levels
- [ ] Dungeon selection UI shows available modifiers with toggles
- [ ] Effective rank for rewards = base rank + modifier reward bonuses
- [ ] All 8 modifiers function per spec (Famished, Haunted, Blind, Relentless, Barren, Cursed, Volatile, Ironman)
- [ ] Multiple modifiers can be active simultaneously
- [ ] Town Portal scroll craftable at Apothecary L3
- [ ] Portal freezes dungeon state and transports player to town
- [ ] Player can use town services while portal is active
- [ ] Player cannot start new run while portal is active
- [ ] Return to dungeon restores exact state
- [ ] Portal times out after 100 town actions
- [ ] Materials banked during portal visit are safe if player dies after returning

### Phase 9: Void Biome, Companion AI, & Polish

Add the final dungeon tier (The Void) with new biome, enemies, and boss. Implement companion AI. Full polish pass.

**Key Implementation:** Void biome (palette, sprites, audio, enemies, "The Hollow" 3-phase boss). Companion AI (follows player, attacks nearest enemy, limited HP). Building sprite polish (3 level variants). Town audio polish. Balance pass. Minimap overlay. PWA self-containment (inline manifest, inline service worker). Full lore content for all categories.

**Acceptance Criteria:**
- [ ] Void biome renders with unique palette and tile sprites
- [ ] Void enemy pool: 3+ new enemy types with unique behaviors
- [ ] The Hollow boss fight: 3 phases with terrain warping
- [ ] Companion entity follows player and fights using AI behaviors
- [ ] Companion has limited HP and can be killed (no in-run respawn)
- [ ] All building sprites have 3 level variants
- [ ] Town ambient audio is distinct from dungeon ambients
- [ ] Minimap overlay shows explored/visible dungeon tiles
- [ ] Full balance pass on all scaling curves, costs, and service outputs
- [ ] 60–80 lore fragments written and placed across all categories
- [ ] PWA: inline manifest and service worker; fully offline after first load
- [ ] Single HTML file constraint maintained

---

## 14. Balance Framework

Balance targets for playtesting. All numbers are tuning parameters expected to change.

### 14.1 Progression Pacing

| Milestone | Target Run Count | Notes |
|-----------|-----------------|-------|
| First building placed | 2–3 runs | Mine or Farm; cheapest build costs |
| First class level-up | 1 run | Early XP should feel rewarding immediately |
| Tier 2 unlocked | 6–8 runs | Requires Town Level 2 (3 buildings at L1 min) |
| First skill tree tier 2 skill | 5–7 runs | ~Level 5, first meaningful branching decision |
| First building at Level 2 | 8–10 runs | Enough materials for first upgrade |
| Tier 3 unlocked | 15–20 runs | Town Level 4; multiple L2 buildings needed |
| First skill tree tier 3 skill | 15–18 runs | ~Level 11, capstone abilities come online |
| Rank 5 of any tier beaten | 20–25 runs | Significant gear + skill investment required |
| Tier 4 unlocked | 30–40 runs | Town Level 6; most buildings placed and upgraded |
| Level 20 (first class) | 50–60 runs | Long-tail goal; should feel earned |
| Full town (all buildings L3) | 60–80 runs | Endgame goal; requires Aether from high-rank runs |
| The Void completed | 80–100 runs | Victory condition; requires optimized everything |

### 14.2 Material Economy

At Rank 1 baseline, a successful 3-floor Tier 1 run should yield approximately 12–18 Timber, 3–5 Stone, and 2–4 Aether (from boss). The cheapest building (Mine: 10 Timber + 10 Stone) requires approximately 2–3 successful runs. The most expensive L3 upgrade (Shrine L3: 15 Aether) requires approximately 5–7 boss kills at high rank, providing a long-tail endgame goal.

Passive income from Farm and Mine should supplement but not replace dungeon farming. Target: passive income covers 15–20% of material needs at full upgrade. The player always has a reason to run dungeons.

### 14.3 XP Economy

A standard Rank 1 enemy kill should award approximately 15–25 XP. Elite enemies award 2× standard. Boss kills award 10× standard (~200 XP). Floor clears award ~100 XP. A full 3-floor Tier 1 run at Rank 1 should yield approximately 400–600 XP, enough for approximately 1–2 levels in the early game.

XP scaling with rank (+20% per rank) means Rank 5 runs award approximately double the XP of Rank 1 runs. This makes high-rank content the most efficient leveling path, but low-rank content is never "worthless" for XP.

### 14.4 Rank Difficulty Curve

Rank 1 of any tier should be completable in starter gear with base class and no skill tree investment. Rank 3 should require tier-appropriate gear and some skill investment (~5 points). Rank 5 should require forge-enhanced gear, strategic consumables, and meaningful skill tree specialization (~10 points). Rank 7+ should require optimized builds, companion support, library skills, shrine blessings, and deep skill tree investment (~15+ points). Rank 10 (if reachable) should be a prestige challenge requiring near-perfect play.

The speed scaling cap: if enemy speed causes more than 2.5 turns per player turn at any rank, reduce the per-rank speed multiplier.

### 14.5 Death Penalty Tuning

The 50% material loss on death should feel punishing but not devastating. A player who dies on floor 2 of a tier loses roughly 4–6 materials, about 1/3 of a run's expected yield. XP is never lost. Skill tree investments are never lost. Town progress is never lost. Death costs time (need to re-run) but never erases significant progress.

The one-item death save creates a meaningful choice only when the player found a high-value item during that run. Most low-rank deaths the choice is obvious (save the gear). At higher ranks where material hauls are more valuable, the choice becomes genuinely difficult.

---

## Appendix A: Building Adjacency Matrix

Quick-reference showing all adjacency relationships. "+" = likes being near. "–" = dislikes.

|  | Forge | Farm | Mine | Library | Shrine | Barracks | Apothecary | Market | Tavern | Watchtower |
|--|-------|------|------|---------|--------|----------|------------|--------|--------|------------|
| Forge | — | – | + | – | | | | | | |
| Farm | – | — | | | | | + | | | |
| Mine | + | – | — | | | | | | | |
| Library | – | | | — | + | – | | | | |
| Shrine | | | | + | — | – | | | – | |
| Barracks | + | | | – | | — | | | | |
| Water | + | + | – | | + | | + | | | |
| Rock | | | + | | | | | | | |
| Hill | | | | | | | | | | + |
| Path | | | | | | | | + | + | |

---

## Appendix B: NPC Quick Reference

| NPC | Role | Staffs | Source | Key Preference |
|-----|------|--------|--------|---------------|
| Kael | Blacksmith | Forge | Tier 1 boss | Near forge + water |
| Mira | Alchemist | Apothecary | Tier 2 boss | Near apothecary + farm |
| Aldric | Scholar | Library | Tier 3 boss | Near library + shrine, quiet |
| Sable | Seer | Shrine | Tier 4 boss | Near shrine + water, isolated |
| Bronk | Captain | Barracks | Burrows rooms | Near barracks + forge |
| Wren | Scout | Watchtower | Overgrowth rooms | High ground, near tower |
| Thessa | Merchant | Market | Deep Mines rooms | Near market + tavern |
| Duff | Barkeep | Tavern | Deep Mines rooms | Central, near paths |
| Lena | Farmer | Farm | Overgrowth rooms | Near farm + water |
| Grist | Miner | Mine | Burrows rooms | Near mine + rock |

---

## Appendix C: Modifier Quick Reference

| Modifier | Town Level | Effect Summary | Reward Bonus | Counter-Strategy |
|----------|-----------|---------------|-------------|-----------------|
| Famished | 2 | No regen; rest rooms nerfed | +1 | Apothecary potions, regen skills |
| Haunted | 2 | Rooms respawn enemies | +1 | Fast clear speed, don't backtrack |
| Blind | 4 | FOV –3 tiles | +1 | Watchtower bonus, careful play |
| Relentless | 4 | Enemy speed +15% | +1 | Speed potions, kiting tactics |
| Barren | 6 | No mid-floor drops | +1 | Pre-run preparation, apothecary stock |
| Cursed | 6 | Hidden 2× traps | +1 | CON investment, trap resistance skill |
| Volatile | 8 | Skills cost 10% HP | +1 | High CON, selective skill use |
| Ironman | 8 | No death saves | +2 | Conservative play, exit early if risky |

---

## Appendix D: Skill Tree Quick Reference

### Fighter

| Branch | Theme | Capstone |
|--------|-------|----------|
| Warfare | Offensive melee power | Berserker Rage (+40% dmg / –20% def, 5 turns) |
| Bulwark | Defensive staying power | Unbreakable (survive killing blow once per floor) |
| Vanguard | Mobility and control | Warlord (companions +30% dmg, +20% HP) |

### Archer

| Branch | Theme | Capstone |
|--------|-------|----------|
| Marksmanship | Ranged damage and precision | Deadeye (next 3 shots auto-crit) |
| Survival | Evasion and self-sustain | Shadow Step (3-turn invisibility, guaranteed crit on break) |
| Trapper | Area control and utility | Ambush Predator (3× damage on unaware enemies) |

### Mage

| Branch | Theme | Capstone |
|--------|-------|----------|
| Destruction | Raw magical damage | Meteor (massive 3×3 AoE) |
| Warding | Protection and mitigation | Temporal Stasis (freeze all enemies in FOV, 2 turns) |
| Mysticism | Utility and resource generation | Archmage (–3 all cooldowns, +15% skill damage) |

---

*End of specification.*

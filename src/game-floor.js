import { TILE, getBiome, BIOME_THEMES, FOV_RADIUS } from './constants.js';
import { Entity } from './entity.js';
import { createPlayer } from './player.js';
import { TurnSystem } from './turn-system.js';
import { generateDungeon } from './dungeon-gen.js';
import { generateItem, generateConsumable } from './items.js';
import { updateActiveSkills } from './skills.js';
import { computeFOV } from './fov.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { resolvePassiveEffects } from './skill-tree.js';
import { persistSaveData } from './progression.js';
import { getFloorClearMaterials, getBossKillMaterials, MATERIAL_COLORS } from './resources.js';
import {
  getEntityStatsWithEquipment,
  syncMilestoneAchievements,
  awardXP,
  getEnemyXP,
  clearCombatVfx,
  recalcPlayerMaxHp,
} from './game-utils.js';
import { applyStarterLoadout, applyPendingHubLoadout } from './game-save.js';

export function getEnemyBaseTemplatesForFloor(floorNumber) {
  const biome = getBiome(floorNumber);

  const ENEMY_POOLS = {
    wilds: [
      {
        name: 'Leech', maxHp: 20, speed: 80, behavior: 'rushdown',
        stats: { STR: 3, DEX: 2, CON: 4, INT: 1, WIS: 1, LCK: 2 },
        spriteKey: 'leech', weight: 40,
      },
      {
        name: 'Slime', maxHp: 32, speed: 70, behavior: 'ambush',
        stats: { STR: 2, DEX: 1, CON: 6, INT: 1, WIS: 1, LCK: 2 },
        spriteKey: 'slime', weight: 35,
      },
    ],
    cave: [
      {
        name: 'Rat', maxHp: 20, speed: 100, behavior: 'rushdown',
        stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 },
        spriteKey: 'rat', weight: Math.max(12, 52 - floorNumber * 3),
      },
      {
        name: 'Bat', maxHp: 12, speed: 145, behavior: 'rushdown',
        stats: { STR: 2, DEX: 3, CON: 2, INT: 1, WIS: 1, LCK: 3 },
        spriteKey: 'bat', weight: 22 + floorNumber * 1.2,
      },
    ],
    dungeon: [
      {
        name: 'Skeleton', maxHp: 28, speed: 100, behavior: 'rushdown',
        stats: { STR: 5, DEX: 4, CON: 4, INT: 2, WIS: 2, LCK: 2 },
        spriteKey: 'skeleton', weight: 40,
      },
      {
        name: 'Zombie', maxHp: 48, speed: 65, behavior: 'rushdown',
        stats: { STR: 6, DEX: 1, CON: 7, INT: 1, WIS: 1, LCK: 1 },
        spriteKey: 'zombie', weight: 35,
      },
      {
        name: 'Skeleton Archer', maxHp: 20, speed: 95, behavior: 'kiting',
        stats: { STR: 2, DEX: 6, CON: 3, INT: 2, WIS: 2, LCK: 3 },
        spriteKey: 'skeleton_archer', weight: 25,
      },
    ],
    eldritch: [
      {
        name: 'Demon', maxHp: 40, speed: 95, behavior: 'summoner',
        stats: { STR: 5, DEX: 3, CON: 5, INT: 6, WIS: 5, LCK: 3 },
        spriteKey: 'demon', weight: 50,
        summonTemplate: { name: 'Imp', spriteKey: 'leech', stats: { STR: 3, DEX: 2, CON: 2, INT: 1, WIS: 1, LCK: 1 }, maxHp: 16 },
      },
    ],
  };

  return ENEMY_POOLS[biome] || ENEMY_POOLS.cave;
}

export function chooseWeightedEnemyTemplate(templates) {
  const totalWeight = templates.reduce((sum, t) => sum + Math.max(1, t.weight || 1), 0);
  let roll = Math.random() * totalWeight;
  for (const template of templates) {
    roll -= Math.max(1, template.weight || 1);
    if (roll <= 0) return template;
  }
  return templates[templates.length - 1];
}

export function scaleEnemyTemplate(template, floorNumber) {
  const statScale = 1 + Math.max(0, floorNumber - 1) * 0.06;
  const hpScale = 1 + Math.max(0, floorNumber - 1) * 0.11;
  const speedScale = 1 + Math.max(0, floorNumber - 1) * 0.01;
  const scaledStats = {};
  for (const [stat, value] of Object.entries(template.stats)) {
    scaledStats[stat] = Math.max(1, Math.floor(value * statScale));
  }

  const enemy = {
    ...template,
    stats: scaledStats,
    maxHp: Math.max(template.maxHp + 4 * (floorNumber - 1), Math.floor(template.maxHp * hpScale)),
    speed: Math.max(70, Math.floor(template.speed * speedScale)),
    isElite: false,
  };

  const eliteChance = Math.min(0.32, 0.03 + floorNumber * 0.014);
  if (Math.random() < eliteChance) {
    enemy.isElite = true;
    enemy.name = `Elite ${enemy.name}`;
    enemy.maxHp = Math.floor(enemy.maxHp * 1.55);
    enemy.speed = Math.floor(enemy.speed * 1.08);
    for (const stat of Object.keys(enemy.stats)) {
      enemy.stats[stat] += 2 + Math.floor(floorNumber / 6);
    }
  }

  return enemy;
}

export function getFloorBossTemplate(floorNumber) {
  const BOSS_TEMPLATES = {
    3: {
      name: 'Brood Mother', spriteKey: 'boss_brood_mother', behavior: 'summoner',
      stats: { STR: 8, DEX: 4, CON: 10, INT: 6, WIS: 4, LCK: 3 }, maxHp: 180, speed: 80,
      renderScale: 1.5, auraColor: 'rgba(50, 180, 50, 0.25)',
      summonTemplate: { name: 'Leech', spriteKey: 'leech', stats: { STR: 3, DEX: 2, CON: 4, INT: 1, WIS: 1, LCK: 2 }, maxHp: 20 },
    },
    6: {
      name: 'Rat King', spriteKey: 'boss_rat_king', behavior: 'summoner',
      stats: { STR: 10, DEX: 8, CON: 10, INT: 4, WIS: 4, LCK: 6 }, maxHp: 300, speed: 95,
      renderScale: 1.5, auraColor: 'rgba(160, 120, 60, 0.25)',
      summonTemplate: { name: 'Rat', spriteKey: 'rat', stats: { STR: 3, DEX: 3, CON: 3, INT: 1, WIS: 1, LCK: 2 }, maxHp: 20 },
    },
    9: {
      name: 'Bone Lord', spriteKey: 'boss_bone_lord', behavior: 'summoner',
      stats: { STR: 14, DEX: 8, CON: 14, INT: 10, WIS: 8, LCK: 4 }, maxHp: 400, speed: 100,
      renderScale: 1.5, auraColor: 'rgba(80, 80, 200, 0.25)',
      summonTemplate: { name: 'Skeleton', spriteKey: 'skeleton', stats: { STR: 5, DEX: 4, CON: 4, INT: 2, WIS: 2, LCK: 2 }, maxHp: 28 },
    },
    10: {
      name: 'Void Tyrant', spriteKey: 'boss_tyrant', behavior: 'rushdown',
      stats: { STR: 15, DEX: 10, CON: 16, INT: 12, WIS: 10, LCK: 8 }, maxHp: 500, speed: 125,
      renderScale: 2.0, auraColor: 'rgba(200, 40, 40, 0.25)',
    },
  };
  return BOSS_TEMPLATES[floorNumber] || null;
}

export function spawnFloorBoss(game) {
  const template = getFloorBossTemplate(game.floorNumber);
  if (!template) return false;

  const bossRoom = game.map.rooms.find(r => r.type === 'boss');
  if (!bossRoom) return false;
  const centerX = Math.floor(bossRoom.x + bossRoom.width / 2);
  const centerY = Math.floor(bossRoom.y + bossRoom.height / 2);
  const candidates = [
    { x: centerX, y: centerY },
    { x: centerX + 1, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX, y: centerY + 1 },
    { x: centerX, y: centerY - 1 },
    { x: centerX + 1, y: centerY + 1 },
    { x: centerX - 1, y: centerY - 1 },
  ];

  const spot = candidates.find(c =>
    game.map.isWalkable(c.x, c.y) &&
    !game.map.entities.some(e => e.isAlive() && e.position.x === c.x && e.position.y === c.y)
  );
  if (!spot) return false;

  const boss = new Entity({
    id: `boss_floor${game.floorNumber}_${Date.now()}`,
    type: 'enemy',
    x: spot.x,
    y: spot.y,
    stats: { ...template.stats },
    maxHp: template.maxHp,
    speed: template.speed,
    behavior: template.behavior,
    name: template.name,
  });
  boss.spriteKey = template.spriteKey;
  boss.isFloorBoss = true;
  boss.renderScale = template.renderScale || 1;
  boss.auraColor = template.auraColor || 'rgba(200, 40, 40, 0.25)';
  if (template.summonTemplate) {
    boss.summonTemplate = template.summonTemplate;
    boss.summonCooldown = Math.max(1, 3 - Math.floor(game.floorNumber / 5));
  }
  game.map.entities.push(boss);
  game.turnSystem.addEntity(boss);
  game.messageLog.add(`${template.name} lurks in the boss chamber!`, game.turnCount);
  if (game.audio) game.audio.bossEntrance();
  return true;
}

export function spawnFloorItems(game, rooms) {
  const itemCount = 2 + Math.floor(Math.random() * 3);
  let spawned = 0;
  let attempts = 0;
  while (spawned < itemCount && attempts < 80) {
    attempts++;
    if (rooms.length === 0) break;

    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const x = room.x + Math.floor(Math.random() * room.width);
    const y = room.y + Math.floor(Math.random() * room.height);
    if (!game.map.isWalkable(x, y)) continue;

    const occupiedByEntity = game.map.entities.some(e => e.isAlive() && e.position.x === x && e.position.y === y);
    const occupiedByPlayer = game.player && game.player.position.x === x && game.player.position.y === y;
    const occupiedByItem = game.map.items.some(i => i.position.x === x && i.position.y === y);
    if (occupiedByEntity || occupiedByPlayer || occupiedByItem) continue;

    const item = Math.random() < 0.4
      ? generateConsumable(game.floorNumber)
      : generateItem({
        floorLevel: game.floorNumber,
        luck: getEntityStatsWithEquipment(game.player).LCK,
        context: 'drop',
      });
    game.map.items.push({ ...item, position: { x, y } });
    spawned++;
  }
}

export function startFloor(game) {
  // Determine biome and pick archetype from biome weights
  const biome = getBiome(game.floorNumber);
  const theme = BIOME_THEMES[biome];
  const archetypeEntries = Object.entries(theme.archetypeWeights);
  const totalWeight = archetypeEntries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  let archetype = 'hybrid';
  for (const [arch, weight] of archetypeEntries) {
    roll -= weight;
    if (roll <= 0) { archetype = arch; break; }
  }

  // Generate the dungeon with biome config
  game.map = generateDungeon(60, 50, archetype, game.floorNumber, theme);

  // Apply biome palette to tile sprites
  if (game.sprites) {
    game.sprites.setBiome(theme.palette);
  }

  // Find the start room and place the player at its center
  const startRoom = game.map.rooms.find(r => r.type === 'start');
  if (!startRoom) {
    throw new Error('No start room found in generated dungeon');
  }
  const startX = Math.floor(startRoom.x + startRoom.width / 2);
  const startY = Math.floor(startRoom.y + startRoom.height / 2);

  if (!game.player) {
    const classKey = game.selectedClass;
    const level = game.saveData?.classLevels?.[classKey] || 1;
    game.player = createPlayer(classKey, startX, startY, game.saveData?.permanentStats || {}, level);
    game.player.floorNumber = game.floorNumber;
    game.runSummary.classKey = game.player.playerClass;

    // Resolve skill tree passive effects before gear so max hp accounts for both
    const investments = game.saveData?.skillInvestments?.[classKey] || {};
    game.treePassiveEffects = resolvePassiveEffects(classKey, investments);

    applyStarterLoadout(game);
    applyPendingHubLoadout(game);
    recalcPlayerMaxHp(game);
    game.player.hp = game.player.maxHp;
  } else {
    game.player.moveTo(startX, startY);
    game.player.floorNumber = game.floorNumber;
    game.player.energy = 0;
    game.player.heal(Math.ceil(game.player.maxHp * 0.2));
  }

  game.turnSystem.addEntity(game.player);
  updateActiveSkills(game.player);

  // Spawn enemy groups
  const standardRooms = game.map.rooms.filter(r => r.type === 'standard');
  const floorPressure = Math.floor((game.floorNumber - 1) / 2);
  const numEnemyGroups = Math.min(12, 3 + floorPressure + Math.floor(Math.random() * 3));
  const rooms = standardRooms.slice().sort(() => Math.random() - 0.5);
  const baseEnemyTemplates = getEnemyBaseTemplatesForFloor(game.floorNumber);
  let enemySerial = 0;

  const isInRoom = (room, x, y) =>
    x >= room.x && x < room.x + room.width &&
    y >= room.y && y < room.y + room.height;

  const isSpawnOpen = (x, y) => {
    if (!game.map.isWalkable(x, y)) return false;
    if (game.player.position.x === x && game.player.position.y === y) return false;
    return !game.map.entities.some(e => e.isAlive() && e.position.x === x && e.position.y === y);
  };

  const pickOpenTileInRoom = (room, attempts = 20) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const x = room.x + Math.floor(Math.random() * room.width);
      const y = room.y + Math.floor(Math.random() * room.height);
      if (isSpawnOpen(x, y)) return { x, y };
    }
    return null;
  };

  const spawnEnemyAt = (enemyType, x, y) => {
    if (!isSpawnOpen(x, y)) return null;
    const scaled = scaleEnemyTemplate(enemyType, game.floorNumber);
    const enemy = new Entity({
      id: `enemy_${enemySerial++}`,
      type: 'enemy',
      x,
      y,
      stats: scaled.stats,
      maxHp: scaled.maxHp,
      speed: scaled.speed,
      behavior: scaled.behavior,
      name: scaled.name,
    });
    enemy.spriteKey = scaled.spriteKey;
    enemy.isElite = scaled.isElite;
    if (enemy.behavior === 'summoner') {
      enemy.summonCooldown = Math.max(1, 2 + Math.floor(Math.random() * 2) - Math.floor(game.floorNumber / 5));
      if (enemyType.summonTemplate) {
        enemy.summonTemplate = enemyType.summonTemplate;
      }
    }
    game.map.entities.push(enemy);
    game.turnSystem.addEntity(enemy);
    return enemy;
  };

  const packOffsets = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
  ];

  for (let i = 0; i < numEnemyGroups && i < rooms.length; i++) {
    const room = rooms[i];
    const enemyType = chooseWeightedEnemyTemplate(baseEnemyTemplates);
    const anchor = pickOpenTileInRoom(room);
    if (!anchor) continue;

    const first = spawnEnemyAt(enemyType, anchor.x, anchor.y);
    if (!first) continue;

    if (enemyType.name !== 'Bat' && enemyType.name !== 'Leech') continue;

    const packSize = Math.min(5, 2 + Math.floor(Math.random() * 2) + Math.floor((game.floorNumber - 1) / 6));
    const packTiles = [{ x: anchor.x, y: anchor.y }];
    let spawned = 1;
    let attempts = 0;

    while (spawned < packSize && attempts < 20) {
      attempts++;
      const origin = packTiles[Math.floor(Math.random() * packTiles.length)];
      const offsets = packOffsets.slice().sort(() => Math.random() - 0.5);
      let placed = false;
      for (const offset of offsets) {
        const nx = origin.x + offset.dx;
        const ny = origin.y + offset.dy;
        if (!isInRoom(room, nx, ny)) continue;
        const bat = spawnEnemyAt(enemyType, nx, ny);
        if (!bat) continue;
        packTiles.push({ x: nx, y: ny });
        spawned++;
        placed = true;
        break;
      }
      if (!placed) continue;
    }
  }

  if (getFloorBossTemplate(game.floorNumber)) {
    spawnFloorBoss(game);
  }
  if (game.floorNumber === 10) {
    game.messageLog.add('Final floor. Defeat the Void Tyrant to win.', game.turnCount);
  }
  spawnFloorItems(game, standardRooms);

  if (game.floorNumber === 1 && game.turnCount === 0) {
    game.messageLog.add('Welcome to Diegeist. Move with arrows. Attack with WASD.', game.turnCount);
    game.messageLog.add('Press G to pick up items. Press I to manage inventory.', game.turnCount);
    game.messageLog.add('Press P for stats. Esc to pause. Q/E/R for skills.', game.turnCount);
    if (game.player.playerClass === 'fighter') {
      game.messageLog.add('WASD attacks adjacent enemies in melee.', game.turnCount);
    } else {
      game.messageLog.add('WASD fires ranged attacks toward enemies.', game.turnCount);
    }
  }
  game.messageLog.add(`Floor ${game.floorNumber} begins.`, game.turnCount);
  if (game.audio) game.audio.startAmbient(game.floorNumber);
  game._currentAmbientBiome = getBiome(game.floorNumber);

  computeFOV(game.map, game.player.position.x, game.player.position.y, FOV_RADIUS);
  // the camera viewport differs between town and dungeon; make sure it is dungeon-sized now
  if (game.syncCameraViewport) game.syncCameraViewport();
  else game.camera.centerOn(game.player.position.x, game.player.position.y, game.map.width, game.map.height);
}

export function handleFloorTransition(game) {
  const playerTile = game.map.getTile(game.player.position.x, game.player.position.y);
  if (playerTile !== TILE.STAIRS_DOWN) {
    game.messageLog.add('There are no stairs here.', game.turnCount);
    return false;
  }

  // Check if boss room is cleared
  const bossRoom = game.map.rooms.find(r => r.type === 'boss');
  if (bossRoom) {
    const enemiesInBossRoom = game.map.entities.filter(e => {
      if (e.type !== 'enemy' || !e.isAlive()) return false;
      return e.position.x >= bossRoom.x && e.position.x < bossRoom.x + bossRoom.width &&
             e.position.y >= bossRoom.y && e.position.y < bossRoom.y + bossRoom.height;
    });
    if (enemiesInBossRoom.length > 0) {
      game.messageLog.add('The stairs are blocked. Clear the boss room first.', game.turnCount);
      return false;
    }
  }

  // Floor 10: descending after the final boss triggers victory
  if (game.floorNumber >= 10) {
    const floorReward = 10 + game.floorNumber * 2;
    game.player.gold += floorReward;
    game.runSummary.currencyEarned += floorReward;
    const victoryBiome = getBiome(game.floorNumber);
    const victoryFloorMats = getFloorClearMaterials(victoryBiome, game.currentRank || 1);
    game.runMaterials[victoryFloorMats.type] += victoryFloorMats.quantity;
    game.messageLog.add('You ascend from the depths, victorious.', game.turnCount);
    game.finalizeRun('Victory');
    game.captureRunItemsForHub(true);
    game.state = 'victory';
    if (game.audio) game.audio.stairsDescend();
    if (game.audio) game.audio.stopAmbient();
    return true;
  }

  // Descend to next floor
  const floorReward = 10 + game.floorNumber * 2;
  game.player.gold += floorReward;
  game.runSummary.currencyEarned += floorReward;
  const floorBiome = getBiome(game.floorNumber);
  const floorMats = getFloorClearMaterials(floorBiome, game.currentRank || 1);
  game.runMaterials[floorMats.type] += floorMats.quantity;
  game.messageLog.add(`Floor clear: +${floorMats.quantity} ${floorMats.type}`, game.turnCount, MATERIAL_COLORS[floorMats.type]);

  // Floor clear XP bonus
  const floorClearXP = getEnemyXP(game, { isFloorBoss: false, isElite: false }) * 5;
  awardXP(game, floorClearXP);

  game.floorNumber++;
  game.runSummary.floorsReached = Math.max(game.runSummary.floorsReached, game.floorNumber);
  syncMilestoneAchievements(game);
  persistSaveData(game.saveData);

  // Clear old entities from turn system
  game.turnSystem = new TurnSystem();
  // floating text and projectiles are in tile coordinates of the old floor; drop them
  clearCombatVfx(game);

  startFloor(game);
  if (game.audio) game.audio.stairsDescend();
  game.messageLog.add(`You gain ${floorReward} essence for clearing the floor.`, game.turnCount);
  game.messageLog.add(`You descend to floor ${game.floorNumber}.`, game.turnCount);
  return true;
}

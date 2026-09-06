import { describe, it, expect } from 'vitest';
import { GameMap } from '../src/game-map.js';
import { TurnSystem } from '../src/turn-system.js';
import { MessageLog } from '../src/message-log.js';
import { Camera } from '../src/camera.js';
import { createPlayer } from '../src/player.js';
import { SaveData } from '../src/progression.js';
import { createEmptyMaterials } from '../src/resources.js';
import { TILE } from '../src/constants.js';
import { addFloatingText } from '../src/game-utils.js';
import {
  startFloor,
  handleFloorTransition,
  scaleEnemyTemplate,
  getEnemyBaseTemplatesForFloor,
  getFloorBossTemplate,
  revealRooms,
} from '../src/game-floor.js';
import { placeBuilding, chooseBlessing, brewPotion } from '../src/town-buildings.js';
import { buildTownMap } from '../src/town.js';
import { finalizeRun } from '../src/game-save.js';

function makeGame() {
  const game = {
    state: 'playing',
    map: null,
    player: null,
    selectedClass: 'fighter',
    turnSystem: new TurnSystem(),
    messageLog: new MessageLog(),
    turnCount: 5,
    floorNumber: 1,
    currentRank: 1,
    runMaterials: createEmptyMaterials(),
    runSummary: { classKey: 'fighter', floorsReached: 1, enemiesKilled: 0, currencyEarned: 0, causeOfDeath: null },
    combatVfx: { floatingTexts: [], projectiles: [] },
    saveData: new SaveData(),
    audio: null,
    sprites: null,
    camera: new Camera(800, 600),
    pendingStashLoadoutItem: null,
    captureRunItemsForHub() {},
    syncMilestoneAchievements() {},
  };
  return game;
}

describe('startFloor', () => {
  it('creates a leveled player with tree actives and full hp', () => {
    const game = makeGame();
    game.saveData.classLevels.fighter = 5;
    game.saveData.skillInvestments.fighter = { fighter_rush: 1 };
    startFloor(game);
    expect(game.player.level).toBe(5);
    expect(game.player.hp).toBe(game.player.maxHp);
    expect(game.player.maxHp).toBeGreaterThan(64);
    expect(game.player.treeActiveSkills.map(s => s.name)).toEqual(['Rush']);
    expect(game.player.activeSkills.some(s => s && s.name === 'Rush')).toBe(true);
    expect(game.map.rooms.some(r => r.type === 'start')).toBe(true);
    expect(game.corpses).toEqual([]);
    expect(game.deathSaveUsedThisFloor).toBe(false);
  });
});

describe('handleFloorTransition', () => {
  it('refuses when the player is not on the stairs', () => {
    const game = makeGame();
    startFloor(game);
    expect(handleFloorTransition(game)).toBe(false);
    expect(game.floorNumber).toBe(1);
  });

  it('clears floating text and advances the floor', () => {
    const game = makeGame();
    startFloor(game);
    // teleport onto the stairs and remove any boss-room guards
    let stairs = null;
    for (let y = 0; y < game.map.height; y++) for (let x = 0; x < game.map.width; x++) if (game.map.getTile(x, y) === TILE.STAIRS_DOWN) stairs = { x, y };
    expect(stairs).not.toBeNull();
    game.player.moveTo(stairs.x, stairs.y);
    for (const e of game.map.entities) if (e.type === 'enemy') e.hp = 0;
    addFloatingText(game, 1, 1, 'stale');
    expect(game.combatVfx.floatingTexts).toHaveLength(1);
    const treeSkills = game.player.treeActiveSkills;
    expect(handleFloorTransition(game)).toBe(true);
    expect(game.floorNumber).toBe(2);
    expect(game.combatVfx.floatingTexts).toHaveLength(0);
    expect(game.player.treeActiveSkills).toBe(treeSkills);
    expect(game.runMaterials.timber).toBeGreaterThan(0);
  });
});

describe('enemy scaling', () => {
  it('scales hp and stats with floor number', () => {
    const leech = getEnemyBaseTemplatesForFloor(1)[0];
    // elite promotion is random; sample until a regular enemy comes out
    const regular = (floor) => { for (let i = 0; i < 200; i++) { const e = scaleEnemyTemplate(leech, floor); if (!e.isElite) return e; } return scaleEnemyTemplate(leech, floor); };
    const f1 = regular(1);
    const f9 = regular(9);
    expect(f1.maxHp).toBe(leech.maxHp);
    expect(f9.maxHp).toBeGreaterThan(f1.maxHp * 1.5);
    expect(f9.stats.STR).toBeGreaterThan(f1.stats.STR);
  });

  it('gives every boss a signature key', () => {
    for (const floor of [3, 6, 9, 10]) {
      const boss = getFloorBossTemplate(floor);
      expect(boss.bossKey).toBeTruthy();
      expect(boss.maxHp).toBeGreaterThanOrEqual(180);
    }
    expect(getFloorBossTemplate(4)).toBeNull();
  });

});

describe('town effects on a run', () => {
  function exploredFraction(map) {
    let walkable = 0, explored = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      if (!map.isWalkable(x, y)) continue;
      walkable++;
      if (map.isExplored(x, y)) explored++;
    }
    return explored / walkable;
  }

  it('watchtower scouts the first floor', () => {
    const plain = makeGame();
    startFloor(plain);
    const baseline = exploredFraction(plain.map);

    const game = makeGame();
    game.saveData.materials.timber = 50;
    placeBuilding(game.saveData, buildTownMap(), 'watchtower', 5, 10);
    startFloor(game);
    expect(exploredFraction(game.map)).toBeGreaterThan(Math.max(0.3, baseline));
    expect(game.messageLog.messages.some(m => /watchtower/.test(m.text))).toBe(true);
  });

  it('revealRooms stops once the fraction is reached', () => {
    const game = makeGame();
    startFloor(game);
    for (let y = 0; y < game.map.height; y++) for (let x = 0; x < game.map.width; x++) game.map.setExplored(x, y, false);
    const revealed = revealRooms(game.map, 0.34);
    expect(revealed).toBeGreaterThan(0);
    expect(revealed).toBeLessThan(game.map.rooms.length);
  });

  it('brewed potions and the shrine blessing are consumed at run start', () => {
    const game = makeGame();
    game.saveData.materials = { timber: 50, stone: 50, iron: 50, crystal: 50, aether: 50 };
    brewPotion(game.saveData, { type: 'apothecary', level: 1 }, 'Minor Health Potion');
    brewPotion(game.saveData, { type: 'apothecary', level: 1 }, 'Minor Health Potion');
    chooseBlessing(game.saveData, { type: 'shrine', level: 1 }, 'vigor');
    startFloor(game);
    const potions = [...game.player.inventory, ...game.player.belt.filter(Boolean)].filter(i => i.name === 'Minor Health Potion');
    expect(potions.reduce((n, p) => n + (p.count || 1), 0)).toBe(2);
    expect(game.saveData.brewedPotions).toEqual([]);
    expect(game.saveData.preRunBlessing).toBeNull();
    expect(game.runBlessing.id).toBe('vigor');
    expect(game.treePassiveEffects.max_hp_mult).toBeCloseTo(1.15);
    const unblessed = makeGame();
    startFloor(unblessed);
    expect(game.player.maxHp).toBeGreaterThan(unblessed.player.maxHp);
  });

  it('haste blessing raises the player speed', () => {
    const game = makeGame();
    game.saveData.materials.aether = 10;
    chooseBlessing(game.saveData, { type: 'shrine', level: 1 }, 'haste');
    startFloor(game);
    expect(game.player.speed).toBe(110);
  });

  it('farm income is paid when a run ends', () => {
    const game = makeGame();
    game.saveData.materials.timber = 30;
    placeBuilding(game.saveData, buildTownMap(), 'farm', 5, 10);
    startFloor(game);
    const before = game.saveData.materials.timber;
    finalizeRun(game, 'Leech');
    expect(game.saveData.materials.timber).toBe(before + 4);
    expect(game.townIncomeNotice).toMatch(/Farm/);
  });
});

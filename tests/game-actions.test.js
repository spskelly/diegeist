import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../src/game-map.js';
import { Entity } from '../src/entity.js';
import { TurnSystem } from '../src/turn-system.js';
import { MessageLog } from '../src/message-log.js';
import { createPlayer } from '../src/player.js';
import { createTreeActiveSkills, resolvePassiveEffects } from '../src/skill-tree.js';
import { updateActiveSkills } from '../src/skills.js';
import { createEmptyMaterials } from '../src/resources.js';
import { computeFOV } from '../src/fov.js';
import { TILE, FOV_RADIUS, SKILL_SLOT_COUNT } from '../src/constants.js';
import { addFloatingText } from '../src/game-utils.js';
import { SaveData } from '../src/progression.js';
import {
  useTreeSkill,
  handleSkillAction,
  handlePlayerDeath,
  processEnemyTurn,
  processPlayerAction,
  runBossMechanic,
  handleEnemyDeath,
  resolveCombat,
  applyConsumable,
} from '../src/game-actions.js';

// a minimal but real game object: open 20x20 room, player in the middle
function makeGame(classKey = 'fighter', investments = {}) {
  const map = new GameMap(20, 20);
  for (let y = 1; y < 19; y++) for (let x = 1; x < 19; x++) map.setTile(x, y, TILE.FLOOR);
  map.rooms = [{ x: 1, y: 1, width: 18, height: 18, type: 'start' }];
  const player = createPlayer(classKey, 10, 10, {}, 1);
  const game = {
    state: 'playing',
    map,
    player,
    turnSystem: new TurnSystem(),
    messageLog: new MessageLog(),
    turnCount: 0,
    floorNumber: 1,
    currentRank: 1,
    runMaterials: createEmptyMaterials(),
    runSummary: { classKey, floorsReached: 1, enemiesKilled: 0, currencyEarned: 0, causeOfDeath: null },
    combatVfx: { floatingTexts: [], projectiles: [] },
    saveData: null,
    audio: null,
    corpses: [],
    deathSaveUsedThisFloor: false,
    treePassiveEffects: resolvePassiveEffects(classKey, investments),
    captureRunItemsForHub() {},
  };
  player.treeActiveSkills = createTreeActiveSkills(classKey, investments);
  map.entities.push(player);
  game.turnSystem.addEntity(player);
  updateActiveSkills(player);
  computeFOV(map, player.position.x, player.position.y, FOV_RADIUS);
  return game;
}

function addEnemy(game, x, y, overrides = {}) {
  const e = new Entity({
    id: `enemy_${x}_${y}`, type: 'enemy', x, y,
    stats: { STR: 3, DEX: 0, CON: 4, INT: 1, WIS: 1, LCK: 0 },
    maxHp: 40, speed: 100, behavior: 'rushdown', name: 'Leech', ...overrides,
  });
  Object.assign(e, overrides);
  game.map.entities.push(e);
  game.turnSystem.addEntity(e);
  return e;
}

function treeSkill(game, name) {
  return game.player.treeActiveSkills.find(s => s.name === name);
}

describe('floating text stacking', () => {
  it('stacks texts that land on the same tile', () => {
    const game = makeGame();
    addFloatingText(game, 3, 3, 'a');
    addFloatingText(game, 3, 3, 'b');
    addFloatingText(game, 4, 3, 'c');
    const [a, b, c] = game.combatVfx.floatingTexts;
    expect(a.stackIndex).toBe(0);
    expect(b.stackIndex).toBe(1);
    expect(c.stackIndex).toBe(0);
  });
});

describe('skill tree actives', () => {
  it('berserker rage applies the berserk status', () => {
    const game = makeGame('fighter', { fighter_heavy_strike: 1, fighter_conditioning: 2, fighter_cleave: 2, fighter_berserker_rage: 1 });
    const skill = treeSkill(game, 'Berserker Rage');
    expect(useTreeSkill(game, skill)).toBe(true);
    const effect = game.player.hasStatusEffect('berserk');
    expect(effect.value).toBe(1.4);
    expect(effect.defenseReduction).toBe(0.2);
    expect(skill.currentCooldown).toBe(15);
  });

  it('rush dashes to an enemy in a straight line and hits it', () => {
    const game = makeGame('fighter', { fighter_rush: 2 });
    const enemy = addEnemy(game, 13, 10);
    const skill = treeSkill(game, 'Rush');
    expect(useTreeSkill(game, skill)).toBe(true);
    expect(game.player.position).toEqual({ x: 12, y: 10 });
    expect(enemy.hp).toBeLessThan(40);
  });

  it('rush fails without a target and does not go on cooldown', () => {
    const game = makeGame('fighter', { fighter_rush: 1 });
    const skill = treeSkill(game, 'Rush');
    expect(useTreeSkill(game, skill)).toBe(false);
    expect(skill.currentCooldown).toBe(0);
  });

  it('war shout slows every visible enemy and slowed enemies gain energy slower', () => {
    const game = makeGame('fighter', { fighter_rush: 1, fighter_war_shout: 2 });
    const a = addEnemy(game, 12, 10);
    const b = addEnemy(game, 10, 14);
    expect(useTreeSkill(game, treeSkill(game, 'War Shout'))).toBe(true);
    expect(a.hasStatusEffect('slowed').value).toBe(0.25);
    expect(b.getEffectiveSpeed()).toBe(75);
  });

  it('deadeye forces crits on the next ranged attacks and then expires', () => {
    const game = makeGame('archer', { archer_steady_aim: 1, archer_eagle_eye: 2, archer_piercing_shot: 2, archer_lethal_focus: 1, archer_deadeye: 1 });
    game.player.equipment.leftHand = { id: 'bow', name: 'Bow', type: 'weapon', slot: 'leftHand', attackType: 'ranged', statBonuses: {}, skill: null };
    updateActiveSkills(game.player);
    expect(useTreeSkill(game, treeSkill(game, 'Deadeye'))).toBe(true);
    expect(game.player.hasStatusEffect('deadeye').value).toBe(3);
    for (let i = 0; i < 3; i++) {
      const enemy = addEnemy(game, 14 + i, 10, { maxHp: 999 });
      const result = resolveCombat(game, game.player, enemy, { baseDamage: 10, damageType: 'ranged', weaponMultiplier: 1, forceDodge: false });
      expect(result.crit).toBe(true);
    }
    expect(game.player.hasStatusEffect('deadeye')).toBeNull();
  });

  it('disengage leaps away from the nearest enemy', () => {
    const game = makeGame('archer', { archer_evasion: 1, archer_disengage: 2 });
    addEnemy(game, 11, 10);
    expect(useTreeSkill(game, treeSkill(game, 'Disengage'))).toBe(true);
    const dist = Math.abs(game.player.position.x - 11) + Math.abs(game.player.position.y - 10);
    expect(dist).toBeGreaterThanOrEqual(3);
  });

  it('shadow step makes enemies wander and the breaking attack crits', () => {
    const game = makeGame('archer', { archer_evasion: 1, archer_disengage: 2, archer_quick_recovery: 1, archer_vital_strike: 1, archer_shadow_step: 1 });
    const enemy = addEnemy(game, 11, 10, { maxHp: 999 });
    expect(useTreeSkill(game, treeSkill(game, 'Shadow Step'))).toBe(true);
    expect(game.player.hasStatusEffect('invisible')).not.toBeNull();
    processEnemyTurn(game, enemy);
    // a rushdown enemy next to a visible player would have attacked; it wandered instead
    expect(game.player.hp).toBe(game.player.maxHp);
    const result = resolveCombat(game, game.player, enemy, { baseDamage: 10, damageType: 'melee', weaponMultiplier: 1, forceDodge: false });
    expect(result.crit).toBe(true);
    expect(game.player.hasStatusEffect('invisible')).toBeNull();
  });

  it('caltrops slow adjacent enemies only', () => {
    const game = makeGame('archer', { archer_trap_mastery: 1, archer_caltrops: 1 });
    const near = addEnemy(game, 11, 11);
    const far = addEnemy(game, 14, 10);
    expect(useTreeSkill(game, treeSkill(game, 'Caltrops'))).toBe(true);
    expect(near.hasStatusEffect('slowed').value).toBe(0.3);
    expect(far.hasStatusEffect('slowed')).toBeNull();
  });

  it('meteor damages a 3x3 area around the nearest enemy', () => {
    const game = makeGame('mage', { mage_arcane_power: 1, mage_mana_surge: 2, mage_chain_lightning: 2, mage_overcharge: 1, mage_meteor: 1 });
    const a = addEnemy(game, 13, 10, { maxHp: 500 });
    const b = addEnemy(game, 14, 11, { maxHp: 500 });
    const c = addEnemy(game, 17, 10, { maxHp: 500 });
    const hpBefore = game.player.hp;
    expect(useTreeSkill(game, treeSkill(game, 'Meteor'), game.treePassiveEffects.cooldown_reduction)).toBe(true);
    expect(a.hp).toBeLessThan(500);
    expect(b.hp).toBeLessThan(500);
    expect(c.hp).toBe(500);
    // overcharge costs hp and mana surge shortens the cooldown
    expect(game.player.hp).toBeLessThan(hpBefore);
    expect(treeSkill(game, 'Meteor').currentCooldown).toBe(25 - game.treePassiveEffects.cooldown_reduction);
  });

  it('temporal stasis stuns visible enemies and the stun wears off', () => {
    const game = makeGame('mage', { mage_arcane_barrier: 2, mage_mana_shield: 1, mage_counterspell: 1, mage_temporal_stasis: 1 });
    const enemy = addEnemy(game, 11, 10);
    expect(useTreeSkill(game, treeSkill(game, 'Temporal Stasis'))).toBe(true);
    expect(enemy.hasStatusEffect('stunned').turnsRemaining).toBe(2);
    enemy.tickStatusEffects();
    enemy.tickStatusEffects();
    expect(enemy.hasStatusEffect('stunned')).toBeNull();
  });

  it('enchant buffs equipped gear once per floor', () => {
    const game = makeGame('mage', { mage_transmutation: 1, mage_enchant: 2 });
    game.player.equipment.leftHand = { id: 'w', name: 'Wand', type: 'weapon', slot: 'leftHand', attackType: 'magic', statBonuses: { INT: 2, CON: 1 }, skill: null };
    const skill = treeSkill(game, 'Enchant');
    expect(useTreeSkill(game, skill)).toBe(true);
    expect(game.player.equipment.leftHand.statBonuses.INT).toBe(6);
    expect(skill.currentCooldown).toBeGreaterThan(100);
  });

  it('tree actives are usable through the hotbar', () => {
    const game = makeGame('fighter', { fighter_rush: 1 });
    addEnemy(game, 12, 10);
    const slot = game.player.activeSkills.findIndex(s => s && s.name === 'Rush');
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThan(SKILL_SLOT_COUNT);
    expect(handleSkillAction(game, slot)).toBe(true);
  });
});

describe('wired passives', () => {
  it('unbreakable saves the player once per floor', () => {
    const game = makeGame('fighter', { fighter_iron_hide: 1, fighter_shield_wall: 2, fighter_regeneration: 2, fighter_unbreakable: 1 });
    game.player.hp = 0;
    expect(handlePlayerDeath(game, 'test')).toBe(false);
    expect(game.player.hp).toBe(1);
    expect(game.state).toBe('playing');
    game.player.hp = 0;
    game.saveData = null;
    expect(handlePlayerDeath(game, 'test')).toBe(true);
    expect(game.state).toBe('deathSplash');
  });

  it('tactical advance primes an attack after stepping next to an enemy', () => {
    const game = makeGame('fighter', { fighter_vigilance: 2, fighter_tactical_advance: 1 });
    addEnemy(game, 12, 10);
    processPlayerAction(game, { type: 'move', dx: 1, dy: 0 });
    expect(game.player.hasStatusEffect('tactical').value).toBe(0.15);
  });

  it('ambush predator multiplies damage against unaware enemies', () => {
    const game = makeGame('archer', { archer_trap_mastery: 1, archer_caltrops: 1, archer_scavenger: 2, archer_salvage: 1, archer_ambush_predator: 1 });
    const unaware = addEnemy(game, 11, 10, { maxHp: 999 });
    const aware = addEnemy(game, 9, 10, { maxHp: 999, alerted: true });
    const r1 = resolveCombat(game, game.player, unaware, { baseDamage: 10, damageType: 'melee', weaponMultiplier: 1, forceCrit: false, forceDodge: false });
    const r2 = resolveCombat(game, game.player, aware, { baseDamage: 10, damageType: 'melee', weaponMultiplier: 1, forceCrit: false, forceDodge: false });
    expect(r1.damage).toBeGreaterThanOrEqual(r2.damage * 2);
    expect(unaware.alerted).toBe(true);
  });

  it('enemies become aware when they act in the player\'s sight', () => {
    const game = makeGame();
    const enemy = addEnemy(game, 14, 10);
    expect(enemy.alerted).toBeUndefined();
    processEnemyTurn(game, enemy);
    expect(enemy.alerted).toBe(true);
  });

  it('material bonus and drop rate bonus are read on kill', () => {
    const game = makeGame('mage', { mage_transmutation: 3 });
    const enemy = addEnemy(game, 11, 10);
    enemy.hp = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      game.runMaterials = createEmptyMaterials();
      handleEnemyDeath(game, enemy);
      total += game.runMaterials.timber;
    }
    // with a 40% drop chance, 40 kills essentially always yield something
    expect(total).toBeGreaterThan(0);
    expect(game.corpses.length).toBe(40);
  });

  it('potion healing multiplier boosts heal potions', () => {
    const game = makeGame('archer', { archer_quick_recovery: 3 });
    game.player.hp = 1;
    applyConsumable(game, { name: 'Minor Health Potion', effect: 'heal', magnitude: 0.25 });
    expect(game.player.hp - 1).toBe(Math.floor(game.player.maxHp * 0.25 * 1.3));
  });

  it('invisibility potion hides the player', () => {
    const game = makeGame();
    applyConsumable(game, { name: 'Invisibility Potion', effect: 'invisibility', magnitude: 8 });
    expect(game.player.hasStatusEffect('invisible').turnsRemaining).toBe(8);
  });
});

describe('boss mechanics', () => {
  function addBoss(game, key, overrides = {}) {
    // the player must not dodge, or hp assertions become random
    game.player.stats.DEX = 0;
    return addEnemy(game, 12, 10, { name: key, isFloorBoss: true, bossKey: key, maxHp: 400, ...overrides });
  }

  it('brood mother enrages below 25% hp', () => {
    const game = makeGame();
    const boss = addBoss(game, 'brood_mother', { speed: 80, behavior: 'summoner' });
    boss.hp = 50;
    expect(runBossMechanic(game, boss)).toBe(false);
    expect(boss.speed).toBe(104);
    expect(boss.enrageStage).toBe(1);
    runBossMechanic(game, boss);
    expect(boss.speed).toBe(104);
  });

  it('rat king throws his crown every fourth turn when close', () => {
    const game = makeGame();
    const boss = addBoss(game, 'rat_king', { stats: { STR: 10, DEX: 0, CON: 10, INT: 4, WIS: 4, LCK: 0 } });
    boss.position = { x: 11, y: 11 };
    const hp = game.player.hp;
    expect(runBossMechanic(game, boss)).toBe(false);
    expect(runBossMechanic(game, boss)).toBe(false);
    expect(runBossMechanic(game, boss)).toBe(false);
    expect(runBossMechanic(game, boss)).toBe(true);
    expect(game.player.hp).toBeLessThan(hp);
  });

  it('bone lord raises nearby corpses', () => {
    const game = makeGame();
    const boss = addBoss(game, 'bone_lord', { summonTemplate: { name: 'Skeleton', spriteKey: 'skeleton', stats: { STR: 5, DEX: 4, CON: 4, INT: 2, WIS: 2, LCK: 2 }, maxHp: 28 } });
    game.corpses = [{ x: 14, y: 12, name: 'Zombie' }];
    expect(runBossMechanic(game, boss)).toBe(true);
    const risen = game.map.entities.find(e => e.name === 'Bone Minion');
    expect(risen.position).toEqual({ x: 14, y: 12 });
    expect(game.corpses).toHaveLength(0);
    expect(runBossMechanic(game, boss)).toBe(false);
    // a risen minion does not leave a corpse, so the boss cannot loop forever
    risen.hp = 0;
    handleEnemyDeath(game, risen);
    expect(game.corpses).toHaveLength(0);
  });

  it('void tyrant charges down a clear straight line and enrages by hp', () => {
    const game = makeGame();
    const boss = addBoss(game, 'void_tyrant', { speed: 125, stats: { STR: 15, DEX: 0, CON: 16, INT: 12, WIS: 10, LCK: 0 } });
    boss.position = { x: 14, y: 10 };
    const hp = game.player.hp;
    expect(runBossMechanic(game, boss)).toBe(true);
    expect(boss.position).toEqual({ x: 11, y: 10 });
    expect(game.player.hp).toBeLessThan(hp);
    boss.hp = 100;
    runBossMechanic(game, boss);
    expect(boss.enrageStage).toBe(2);
    expect(boss.speed).toBe(143);
  });

  it('the first kill of a boss drops its building blueprint', () => {
    const game = makeGame();
    game.saveData = new SaveData();
    const boss = addBoss(game, 'brood_mother');
    boss.hp = 0;
    handleEnemyDeath(game, boss);
    expect(game.saveData.blueprints).toEqual(['forge']);
    expect(game.messageLog.messages.some(m => /Blueprint found: Forge/.test(m.text))).toBe(true);
    const again = addBoss(game, 'brood_mother', { id: 'boss2' });
    again.hp = 0;
    handleEnemyDeath(game, again);
    expect(game.saveData.blueprints).toEqual(['forge']);
  });
});

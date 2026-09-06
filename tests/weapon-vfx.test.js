import { describe, it, expect } from 'vitest';
import { Entity } from '../src/entity.js';
import { createPlayer } from '../src/player.js';
import { SPRITE_DEFINITIONS } from '../src/sprites.js';
import { createStarterWeapon } from '../src/items.js';
import {
  addWeaponSwing,
  addHitFeedback,
  getWeaponSpriteKey,
  getSwingPose,
  updateCombatVfx,
  clearCombatVfx,
  SWING_STYLE_BY_SPRITE,
  CAST_GLOW_BY_SPRITE,
} from '../src/game-utils.js';
import { getEntityVfxOffset, isHitFlashActive } from '../src/renderer.js';

function makeGame() {
  return { combatVfx: { floatingTexts: [], projectiles: [], swings: [] } };
}

// createPlayer leaves the hands empty; the run setup equips the starter weapon
function makeArmedPlayer(classKey) {
  const player = createPlayer(classKey, 1, 1);
  const weapon = createStarterWeapon(classKey);
  player.equipment[weapon.slot] = weapon;
  return player;
}

function makeEnemy(x, y) {
  return new Entity({ id: 'e1', type: 'enemy', x, y, stats: {}, maxHp: 10, speed: 100, name: 'Rat' });
}

describe('weapon sprite lookup', () => {
  it('has a sprite definition for every swing style key', () => {
    for (const key of Object.keys(SWING_STYLE_BY_SPRITE)) {
      expect(SPRITE_DEFINITIONS[key]).toBeDefined();
    }
    for (const key of Object.keys(CAST_GLOW_BY_SPRITE)) {
      expect(SWING_STYLE_BY_SPRITE[key]).toBe('cast');
    }
  });

  it('maps starter weapons to the right sprites', () => {
    expect(getWeaponSpriteKey(makeArmedPlayer('fighter'), 'melee')).toBe('weapon_sword');
    expect(getWeaponSpriteKey(makeArmedPlayer('archer'), 'ranged')).toBe('weapon_longbow');
    expect(getWeaponSpriteKey(makeArmedPlayer('mage'), 'magic')).toBe('weapon_wand');
  });

  it('prefers the most specific base name in a generated item name', () => {
    const player = createPlayer('archer', 1, 1);
    player.equipment.leftHand = { name: 'Heavy Crossbow of Sparks' };
    expect(getWeaponSpriteKey(player, 'ranged')).toBe('weapon_crossbow');
    player.equipment.leftHand = { name: 'Brutal Greataxe' };
    expect(getWeaponSpriteKey(player, 'melee')).toBe('weapon_greataxe');
    player.equipment.leftHand = { name: 'Gnarled Staff' };
    expect(getWeaponSpriteKey(player, 'magic')).toBe('weapon_staff');
  });

  it('falls back by damage type and attacker kind when unarmed', () => {
    const player = createPlayer('fighter', 1, 1);
    player.equipment.leftHand = null;
    expect(getWeaponSpriteKey(player, 'melee')).toBe('weapon_fist');
    const enemy = makeEnemy(2, 2);
    expect(getWeaponSpriteKey(enemy, 'melee')).toBe('weapon_claw');
    expect(getWeaponSpriteKey(enemy, 'ranged')).toBe('weapon_longbow');
    expect(getWeaponSpriteKey(enemy, 'magic')).toBe('weapon_wand');
  });
});

describe('addWeaponSwing', () => {
  it('records a swing with a unit direction and lunges the attacker', () => {
    const game = makeGame();
    const player = makeArmedPlayer('fighter');
    const enemy = makeEnemy(4, 5);
    const swing = addWeaponSwing(game, player, enemy, 'melee');
    expect(game.combatVfx.swings).toHaveLength(1);
    expect(swing.spriteKey).toBe('weapon_sword');
    expect(swing.style).toBe('slash');
    expect(swing.source).toBe('player');
    expect(Math.hypot(swing.dirX, swing.dirY)).toBeCloseTo(1, 5);
    expect(swing.dirX).toBeGreaterThan(0);
    expect(swing.dirY).toBeGreaterThan(0);
    expect(player.vfxLunge.amount).toBeGreaterThan(0);
  });

  it('lazily creates the swings list and recoils shooters instead of lunging', () => {
    const game = { combatVfx: { floatingTexts: [], projectiles: [] } };
    const archer = makeArmedPlayer('archer');
    const swing = addWeaponSwing(game, archer, makeEnemy(5, 1), 'ranged');
    expect(swing.style).toBe('shoot');
    expect(archer.vfxLunge.amount).toBeLessThan(0);
    expect(game.combatVfx.swings).toHaveLength(1);
  });

  it('collapses several hits from one position in the same frame into one swing', () => {
    const game = makeGame();
    const player = createPlayer('fighter', 1, 1);
    const first = addWeaponSwing(game, player, makeEnemy(2, 1), 'melee');
    const second = addWeaponSwing(game, player, makeEnemy(1, 2), 'melee');
    expect(second).toBe(first);
    expect(game.combatVfx.swings).toHaveLength(1);
  });

  it('is pruned by updateCombatVfx and cleared by clearCombatVfx', () => {
    const game = makeGame();
    const player = createPlayer('fighter', 1, 1);
    const swing = addWeaponSwing(game, player, makeEnemy(2, 1), 'melee');
    updateCombatVfx(game, swing.startMs + swing.durationMs - 1);
    expect(game.combatVfx.swings).toHaveLength(1);
    updateCombatVfx(game, swing.startMs + swing.durationMs + 1);
    expect(game.combatVfx.swings).toHaveLength(0);
    addWeaponSwing(game, player, makeEnemy(2, 1), 'melee');
    clearCombatVfx(game);
    expect(game.combatVfx.swings).toHaveLength(0);
  });

  it('ignores missing attackers or targets', () => {
    const game = makeGame();
    expect(addWeaponSwing(game, null, makeEnemy(1, 1))).toBeNull();
    expect(addWeaponSwing(game, makeEnemy(1, 1), null)).toBeNull();
    expect(game.combatVfx.swings).toHaveLength(0);
  });
});

describe('getSwingPose', () => {
  const styles = ['slash', 'chop', 'thrust', 'bash', 'shoot', 'cast', 'unknown'];

  it('returns finite poses that fade out by the end for every style', () => {
    for (const style of styles) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const pose = getSwingPose(style, t);
        for (const key of ['offset', 'angle', 'scale', 'alpha', 'glow']) {
          expect(Number.isFinite(pose[key])).toBe(true);
        }
        expect(pose.alpha).toBeGreaterThanOrEqual(0);
        expect(pose.alpha).toBeLessThanOrEqual(1);
      }
      expect(getSwingPose(style, 0).alpha).toBe(1);
      expect(getSwingPose(style, 1).alpha).toBe(0);
    }
  });

  it('sweeps slashes and chops through an arc and pushes thrusts outward', () => {
    expect(getSwingPose('slash', 0).angle).toBeLessThan(0);
    expect(getSwingPose('slash', 1).angle).toBeGreaterThan(0);
    expect(getSwingPose('chop', 0).angle).toBeLessThan(getSwingPose('chop', 1).angle);
    expect(getSwingPose('thrust', 0.5).offset).toBeGreaterThan(getSwingPose('thrust', 0).offset);
    expect(getSwingPose('cast', 0.5).glow).toBeGreaterThan(0);
    expect(getSwingPose('cast', 0).glow).toBe(0);
  });

  it('clamps progress outside the unit range', () => {
    expect(getSwingPose('slash', -1)).toEqual(getSwingPose('slash', 0));
    expect(getSwingPose('slash', 2)).toEqual(getSwingPose('slash', 1));
  });
});

describe('renderer vfx windows', () => {
  it('nudges a lunging entity toward its target at the midpoint and not at the ends', () => {
    const enemy = makeEnemy(3, 3);
    enemy.vfxLunge = { dx: 1, dy: 0, amount: 0.3, startMs: 1000, durationMs: 200 };
    expect(getEntityVfxOffset(enemy, 1100).dx).toBeCloseTo(0.3, 5);
    expect(getEntityVfxOffset(enemy, 1100).dy).toBe(0);
    expect(getEntityVfxOffset(enemy, 1000).dx).toBeCloseTo(0, 5);
    expect(getEntityVfxOffset(enemy, 1200)).toEqual({ dx: 0, dy: 0 });
    expect(getEntityVfxOffset(enemy, null)).toEqual({ dx: 0, dy: 0 });
    expect(getEntityVfxOffset({}, 1100)).toEqual({ dx: 0, dy: 0 });
  });

  it('treats a lunge that starts in the future as expired', () => {
    const enemy = makeEnemy(3, 3);
    enemy.vfxLunge = { dx: 0, dy: 1, amount: 0.3, startMs: 5000, durationMs: 200 };
    expect(getEntityVfxOffset(enemy, 100)).toEqual({ dx: 0, dy: 0 });
  });

  it('flashes a defender after a landed hit but not after a dodge', () => {
    const game = makeGame();
    const enemy = makeEnemy(3, 3);
    addHitFeedback(game, enemy, { damage: 5, crit: false, dodged: false }, 'player');
    expect(enemy.vfxHit).toBeDefined();
    expect(isHitFlashActive(enemy, enemy.vfxHit.startMs + 10)).toBe(true);
    expect(isHitFlashActive(enemy, enemy.vfxHit.startMs + enemy.vfxHit.durationMs)).toBe(false);
    const other = makeEnemy(4, 4);
    addHitFeedback(game, other, { damage: 0, crit: false, dodged: true }, 'player');
    expect(other.vfxHit).toBeUndefined();
    expect(isHitFlashActive(other, 100)).toBe(false);
  });
});

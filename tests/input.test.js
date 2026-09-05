import { describe, it, expect } from 'vitest';
import { mapKeyToAction, classifyPointerGesture, SWIPE_MIN_DISTANCE } from '../src/input.js';
import { findRegion, registerRegion, clearRegions, rowSelectAction, rowConfirmAction } from '../src/ui.js';

describe('mapKeyToAction', () => {
  it('maps arrow keys to movement', () => {
    expect(mapKeyToAction('ArrowUp')).toEqual({ type: 'move', dx: 0, dy: -1 });
    expect(mapKeyToAction('ArrowDown')).toEqual({ type: 'move', dx: 0, dy: 1 });
    expect(mapKeyToAction('ArrowLeft')).toEqual({ type: 'move', dx: -1, dy: 0 });
    expect(mapKeyToAction('ArrowRight')).toEqual({ type: 'move', dx: 1, dy: 0 });
  });

  it('maps WASD to attack', () => {
    expect(mapKeyToAction('w')).toEqual({ type: 'attack', dx: 0, dy: -1 });
    expect(mapKeyToAction('s')).toEqual({ type: 'attack', dx: 0, dy: 1 });
    expect(mapKeyToAction('a')).toEqual({ type: 'attack', dx: -1, dy: 0 });
    expect(mapKeyToAction('d')).toEqual({ type: 'attack', dx: 1, dy: 0 });
  });

  it('maps wait keys', () => {
    expect(mapKeyToAction(' ')).toEqual({ type: 'wait' });
    expect(mapKeyToAction('.')).toEqual({ type: 'wait' });
  });

  it('maps inventory key', () => {
    expect(mapKeyToAction('i')).toEqual({ type: 'inventory' });
    expect(mapKeyToAction('Tab')).toEqual({ type: 'inventoryTab' });
  });

  it('maps belt keys', () => {
    expect(mapKeyToAction('1')).toEqual({ type: 'belt', slot: 0 });
    expect(mapKeyToAction('2')).toEqual({ type: 'belt', slot: 1 });
    expect(mapKeyToAction('3')).toEqual({ type: 'belt', slot: 2 });
  });

  it('maps skill keys', () => {
    expect(mapKeyToAction('q')).toEqual({ type: 'skill', slot: 0 });
    expect(mapKeyToAction('e')).toEqual({ type: 'skill', slot: 1 });
    expect(mapKeyToAction('r')).toEqual({ type: 'skill', slot: 2 });
    expect(mapKeyToAction('f')).toEqual({ type: 'skill', slot: 3 });
  });

  it('maps pickup key', () => {
    expect(mapKeyToAction('g')).toEqual({ type: 'pickup' });
  });

  it('maps hub key', () => {
    expect(mapKeyToAction('h')).toEqual({ type: 'hub' });
  });

  it('maps descend key', () => {
    expect(mapKeyToAction('>')).toEqual({ type: 'descend' });
  });

  it('maps escape', () => {
    expect(mapKeyToAction('Escape')).toEqual({ type: 'close' });
  });

  it('returns null for unmapped keys', () => {
    expect(mapKeyToAction('F1')).toBeNull();
    expect(mapKeyToAction('~')).toBeNull();
  });

  it('maps inventory overlay action keys', () => {
    expect(mapKeyToAction('Enter')).toEqual({ type: 'inventoryConfirm' });
    expect(mapKeyToAction('z')).toEqual({ type: 'inventoryConfirm' });
    expect(mapKeyToAction('x')).toEqual({ type: 'inventoryDrop' });
    expect(mapKeyToAction('c')).toEqual({ type: 'inventoryBelt' });
    expect(mapKeyToAction('u')).toEqual({ type: 'inventoryUnequip' });
    expect(mapKeyToAction('p')).toEqual({ type: 'stats' });
  });
});

describe('classifyPointerGesture', () => {
  it('treats a short press as a tap at the release point', () => {
    expect(classifyPointerGesture({ x: 10, y: 10 }, { x: 14, y: 12 }, 120)).toEqual({ type: 'tap', x: 14, y: 12 });
  });

  it('turns a long drag into a four-way swipe', () => {
    expect(classifyPointerGesture({ x: 0, y: 0 }, { x: SWIPE_MIN_DISTANCE + 5, y: 3 })).toEqual({ type: 'swipe', dx: 1, dy: 0 });
    expect(classifyPointerGesture({ x: 0, y: 0 }, { x: -2, y: -40 })).toEqual({ type: 'swipe', dx: 0, dy: -1 });
  });

  it('ignores a press held too long to be a tap', () => {
    expect(classifyPointerGesture({ x: 0, y: 0 }, { x: 1, y: 1 }, 2000)).toBeNull();
  });
});

describe('hit regions', () => {
  it('returns the topmost region under a point', () => {
    const game = {};
    clearRegions(game);
    registerRegion(game, 0, 0, 100, 100, { type: 'a' });
    registerRegion(game, 40, 40, 20, 20, { type: 'b' });
    expect(findRegion(game.ui.regions, 50, 50).action).toEqual({ type: 'b' });
    expect(findRegion(game.ui.regions, 5, 5).action).toEqual({ type: 'a' });
    expect(findRegion(game.ui.regions, 500, 5)).toBeNull();
    clearRegions(game);
    expect(game.ui.regions).toHaveLength(0);
  });

  it('row actions select first and confirm on the second tap', () => {
    const game = { pauseMenuIndex: 0 };
    const select = rowSelectAction('pauseMenuIndex', 2);
    expect(select(game)).toBeNull();
    expect(game.pauseMenuIndex).toBe(2);
    expect(select(game)).toEqual({ type: 'inventoryConfirm' });
    const confirm = rowConfirmAction('pauseMenuIndex', 1, { type: 'wait' });
    expect(confirm(game)).toEqual({ type: 'wait' });
    expect(game.pauseMenuIndex).toBe(1);
  });
});

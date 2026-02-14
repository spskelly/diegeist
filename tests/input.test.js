import { describe, it, expect } from 'vitest';
import { mapKeyToAction } from '../src/input.js';

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

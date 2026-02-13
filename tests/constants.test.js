import { describe, it, expect } from 'vitest';
import { TILE, TILE_SIZE, ENERGY_THRESHOLD, PLAYER_CLASSES, BASE_SPEED, STAT_NAMES, SOFT_GATE_MULTIPLIER, FOV_RADIUS, RARITY, EQUIPMENT_SLOTS } from '../src/constants.js';

describe('Constants', () => {
  it('defines all tile types with correct IDs', () => {
    expect(TILE.WALL).toBe(0);
    expect(TILE.FLOOR).toBe(1);
    expect(TILE.CORRIDOR).toBe(2);
    expect(TILE.DOOR).toBe(3);
    expect(TILE.STAIRS_DOWN).toBe(4);
    expect(TILE.WATER).toBe(5);
    expect(TILE.TRAP).toBe(6);
  });

  it('defines tile properties for each type', () => {
    expect(TILE.properties[TILE.WALL].walkable).toBe(false);
    expect(TILE.properties[TILE.WALL].blocksLOS).toBe(true);
    expect(TILE.properties[TILE.FLOOR].walkable).toBe(true);
    expect(TILE.properties[TILE.FLOOR].blocksLOS).toBe(false);
    expect(TILE.properties[TILE.DOOR].walkable).toBe(true);
    expect(TILE.properties[TILE.CORRIDOR].walkable).toBe(true);
    expect(TILE.properties[TILE.STAIRS_DOWN].walkable).toBe(true);
    expect(TILE.properties[TILE.TRAP].walkable).toBe(true);
    expect(TILE.properties[TILE.TRAP].blocksLOS).toBe(false);
  });

  it('has a 16px tile size', () => {
    expect(TILE_SIZE).toBe(16);
  });

  it('defines energy threshold for turns', () => {
    expect(ENERGY_THRESHOLD).toBe(100);
  });

  it('defines base speed', () => {
    expect(BASE_SPEED).toBe(100);
  });

  it('defines FOV radius', () => {
    expect(FOV_RADIUS).toBe(8);
  });

  it('defines soft gate multiplier', () => {
    expect(SOFT_GATE_MULTIPLIER).toBe(0.65);
  });

  it('defines all three player classes with base stats', () => {
    expect(PLAYER_CLASSES.fighter.baseStats.STR).toBe(8);
    expect(PLAYER_CLASSES.fighter.baseStats.DEX).toBe(5);
    expect(PLAYER_CLASSES.fighter.baseStats.CON).toBe(7);
    expect(PLAYER_CLASSES.fighter.baseStats.INT).toBe(2);
    expect(PLAYER_CLASSES.fighter.baseStats.WIS).toBe(3);
    expect(PLAYER_CLASSES.fighter.baseStats.LCK).toBe(5);
    expect(PLAYER_CLASSES.archer.baseStats.DEX).toBe(8);
    expect(PLAYER_CLASSES.archer.baseStats.LCK).toBe(6);
    expect(PLAYER_CLASSES.mage.baseStats.INT).toBe(8);
    expect(PLAYER_CLASSES.mage.baseStats.WIS).toBe(7);
    expect(PLAYER_CLASSES.fighter.baseHp).toBe(15);
    expect(PLAYER_CLASSES.archer.baseHp).toBe(10);
    expect(PLAYER_CLASSES.mage.baseHp).toBe(10);
  });

  it('defines class affinity stats', () => {
    expect(PLAYER_CLASSES.fighter.affinityStats).toContain('STR');
    expect(PLAYER_CLASSES.fighter.affinityStats).toContain('CON');
    expect(PLAYER_CLASSES.archer.affinityStats).toContain('DEX');
    expect(PLAYER_CLASSES.mage.affinityStats).toContain('INT');
  });

  it('defines stat names array', () => {
    expect(STAT_NAMES).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'LCK']);
  });

  it('defines rarity levels', () => {
    expect(RARITY.COMMON).toBe('common');
    expect(RARITY.UNCOMMON).toBe('uncommon');
    expect(RARITY.RARE).toBe('rare');
    expect(RARITY.EPIC).toBe('epic');
    expect(RARITY.LEGENDARY).toBe('legendary');
  });

  it('defines equipment slots', () => {
    expect(EQUIPMENT_SLOTS).toEqual(['head', 'torso', 'legs', 'leftHand', 'rightHand', 'accessory1', 'accessory2']);
  });
});

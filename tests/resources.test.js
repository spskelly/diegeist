import { describe, it, expect } from 'vitest';
import {
  MATERIALS,
  BIOME_MATERIALS,
  rollMaterialDrop,
  getFloorClearMaterials,
  getBossKillMaterials,
  createEmptyMaterials,
  addMaterials,
  scaleMaterials,
} from '../src/resources.js';

describe('MATERIALS', () => {
  it('defines 5 material types', () => {
    expect(MATERIALS).toEqual(['timber', 'stone', 'iron', 'crystal', 'aether']);
  });
});

describe('BIOME_MATERIALS', () => {
  it('maps each biome to a primary material', () => {
    expect(BIOME_MATERIALS.wilds.primary).toBe('timber');
    expect(BIOME_MATERIALS.cave.primary).toBe('stone');
    expect(BIOME_MATERIALS.dungeon.primary).toBe('iron');
    expect(BIOME_MATERIALS.eldritch.primary).toBe('crystal');
  });
});

describe('createEmptyMaterials', () => {
  it('returns an object with all materials at 0', () => {
    const m = createEmptyMaterials();
    expect(m).toEqual({ timber: 0, stone: 0, iron: 0, crystal: 0, aether: 0 });
  });

  it('returns a new object each call', () => {
    const a = createEmptyMaterials();
    const b = createEmptyMaterials();
    expect(a).not.toBe(b);
  });
});

describe('addMaterials', () => {
  it('adds source materials to target in place', () => {
    const target = { timber: 5, stone: 0, iron: 0, crystal: 0, aether: 0 };
    const source = { timber: 3, stone: 2, iron: 0, crystal: 0, aether: 0 };
    addMaterials(target, source);
    expect(target.timber).toBe(8);
    expect(target.stone).toBe(2);
  });
});

describe('scaleMaterials', () => {
  it('multiplies all values by factor and rounds up', () => {
    const m = { timber: 5, stone: 3, iron: 1, crystal: 0, aether: 0 };
    const result = scaleMaterials(m, 0.5);
    expect(result.timber).toBe(3); // ceil(2.5)
    expect(result.stone).toBe(2); // ceil(1.5)
    expect(result.iron).toBe(1);  // ceil(0.5)
    expect(result.crystal).toBe(0);
    expect(result.aether).toBe(0);
  });
});

describe('rollMaterialDrop', () => {
  it('returns null when roll exceeds drop chance', () => {
    // forceRoll = 0.99 should always miss the 40% base chance
    const result = rollMaterialDrop('wilds', 1, { forceRoll: 0.99 });
    expect(result).toBeNull();
  });

  it('returns a material drop when roll is under drop chance', () => {
    // low ranks still have a small secondary chance, so pin that roll too
    const result = rollMaterialDrop('wilds', 1, { forceRoll: 0.1, forceQtyRoll: 0.5, forceSecondaryRoll: 0.99 });
    expect(result).not.toBeNull();
    expect(result.type).toBe('timber');
    expect(result.quantity).toBeGreaterThanOrEqual(1);
    expect(result.quantity).toBeLessThanOrEqual(2);
  });

  it('scales quantity with rank', () => {
    // At rank 5, quantity range is 1-2 * (1 + 4*0.35) = 2.4× → range ~2-5
    const result = rollMaterialDrop('wilds', 5, { forceRoll: 0.1, forceQtyRoll: 0.99 });
    expect(result.quantity).toBeGreaterThanOrEqual(2);
  });

  it('can return secondary material at rank 3+', () => {
    // Force secondary roll to hit (under 0.15)
    const result = rollMaterialDrop('wilds', 3, {
      forceRoll: 0.1,
      forceQtyRoll: 0.5,
      forceSecondaryRoll: 0.05,
    });
    expect(result.type).toBe('stone'); // wilds secondary
  });
});

describe('getFloorClearMaterials', () => {
  it('returns biome primary material with quantity 3-5 at rank 1', () => {
    const result = getFloorClearMaterials('wilds', 1, 0.5);
    expect(result.type).toBe('timber');
    expect(result.quantity).toBeGreaterThanOrEqual(3);
    expect(result.quantity).toBeLessThanOrEqual(5);
  });

  it('scales quantity with rank', () => {
    const r1 = getFloorClearMaterials('wilds', 1, 0.5);
    const r5 = getFloorClearMaterials('wilds', 5, 0.5);
    expect(r5.quantity).toBeGreaterThan(r1.quantity);
  });
});

describe('getBossKillMaterials', () => {
  it('always includes aether', () => {
    const results = getBossKillMaterials('wilds', 1, 0.5);
    const aether = results.find(r => r.type === 'aether');
    expect(aether).toBeDefined();
    expect(aether.quantity).toBeGreaterThanOrEqual(2);
    expect(aether.quantity).toBeLessThanOrEqual(4);
  });

  it('includes biome primary material', () => {
    const results = getBossKillMaterials('wilds', 1, 0.5);
    const primary = results.find(r => r.type === 'timber');
    expect(primary).toBeDefined();
  });
});

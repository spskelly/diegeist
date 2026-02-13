import { describe, it, expect } from 'vitest';
import { Camera } from '../src/camera.js';
import { TILE_SIZE } from '../src/constants.js';

describe('Camera', () => {
  it('creates a camera with viewport dimensions in tiles', () => {
    const cam = new Camera(800, 600);
    expect(cam.viewportWidth).toBe(Math.floor(800 / TILE_SIZE));
    expect(cam.viewportHeight).toBe(Math.floor(600 / TILE_SIZE));
  });

  it('centers on a target position', () => {
    const cam = new Camera(320, 320); // 20x20 tile viewport
    cam.centerOn(25, 25, 50, 50);
    expect(cam.x).toBe(15);
    expect(cam.y).toBe(15);
  });

  it('clamps to top-left map edge', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(5, 5, 50, 50);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });

  it('clamps to bottom-right map edge', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(45, 45, 50, 50);
    expect(cam.x).toBe(30);
    expect(cam.y).toBe(30);
  });

  it('converts tile coords to screen pixel coords', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(25, 25, 50, 50);
    const { sx, sy } = cam.tileToScreen(17, 17);
    expect(sx).toBe((17 - 15) * TILE_SIZE);
    expect(sy).toBe((17 - 15) * TILE_SIZE);
  });

  it('determines if a tile is within the viewport', () => {
    const cam = new Camera(320, 320); // 20x20 viewport
    cam.centerOn(25, 25, 50, 50); // cam at 15,15 -> shows 15..34
    expect(cam.isInView(15, 15)).toBe(true);
    expect(cam.isInView(34, 34)).toBe(true);
    expect(cam.isInView(14, 15)).toBe(false);
    expect(cam.isInView(35, 15)).toBe(false);
  });

  it('resizes viewport when canvas dimensions change', () => {
    const cam = new Camera(320, 320);
    expect(cam.viewportWidth).toBe(20);
    cam.resize(480, 320);
    expect(cam.viewportWidth).toBe(30);
    expect(cam.viewportHeight).toBe(20);
  });

  it('handles small maps where viewport is larger than map', () => {
    const cam = new Camera(320, 320); // 20x20 viewport
    cam.centerOn(5, 5, 10, 10); // map is only 10x10
    // Camera should clamp to 0,0 since map is smaller than viewport
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });
});

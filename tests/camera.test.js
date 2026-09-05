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

  it('keeps the target centered near the top-left map edge', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(5, 5, 50, 50);
    // the player stays in the middle of the screen; the camera may point off-map
    expect(cam.x).toBe(-5);
    expect(cam.y).toBe(-5);
  });

  it('keeps the target centered near the bottom-right map edge', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(45, 45, 50, 50);
    expect(cam.x).toBe(35);
    expect(cam.y).toBe(35);
  });

  it('converts tile coords to screen pixel coords', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(25, 25, 50, 50);
    const { sx, sy } = cam.tileToScreen(17, 17);
    expect(sx).toBe((17 - 15) * TILE_SIZE);
    expect(sy).toBe((17 - 15) * TILE_SIZE);
  });

  it('converts screen pixel coords back to tile coords', () => {
    const cam = new Camera(320, 320);
    cam.centerOn(25, 25, 50, 50);
    const { sx, sy } = cam.tileToScreen(17, 17);
    expect(cam.screenToTile(sx + 3, sy + 3)).toEqual({ x: 17, y: 17 });
    expect(cam.screenToTile(sx + TILE_SIZE, sy)).toEqual({ x: 18, y: 17 });
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

  it('centers small maps inside a larger viewport', () => {
    const cam = new Camera(320, 320); // 20x20 viewport
    cam.centerOn(5, 5, 10, 10); // map is only 10x10
    // a 10-wide map in a 20-wide viewport gets 5 tiles of margin on each side
    expect(cam.x).toBe(-5);
    expect(cam.y).toBe(-5);
    expect(cam.tileToScreen(0, 0)).toEqual({ sx: 5 * TILE_SIZE, sy: 5 * TILE_SIZE });
  });

  it('supports fractional zoom levels', () => {
    const cam = new Camera(480, 480, 1.5);
    expect(cam.tileSize).toBe(24);
    expect(cam.viewportWidth).toBe(20);
  });
});

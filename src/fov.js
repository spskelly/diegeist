// Field of View using raycasting
// Casts rays from origin in all directions to determine visible tiles
// Simple and correct — performance is fine for radius <= 12

export function computeFOV(map, originX, originY, radius) {
  map.clearVisibility();
  map.setVisible(originX, originY, true);
  map.setExplored(originX, originY, true);

  // Cast rays in all directions (1 ray per degree is more than enough)
  const numRays = 360;
  for (let i = 0; i < numRays; i++) {
    const angle = (2 * Math.PI * i) / numRays;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    castRay(map, originX, originY, radius, dx, dy);
  }
}

function castRay(map, ox, oy, radius, dx, dy) {
  let x = ox + 0.5;
  let y = oy + 0.5;

  for (let step = 0; step < radius * 2; step++) {
    x += dx * 0.5;
    y += dy * 0.5;
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    // Skip if we've gone beyond radius
    const distSq = (tileX - ox) * (tileX - ox) + (tileY - oy) * (tileY - oy);
    if (distSq > radius * radius) break;

    // Mark this tile as visible and explored
    map.setVisible(tileX, tileY, true);
    map.setExplored(tileX, tileY, true);

    // Stop the ray if this tile blocks line of sight
    if (map.blocksLOS(tileX, tileY)) break;
  }
}

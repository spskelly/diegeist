// src/pathfinding.js
// A* pathfinding on the tile grid (4-directional movement)

export function findPath(map, startX, startY, goalX, goalY, blockedPositions = []) {
  if (startX === goalX && startY === goalY) return [];

  const blockedSet = new Set(blockedPositions.map(p => `${p.x},${p.y}`));

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  const key = (x, y) => `${x},${y}`;
  const h = (x, y) => Math.abs(x - goalX) + Math.abs(y - goalY);

  const startKey = key(startX, startY);
  gScore.set(startKey, 0);
  fScore.set(startKey, h(startX, startY));
  openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });

  const closedSet = new Set();

  while (openSet.length > 0) {
    // Get node with lowest fScore
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currentKey = key(current.x, current.y);

    if (current.x === goalX && current.y === goalY) {
      // Reconstruct path
      const path = [];
      let ck = currentKey;
      while (cameFrom.has(ck)) {
        const [x, y] = ck.split(',').map(Number);
        path.unshift({ x, y });
        ck = cameFrom.get(ck);
      }
      return path;
    }

    closedSet.add(currentKey);

    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const neighbor of neighbors) {
      const nKey = key(neighbor.x, neighbor.y);
      if (closedSet.has(nKey)) continue;
      if (!map.isWalkable(neighbor.x, neighbor.y)) continue;
      if (blockedSet.has(nKey) && !(neighbor.x === goalX && neighbor.y === goalY)) continue;

      const tentG = gScore.get(currentKey) + 1;

      if (!gScore.has(nKey) || tentG < gScore.get(nKey)) {
        cameFrom.set(nKey, currentKey);
        gScore.set(nKey, tentG);
        const f = tentG + h(neighbor.x, neighbor.y);
        fScore.set(nKey, f);
        if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
          openSet.push({ x: neighbor.x, y: neighbor.y, f });
        }
      }
    }
  }

  return null; // No path found
}

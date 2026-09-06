import { TILE_SIZE } from './constants.js';

// Palette-parameterized tile sprite factories for biome theming
function makeWallDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(1, 1, 14, 6);
    ctx.fillRect(0, 8, 7, 6);
    ctx.fillRect(8, 8, 8, 6);
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);
  };
}

function makeFloorDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(2, 2, 2, 2);
    ctx.fillRect(10, 6, 2, 2);
    ctx.fillRect(5, 12, 2, 2);
  };
}

function makeCorridorDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(4, 4, 1, 1);
    ctx.fillRect(11, 9, 1, 1);
  };
}

function makeDoorDraw(floorP, doorP) {
  return function(ctx) {
    ctx.fillStyle = floorP.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = doorP.frame;
    ctx.fillRect(3, 2, 10, 12);
    ctx.fillStyle = doorP.panel;
    ctx.fillRect(4, 3, 8, 10);
    ctx.fillStyle = doorP.knob;
    ctx.fillRect(10, 7, 2, 2);
  };
}

function makeDoorOpenDraw(floorP, doorP) {
  return function(ctx) {
    ctx.fillStyle = floorP.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = doorP.frame;
    ctx.fillRect(2, 2, 2, 12);
    ctx.fillRect(12, 2, 2, 12);
    ctx.fillStyle = doorP.panel;
    ctx.fillRect(3, 2, 1, 12);
    ctx.fillRect(12, 2, 1, 12);
    ctx.fillStyle = doorP.interior;
    ctx.fillRect(5, 2, 6, 12);
  };
}

function makeStairsDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.steps;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(2 + i * 2, 4 + i * 3, 12 - i * 4, 2);
    }
  };
}

function makeWaterDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.wave;
    ctx.fillRect(2, 4, 5, 1);
    ctx.fillRect(9, 8, 5, 1);
    ctx.fillRect(3, 12, 4, 1);
  };
}

function makeTrapDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.markings;
    ctx.fillRect(4, 4, 8, 1);
    ctx.fillRect(4, 11, 8, 1);
    ctx.fillRect(4, 4, 1, 8);
    ctx.fillRect(11, 4, 1, 8);
    ctx.fillRect(7, 6, 2, 4);
  };
}

// Town tile sprite factories
function makeGrassDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(3, 3, 2, 1);
    ctx.fillRect(10, 7, 2, 1);
    ctx.fillRect(6, 12, 2, 1);
    ctx.fillRect(12, 2, 1, 2);
    ctx.fillStyle = p.accent;
    ctx.fillRect(7, 5, 1, 2);
    ctx.fillRect(1, 10, 1, 2);
  };
}

function makeTownPathDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(2, 3, 3, 2);
    ctx.fillRect(9, 10, 4, 2);
    ctx.fillStyle = p.border;
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
  };
}

function makeTownWaterDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.wave;
    ctx.fillRect(1, 4, 6, 1);
    ctx.fillRect(8, 9, 6, 1);
    ctx.fillRect(3, 13, 5, 1);
    ctx.fillStyle = p.foam;
    ctx.fillRect(2, 5, 2, 1);
    ctx.fillRect(10, 10, 2, 1);
  };
}

function makeTownRockDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(1, 2, 14, 12);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(3, 4, 10, 8);
    ctx.fillStyle = p.highlight;
    ctx.fillRect(4, 3, 5, 2);
    ctx.fillRect(2, 6, 3, 2);
  };
}

function makeHillDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(2, 2, 2, 2);
    ctx.fillRect(10, 6, 2, 2);
    ctx.fillRect(5, 11, 2, 2);
    ctx.fillStyle = p.contour;
    ctx.fillRect(0, 8, 16, 1);
    ctx.fillRect(4, 4, 8, 1);
  };
}

function makeShelterDraw(p) {
  return function(ctx) {
    ctx.fillStyle = p.walls;
    ctx.fillRect(1, 4, 14, 11);
    ctx.fillStyle = p.roof;
    ctx.fillRect(0, 0, 16, 5);
    ctx.fillRect(1, 1, 14, 3);
    ctx.fillStyle = p.door;
    ctx.fillRect(6, 8, 4, 7);
  };
}

function makeShelterEntranceDraw(grassP, shelterP) {
  return function(ctx) {
    ctx.fillStyle = grassP.primary;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = shelterP.door;
    ctx.fillRect(5, 0, 6, 3);
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(7, 7, 2, 2);
  };
}

export function buildTownTileSprites(palette) {
  return {
    town_grass:     { size: TILE_SIZE, draw: makeGrassDraw(palette.grass) },
    town_path:      { size: TILE_SIZE, draw: makeTownPathDraw(palette.path) },
    town_water:     { size: TILE_SIZE, draw: makeTownWaterDraw(palette.water) },
    town_rock:      { size: TILE_SIZE, draw: makeTownRockDraw(palette.rock) },
    town_hill:      { size: TILE_SIZE, draw: makeHillDraw(palette.hill) },
    town_shelter:   { size: TILE_SIZE, draw: makeShelterDraw(palette.shelter) },
    town_shelter_entrance: { size: TILE_SIZE, draw: makeShelterEntranceDraw(palette.grass, palette.shelter) },
    town_building:  { size: TILE_SIZE, draw: makeShelterDraw(palette.building || palette.shelter) },
    town_building_entrance: { size: TILE_SIZE, draw: makeShelterEntranceDraw(palette.grass, palette.building || palette.shelter) },
  };
}

export function buildBiomeTileSprites(palette) {
  return {
    wall:        { size: TILE_SIZE, draw: makeWallDraw(palette.wall) },
    floor:       { size: TILE_SIZE, draw: makeFloorDraw(palette.floor) },
    corridor:    { size: TILE_SIZE, draw: makeCorridorDraw(palette.corridor) },
    door:        { size: TILE_SIZE, draw: makeDoorDraw(palette.floor, palette.door) },
    door_open:   { size: TILE_SIZE, draw: makeDoorOpenDraw(palette.floor, palette.door_open) },
    stairs_down: { size: TILE_SIZE, draw: makeStairsDraw(palette.stairs) },
    water:       { size: TILE_SIZE, draw: makeWaterDraw(palette.water) },
    trap:        { size: TILE_SIZE, draw: makeTrapDraw(palette.trap) },
  };
}

export const SPRITE_DEFINITIONS = {
  wall: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(1, 1, 14, 6);
      ctx.fillRect(0, 8, 7, 6);
      ctx.fillRect(8, 8, 8, 6);
      ctx.strokeStyle = '#151525';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
    },
  },
  floor: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#353545';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(10, 6, 2, 2);
      ctx.fillRect(5, 12, 2, 2);
    },
  },
  corridor: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#33333f';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#2e2e3a';
      ctx.fillRect(4, 4, 1, 1);
      ctx.fillRect(11, 9, 1, 1);
    },
  },
  door: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(3, 2, 10, 12);
      ctx.fillStyle = '#a07818';
      ctx.fillRect(4, 3, 8, 10);
      ctx.fillStyle = '#c8a000';
      ctx.fillRect(10, 7, 2, 2);
    },
  },
  door_open: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(2, 2, 2, 12);
      ctx.fillRect(12, 2, 2, 12);
      ctx.fillStyle = '#a07818';
      ctx.fillRect(3, 2, 1, 12);
      ctx.fillRect(12, 2, 1, 12);
      ctx.fillStyle = '#2d2d38';
      ctx.fillRect(5, 2, 6, 12);
    },
  },
  stairs_down: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#666';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(2 + i * 2, 4 + i * 3, 12 - i * 4, 2);
      }
    },
  },
  player_fighter: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#b03030';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(12, 3, 2, 8);
      ctx.fillStyle = '#a08030';
      ctx.fillRect(11, 8, 4, 2);
    },
  },
  player_archer: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#2a7030';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(13, 8, 5, -1.2, 1.2);
      ctx.stroke();
    },
  },
  player_mage: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3030a0';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(6, 1, 4, 4);
      ctx.fillStyle = '#3030a0';
      ctx.fillRect(5, 0, 6, 2);
      ctx.fillRect(7, -1, 2, 1);
      ctx.fillStyle = '#604020';
      ctx.fillRect(5, 12, 3, 3);
      ctx.fillRect(8, 12, 3, 3);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(13, 1, 1, 14);
      ctx.fillStyle = '#40d0ff';
      ctx.fillRect(12, 0, 3, 2);
    },
  },
  water: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#1a2a5a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#2a3a6a';
      ctx.fillRect(2, 4, 5, 1);
      ctx.fillRect(9, 8, 5, 1);
      ctx.fillRect(3, 12, 4, 1);
    },
  },
  trap: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#804040';
      ctx.fillRect(4, 4, 8, 1);
      ctx.fillRect(4, 11, 8, 1);
      ctx.fillRect(4, 4, 1, 8);
      ctx.fillRect(11, 4, 1, 8);
      ctx.fillRect(7, 6, 2, 4);
    },
  },
  arrow_projectile: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#d6b35c';
      ctx.fillRect(4, 7, 8, 2);
      ctx.fillStyle = '#f0d388';
      ctx.fillRect(11, 6, 3, 4);
      ctx.fillStyle = '#80624a';
      ctx.fillRect(2, 6, 2, 4);
      ctx.fillRect(1, 5, 1, 6);
    },
  },
  arcbolt_projectile: {
    size: TILE_SIZE,
    draw(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#3ce0ff';
      ctx.fillRect(7, 2, 2, 4);
      ctx.fillRect(5, 5, 2, 4);
      ctx.fillRect(8, 6, 2, 4);
      ctx.fillRect(6, 9, 2, 4);
      ctx.fillRect(8, 10, 2, 4);
      ctx.fillStyle = '#9ff3ff';
      ctx.fillRect(7, 4, 2, 2);
      ctx.fillRect(7, 8, 2, 2);
    },
  },
  bat: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#2b2f44';
      ctx.fillRect(2, 7, 5, 3);
      ctx.fillRect(9, 7, 5, 3);
      ctx.fillStyle = '#3e4663';
      ctx.fillRect(5, 6, 6, 4);
      ctx.fillStyle = '#252a3a';
      ctx.fillRect(6, 10, 4, 2);
      ctx.fillStyle = '#d84a4a';
      ctx.fillRect(7, 7, 1, 1);
      ctx.fillRect(9, 7, 1, 1);
    },
  },
  cultist: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#4a2b62';
      ctx.fillRect(5, 5, 6, 8);
      ctx.fillStyle = '#2d193b';
      ctx.fillRect(4, 8, 8, 5);
      ctx.fillStyle = '#d2b48c';
      ctx.fillRect(6, 3, 4, 3);
      ctx.fillStyle = '#6f4a8a';
      ctx.fillRect(5, 2, 6, 2);
      ctx.fillStyle = '#9a73b4';
      ctx.fillRect(7, 8, 2, 3);
    },
  },
  boss_tyrant: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#2b1a1a';
      ctx.fillRect(2, 4, 12, 10);
      ctx.fillStyle = '#4a2b2b';
      ctx.fillRect(1, 8, 14, 6);
      ctx.fillStyle = '#d9c7a0';
      ctx.fillRect(5, 2, 6, 4);
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(4, 0, 8, 2);
      ctx.fillRect(3, 1, 2, 2);
      ctx.fillRect(11, 1, 2, 2);
      ctx.fillStyle = '#ff5c5c';
      ctx.fillRect(6, 3, 1, 1);
      ctx.fillRect(9, 3, 1, 1);
      ctx.fillStyle = '#9f2b2b';
      ctx.fillRect(4, 11, 3, 3);
      ctx.fillRect(9, 11, 3, 3);
    },
  },
  rat: {
    size: 16,
    draw(ctx) {
      ctx.fillStyle = '#8b6040';
      ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = '#6b4030';
      ctx.fillRect(5, 5, 3, 2);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(5, 6, 1, 1);
      ctx.fillRect(7, 6, 1, 1);
      ctx.fillStyle = '#8b6040';
      ctx.fillRect(2, 10, 2, 3);
      ctx.fillRect(10, 10, 2, 3);
      ctx.fillStyle = '#a07050';
      ctx.fillRect(11, 8, 4, 1);
    },
  },
  leech: {
    size: 16,
    draw(ctx) {
      // Dark green segmented body
      ctx.fillStyle = '#2a4a20';
      ctx.fillRect(6, 3, 4, 10);
      ctx.fillStyle = '#1a3a15';
      ctx.fillRect(7, 2, 2, 2);
      // Segments
      ctx.fillStyle = '#3a5a30';
      ctx.fillRect(6, 6, 4, 1);
      ctx.fillRect(6, 9, 4, 1);
      // Tail
      ctx.fillStyle = '#2a4a20';
      ctx.fillRect(7, 13, 2, 2);
      // Eyes
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(6, 3, 1, 1);
      ctx.fillRect(9, 3, 1, 1);
    },
  },
  slime: {
    size: 16,
    draw(ctx) {
      // Blob body
      ctx.fillStyle = '#30a040';
      ctx.fillRect(3, 6, 10, 8);
      ctx.fillStyle = '#40c050';
      ctx.fillRect(4, 7, 8, 6);
      // Top dome
      ctx.fillStyle = '#20802e';
      ctx.fillRect(5, 4, 6, 3);
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 8, 2, 2);
      ctx.fillRect(9, 8, 2, 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(6, 9, 1, 1);
      ctx.fillRect(10, 9, 1, 1);
    },
  },
  skeleton: {
    size: 16,
    draw(ctx) {
      // Skull
      ctx.fillStyle = '#d0d0c0';
      ctx.fillRect(5, 1, 6, 5);
      // Eye sockets
      ctx.fillStyle = '#000';
      ctx.fillRect(6, 3, 2, 1);
      ctx.fillRect(9, 3, 2, 1);
      // Ribcage
      ctx.fillStyle = '#b0b0a0';
      ctx.fillRect(6, 6, 4, 5);
      ctx.fillStyle = '#d0d0c0';
      ctx.fillRect(5, 7, 1, 1);
      ctx.fillRect(10, 7, 1, 1);
      ctx.fillRect(5, 9, 1, 1);
      ctx.fillRect(10, 9, 1, 1);
      // Arms
      ctx.fillStyle = '#c0c0b0';
      ctx.fillRect(3, 7, 2, 4);
      ctx.fillRect(11, 7, 2, 4);
      // Legs
      ctx.fillStyle = '#b0b0a0';
      ctx.fillRect(6, 11, 2, 4);
      ctx.fillRect(9, 11, 2, 4);
    },
  },
  skeleton_archer: {
    size: 16,
    draw(ctx) {
      // Skull
      ctx.fillStyle = '#d0d0c0';
      ctx.fillRect(5, 1, 6, 5);
      // Eye sockets (red tint)
      ctx.fillStyle = '#802020';
      ctx.fillRect(6, 3, 2, 1);
      ctx.fillRect(9, 3, 2, 1);
      // Ribcage
      ctx.fillStyle = '#b0b0a0';
      ctx.fillRect(6, 6, 4, 5);
      ctx.fillStyle = '#d0d0c0';
      ctx.fillRect(5, 7, 1, 1);
      ctx.fillRect(10, 7, 1, 1);
      ctx.fillRect(5, 9, 1, 1);
      ctx.fillRect(10, 9, 1, 1);
      // Left arm (drawing bow)
      ctx.fillStyle = '#c0c0b0';
      ctx.fillRect(3, 7, 2, 3);
      // Right arm (extended holding bow)
      ctx.fillRect(12, 6, 2, 2);
      // Bow (right side)
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(14, 4, 1, 8);
      ctx.fillStyle = '#c0a040';
      ctx.fillRect(15, 5, 1, 1);
      ctx.fillRect(15, 10, 1, 1);
      // Bowstring
      ctx.fillStyle = '#e0d0b0';
      ctx.fillRect(13, 5, 1, 6);
      // Quiver on back
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(2, 6, 1, 5);
      ctx.fillStyle = '#c08040';
      ctx.fillRect(2, 5, 1, 1);
      // Legs
      ctx.fillStyle = '#b0b0a0';
      ctx.fillRect(6, 11, 2, 4);
      ctx.fillRect(9, 11, 2, 4);
    },
  },
  zombie: {
    size: 16,
    draw(ctx) {
      // Head (greenish skin)
      ctx.fillStyle = '#5a7a5a';
      ctx.fillRect(5, 1, 6, 5);
      // Eyes
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(6, 3, 1, 1);
      ctx.fillRect(9, 3, 1, 1);
      // Body (tattered clothes)
      ctx.fillStyle = '#4a5a3a';
      ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = '#3a4a2a';
      ctx.fillRect(5, 8, 6, 4);
      // Arms (reaching forward)
      ctx.fillStyle = '#5a7a5a';
      ctx.fillRect(2, 6, 2, 5);
      ctx.fillRect(12, 6, 2, 5);
      // Legs
      ctx.fillStyle = '#4a5a3a';
      ctx.fillRect(5, 12, 2, 3);
      ctx.fillRect(9, 12, 2, 3);
    },
  },
  demon: {
    size: 16,
    draw(ctx) {
      // Horns
      ctx.fillStyle = '#8b1a1a';
      ctx.fillRect(4, 0, 2, 3);
      ctx.fillRect(10, 0, 2, 3);
      // Head
      ctx.fillStyle = '#c04040';
      ctx.fillRect(5, 2, 6, 4);
      // Eyes (yellow)
      ctx.fillStyle = '#ff0';
      ctx.fillRect(6, 3, 1, 1);
      ctx.fillRect(9, 3, 1, 1);
      // Body
      ctx.fillStyle = '#8b1a1a';
      ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = '#6b0a0a';
      ctx.fillRect(5, 8, 6, 4);
      // Wings (small)
      ctx.fillStyle = '#5a0a0a';
      ctx.fillRect(1, 6, 3, 4);
      ctx.fillRect(12, 6, 3, 4);
      // Legs
      ctx.fillStyle = '#6b0a0a';
      ctx.fillRect(5, 12, 2, 3);
      ctx.fillRect(9, 12, 2, 3);
    },
  },
  boss_brood_mother: {
    size: 16,
    draw(ctx) {
      // Large insectoid body
      ctx.fillStyle = '#1a4a10';
      ctx.fillRect(2, 4, 12, 10);
      ctx.fillStyle = '#2a6a20';
      ctx.fillRect(3, 5, 10, 8);
      // Segments
      ctx.fillStyle = '#1a4a10';
      ctx.fillRect(3, 7, 10, 1);
      ctx.fillRect(3, 10, 10, 1);
      // Head
      ctx.fillStyle = '#2a5a1a';
      ctx.fillRect(5, 1, 6, 4);
      // Mandibles
      ctx.fillStyle = '#4a8a30';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(10, 4, 2, 2);
      // Eyes (many)
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(6, 2, 1, 1);
      ctx.fillRect(8, 2, 1, 1);
      ctx.fillRect(7, 3, 1, 1);
      ctx.fillRect(9, 2, 1, 1);
      // Legs
      ctx.fillStyle = '#1a4a10';
      ctx.fillRect(1, 6, 1, 3);
      ctx.fillRect(14, 6, 1, 3);
      ctx.fillRect(1, 10, 1, 3);
      ctx.fillRect(14, 10, 1, 3);
    },
  },
  boss_rat_king: {
    size: 16,
    draw(ctx) {
      // Large rat body
      ctx.fillStyle = '#7a5030';
      ctx.fillRect(3, 5, 10, 8);
      ctx.fillStyle = '#6b4025';
      ctx.fillRect(4, 4, 6, 3);
      // Crown
      ctx.fillStyle = '#d4a020';
      ctx.fillRect(4, 1, 8, 3);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(5, 0, 2, 2);
      ctx.fillRect(7, 0, 2, 1);
      ctx.fillRect(9, 0, 2, 2);
      // Eyes
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(5, 5, 2, 1);
      ctx.fillRect(8, 5, 2, 1);
      // Claws
      ctx.fillStyle = '#7a5030';
      ctx.fillRect(1, 8, 2, 4);
      ctx.fillRect(13, 8, 2, 4);
      // Tail
      ctx.fillStyle = '#a07050';
      ctx.fillRect(12, 10, 4, 1);
      // Legs
      ctx.fillStyle = '#6b4025';
      ctx.fillRect(4, 13, 3, 2);
      ctx.fillRect(9, 13, 3, 2);
    },
  },
  boss_bone_lord: {
    size: 16,
    draw(ctx) {
      // Skull with crown
      ctx.fillStyle = '#e0e0d0';
      ctx.fillRect(4, 1, 8, 5);
      // Crown
      ctx.fillStyle = '#6060c0';
      ctx.fillRect(4, 0, 8, 2);
      ctx.fillStyle = '#8080e0';
      ctx.fillRect(5, -1, 2, 2);
      ctx.fillRect(9, -1, 2, 2);
      // Eye sockets (glowing)
      ctx.fillStyle = '#4040ff';
      ctx.fillRect(5, 3, 2, 2);
      ctx.fillRect(9, 3, 2, 2);
      // Armored ribcage
      ctx.fillStyle = '#c0c0b0';
      ctx.fillRect(4, 6, 8, 5);
      ctx.fillStyle = '#8080a0';
      ctx.fillRect(5, 7, 6, 1);
      ctx.fillRect(5, 9, 6, 1);
      // Shoulder armor
      ctx.fillStyle = '#6060a0';
      ctx.fillRect(2, 6, 2, 3);
      ctx.fillRect(12, 6, 2, 3);
      // Arms
      ctx.fillStyle = '#c0c0b0';
      ctx.fillRect(2, 9, 2, 3);
      ctx.fillRect(12, 9, 2, 3);
      // Legs
      ctx.fillStyle = '#b0b0a0';
      ctx.fillRect(5, 11, 2, 4);
      ctx.fillRect(9, 11, 2, 4);
    },
  },
};

export const TILE_SPRITE_MAP = {
  0: 'wall',
  1: 'floor',
  2: 'corridor',
  3: 'door',
  4: 'stairs_down',
  5: 'water',
  6: 'trap',
  7: 'door_open',
  100: 'town_grass',
  101: 'town_path',
  102: 'town_water',
  103: 'town_rock',
  104: 'town_hill',
  105: 'town_shelter',
  106: 'town_shelter_entrance',
  107: 'town_building',
  108: 'town_building_entrance',
};

export class SpriteRegistry {
  constructor() {
    this.cache = {};
  }

  init() {
    for (const [key, def] of Object.entries(SPRITE_DEFINITIONS)) {
      const canvas = document.createElement('canvas');
      canvas.width = def.size;
      canvas.height = def.size;
      const ctx = canvas.getContext('2d');
      def.draw(ctx);
      this.cache[key] = canvas;
    }
  }

  setBiome(biomePalette) {
    const tileSprites = buildBiomeTileSprites(biomePalette);
    for (const [key, def] of Object.entries(tileSprites)) {
      const canvas = document.createElement('canvas');
      canvas.width = def.size;
      canvas.height = def.size;
      const ctx = canvas.getContext('2d');
      def.draw(ctx);
      this.cache[key] = canvas;
    }
  }

  setTown(townPalette) {
    const tileSprites = buildTownTileSprites(townPalette);
    for (const [key, def] of Object.entries(tileSprites)) {
      const canvas = document.createElement('canvas');
      canvas.width = def.size;
      canvas.height = def.size;
      const ctx = canvas.getContext('2d');
      def.draw(ctx);
      this.cache[key] = canvas;
    }
  }

  get(key) {
    return this.cache[key] || null;
  }
}

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE_ORDER = [
  'constants.js',
  'game-map.js',
  'entity.js',
  'player.js',
  'turn-system.js',
  'camera.js',
  'fov.js',
  'pathfinding.js',
  'combat.js',
  'ai.js',
  'dungeon-gen.js',
  'message-log.js',
  'input.js',
  'sprites.js',
  'renderer.js',
  'hud.js',
  'game.js',
];

function stripImportsExports(code) {
  return code
    .replace(/^import\s+.*?;\s*$/gm, '')
    .replace(/^export\s+(default\s+)?/gm, '')
    .trim();
}

function build() {
  const template = readFileSync(join(__dirname, 'template.html'), 'utf-8');

  let combinedCode = '';
  for (const file of SOURCE_ORDER) {
    const code = readFileSync(join(__dirname, 'src', file), 'utf-8');
    combinedCode += `// --- ${file} ---\n` + stripImportsExports(code) + '\n\n';
  }

  const output = template.replace('// {{GAME_CODE}}', combinedCode);

  mkdirSync(join(__dirname, 'dist'), { recursive: true });
  writeFileSync(join(__dirname, 'dist', 'diegeist.html'), output);
  console.log('Built dist/diegeist.html (' + Math.round(output.length / 1024) + ' KB)');
}

build();

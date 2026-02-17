import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE_ORDER = [
  'constants.js',
  'resources.js',
  'skill-tree.js',
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
  'items.js',
  'inventory.js',
  'skills.js',
  'progression.js',
  'message-log.js',
  'input.js',
  'sprites.js',
  'renderer.js',
  'hud.js',
  'audio.js',
  'game-utils.js',
  'game-save.js',
  'game-actions.js',
  'game-floor.js',
  'game-screens.js',
  'game.js',
];

function stripImportsExports(code) {
  return code
    .replace(/^\s*import[\s\S]*?;\s*$/gm, '')
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
  const dist = join(__dirname, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'diegeist.html'), output);
  console.log('Built dist/diegeist.html (' + Math.round(output.length / 1024) + ' KB)');

  // PWA: icon — a die face on black
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="64" fill="#000"/>
<rect x="56" y="56" width="400" height="400" rx="48" fill="none" stroke="#888" stroke-width="12"/>
<circle cx="152" cy="152" r="32" fill="#ccc"/>
<circle cx="360" cy="152" r="32" fill="#ccc"/>
<circle cx="256" cy="256" r="32" fill="#ccc"/>
<circle cx="152" cy="360" r="32" fill="#ccc"/>
<circle cx="360" cy="360" r="32" fill="#ccc"/>
</svg>`;
  writeFileSync(join(dist, 'icon.svg'), icon);

  // PWA: manifest
  const manifest = {
    name: 'Diegeist',
    short_name: 'Diegeist',
    start_url: './diegeist.html',
    scope: './',
    display: 'fullscreen',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
  writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // PWA: service worker — version keyed to build time so updates bust the cache
  const cacheVersion = `diegeist-${Date.now()}`;
  const sw = `const CACHE = '${cacheVersion}';
const ASSETS = ['./diegeist.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
`;
  writeFileSync(join(dist, 'sw.js'), sw);
  console.log('Built dist/sw.js + dist/manifest.json');
}

build();

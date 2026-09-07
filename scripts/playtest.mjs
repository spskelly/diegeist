#!/usr/bin/env node
// headless playtest: builds dist/, serves it, and drives the real game in
// chromium with keyboard, mouse and touch. a bot explores floors with god-mode
// hp so deep floors, bosses and the victory flow get exercised. the run fails
// on any page error, console error, or if the bot cannot make progress.
//
//   npm run playtest                 # default: 900 turns, fighter
//   npm run playtest -- archer 2500  # class and turn budget
//   PLAYTEST_CHROMIUM=/path/to/chrome npm run playtest
//
// requires the playwright package; install a browser with
//   npx playwright install --with-deps chromium

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const classKey = process.argv[2] || 'fighter';
const maxTurns = parseInt(process.argv[3] || '900', 10);
const shotDir = process.env.PLAYTEST_SHOTS || '';
const problems = [];
const say = (s) => console.log(s);

// --- build ---
const build = spawnSync(process.execPath, [join(root, 'build.js')], { stdio: 'inherit' });
if (build.status !== 0) { console.error('build failed'); process.exit(1); }

// --- serve dist/ with window.__game exposed on the debug copy ---
const dist = join(root, 'dist');
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf-8').replace('game.init();', 'window.__game = game; game.init();');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(indexHtml); return; }
  const file = join(dist, url);
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const { chromium } = await import('playwright');
const launchOpts = process.env.PLAYTEST_CHROMIUM ? { executablePath: process.env.PLAYTEST_CHROMIUM } : {};
const browser = await chromium.launch(launchOpts);
if (shotDir) mkdirSync(shotDir, { recursive: true });

function watch(page, label) {
  page.on('pageerror', e => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return; // favicon and similar
    problems.push(`[${label}] console.error: ${m.text()}`);
  });
}

async function frames(page, n = 2) {
  await page.evaluate((n) => new Promise(r => { let i = 0; const step = () => (++i >= n ? r() : requestAnimationFrame(step)); requestAnimationFrame(step); }), n);
}
async function press(page, key) { await page.keyboard.press(key); await frames(page, 2); }
async function shot(page, name) { if (shotDir) await page.screenshot({ path: join(shotDir, `${name}.png`) }); }
const state = (page) => page.evaluate(() => window.__game.state);
function check(cond, msg) { if (!cond) problems.push(msg); return cond; }

// one bot decision per turn, computed against the live game object
const decide = (page) => page.evaluate(() => {
  const g = window.__game;
  if (g.state !== 'playing') return { key: null, state: g.state };
  const p = g.player, m = g.map;
  const px = p.position.x, py = p.position.y;
  const enemies = m.entities.filter(e => e.type === 'enemy' && e.isAlive());
  const visible = enemies.filter(e => m.isVisible(e.position.x, e.position.y));
  const dirs = [{ dx: 0, dy: -1, k: 'w', mk: 'ArrowUp' }, { dx: 0, dy: 1, k: 's', mk: 'ArrowDown' }, { dx: -1, dy: 0, k: 'a', mk: 'ArrowLeft' }, { dx: 1, dy: 0, k: 'd', mk: 'ArrowRight' }];
  const info = { hp: p.hp, maxHp: p.maxHp, floor: g.floorNumber, turn: g.turnCount, visible: visible.length };
  window.__skip = window.__skip || new Set();
  const here = `${g.floorNumber}:${px},${py}`;
  if (p.hp <= p.maxHp * 0.4) { const slot = p.belt.findIndex(b => b && b.effect === 'heal'); if (slot !== -1) return { key: String(slot + 1), info }; }
  if (m.items.some(i => i.position.x === px && i.position.y === py) && !window.__skip.has(here)) { window.__lastPickup = here; return { key: 'g', info }; }
  const attackType = p.equipment.leftHand?.attackType || 'melee';
  const keys = ['q', 'e', 'r', 'f'];
  // prefer tree skills so they get exercised, then gear skills, then class skill
  window.__skillBlock = window.__skillBlock || {};
  const ready = (p.activeSkills || []).map((s, i) => ({ s, i })).filter(x => x.s && x.s.currentCooldown === 0 && (window.__skillBlock[x.i] || 0) <= g.turnCount);
  const pick = ready.find(x => x.s.skillType === 'tree' && x.s.treeEffect.type !== 'gear_enchant') || ready.find(x => x.s.skillType !== 'self' && !x.s.isClassSkill) || ready.find(x => x.s.isClassSkill);
  if (pick && visible.length > 0) {
    const range = pick.s.range > 0 ? pick.s.range : 1;
    if (visible.some(e => Math.abs(e.position.x - px) + Math.abs(e.position.y - py) <= range)) return { key: keys[pick.i], info };
  }
  const selfSkill = ready.find(x => x.s.skillType === 'self');
  if (selfSkill && visible.some(e => Math.abs(e.position.x - px) + Math.abs(e.position.y - py) <= 2)) return { key: keys[selfSkill.i], info };
  for (const d of dirs) { if (visible.find(e => e.position.x === px + d.dx && e.position.y === py + d.dy)) return { key: d.k, info }; }
  if (attackType !== 'melee') {
    for (const d of dirs) for (let s = 1; s <= 6; s++) {
      const x = px + d.dx * s, y = py + d.dy * s;
      if (m.blocksLOS(x, y)) break;
      if (visible.find(e => e.position.x === x && e.position.y === y)) return { key: d.k, info };
    }
  }
  const passable = (x, y) => m.isWalkable(x, y) || m.getTile(x, y) === TILE.DOOR;
  const bfs = (goalFn, avoidEnemies = true) => {
    const key = (x, y) => y * m.width + x;
    const prev = new Map(); prev.set(key(px, py), null);
    const q = [[px, py]];
    const enemySet = new Set(enemies.map(e => key(e.position.x, e.position.y)));
    while (q.length) {
      const [x, y] = q.shift();
      if ((x !== px || y !== py) && goalFn(x, y)) {
        let k = key(x, y), pk = prev.get(k);
        while (pk !== null && pk !== key(px, py)) { k = pk; pk = prev.get(k); }
        return { x: k % m.width, y: Math.floor(k / m.width) };
      }
      for (const d of dirs) {
        const nx = x + d.dx, ny = y + d.dy;
        if (!m.inBounds(nx, ny) || !passable(nx, ny)) continue;
        const nk = key(nx, ny);
        if (prev.has(nk)) continue;
        if (avoidEnemies && enemySet.has(nk) && !goalFn(nx, ny)) continue;
        prev.set(nk, key(x, y)); q.push([nx, ny]);
      }
    }
    return null;
  };
  const stepKey = (step) => dirs.find(d => step.x === px + d.dx && step.y === py + d.dy).mk;
  if (visible.length > 0) {
    const set = new Set(visible.map(e => `${e.position.x},${e.position.y}`));
    const step = bfs((x, y) => set.has(`${x},${y}`));
    if (step) return set.has(`${step.x},${step.y}`) ? { key: ' ', info } : { key: stepKey(step), info };
  }
  const itemSet = new Set(m.items.filter(i => m.isExplored(i.position.x, i.position.y) && !window.__skip.has(`${g.floorNumber}:${i.position.x},${i.position.y}`)).map(i => `${i.position.x},${i.position.y}`));
  if (itemSet.size) { const step = bfs((x, y) => itemSet.has(`${x},${y}`)); if (step) return { key: stepKey(step), info }; }
  let stairs = null;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.isExplored(x, y) && m.getTile(x, y) === TILE.STAIRS_DOWN) stairs = { x, y };
  const bossRoom = m.rooms.find(r => r.type === 'boss');
  const bossAlive = bossRoom && enemies.some(e => e.position.x >= bossRoom.x && e.position.x < bossRoom.x + bossRoom.width && e.position.y >= bossRoom.y && e.position.y < bossRoom.y + bossRoom.height);
  if (stairs && px === stairs.x && py === stairs.y && !bossAlive) return { key: '>', info };
  if (stairs && !bossAlive) { const step = bfs((x, y) => x === stairs.x && y === stairs.y); if (step) return { key: stepKey(step), info }; }
  const frontier = (x, y) => passable(x, y) && m.isExplored(x, y) && dirs.some(d => m.inBounds(x + d.dx, y + d.dy) && !m.isExplored(x + d.dx, y + d.dy) && m.getTile(x + d.dx, y + d.dy) !== TILE.WALL);
  let step = bfs(frontier) || bfs((x, y) => passable(x, y) && m.isExplored(x, y) && dirs.some(d => m.inBounds(x + d.dx, y + d.dy) && !m.isExplored(x + d.dx, y + d.dy)));
  if (step) return { key: stepKey(step), info };
  if (stairs) { const s2 = bfs((x, y) => x === stairs.x && y === stairs.y, false); if (s2) return { key: stepKey(s2), info }; }
  return { key: ' ', info };
});

// --- 1. keyboard flow through every screen, then the bot ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watch(page, 'keyboard');
  await page.goto(base);
  await page.waitForFunction(() => window.__game && window.__game.state !== 'init');
  check((await state(page)) === 'startMenu', 'fresh profile should open on the start menu');
  const idx = await page.evaluate((c) => window.__game.classOrder.indexOf(c), classKey);
  for (let i = 0; i < idx; i++) await press(page, 'ArrowDown');
  await press(page, 'Enter');
  check((await state(page)) === 'town', `enter should go to town, got ${await state(page)}`);
  await shot(page, 'town');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(160); await page.keyboard.up('ArrowUp'); await frames(page, 2);
  await press(page, 'Enter');
  check((await state(page)) === 'hubMenu', 'shelter should open the hub');
  for (const [i, expected] of [[1, 'hubShop'], [2, 'skillTree'], [3, 'hubStash'], [4, 'hubAchievements']]) {
    await page.evaluate(() => { window.__game.hubMenuIndex = 0; });
    for (let k = 0; k < i; k++) await press(page, 'ArrowDown');
    await press(page, 'Enter');
    check((await state(page)) === expected, `hub option ${i} should open ${expected}`);
    await shot(page, expected);
    await press(page, 'Escape');
  }
  // town: grant materials, build a farm by keyboard, walk in, upgrade it
  await press(page, 'Escape');
  check((await state(page)) === 'town', 'escape from the hub returns to town');
  await page.evaluate(() => { const g = window.__game; g.saveData.materials.timber = 60; g.saveData.materials.stone = 20; });
  await press(page, 'b');
  check((await state(page)) === 'townBuild', 'B opens the build menu');
  await press(page, 'Enter');
  check((await state(page)) === 'townPlace', 'enter on an affordable building starts placement');
  await press(page, 'Enter');
  const built = await page.evaluate(() => window.__game.saveData.buildings.map(b => `${b.type}:${b.level}`));
  check(built.length === 1 && built[0] === 'farm:1', `placing should build a farm, got ${built.join(',')}`);
  await shot(page, 'town-farm');
  const door = await page.evaluate(() => { const g = window.__game; const b = g.saveData.buildings[0]; const { sx, sy } = g.camera.tileToScreen(b.x, b.y); return { x: sx + 4, y: sy + 4 }; });
  await page.mouse.click(door.x, door.y);
  for (let i = 0; i < 80 && (await state(page)) === 'town'; i++) await page.waitForTimeout(50);
  check((await state(page)) === 'building', 'clicking a building walks to its door and opens it');
  await press(page, 'Enter');
  check(await page.evaluate(() => window.__game.saveData.buildings[0].level) === 2, 'the upgrade row raises the farm to level 2');
  await shot(page, 'town-farm-menu');
  await press(page, 'Escape');
  check((await state(page)) === 'town', 'leaving a building returns to town');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(160); await page.keyboard.up('ArrowDown'); await frames(page, 2);
  // back into the shelter and start the run
  const shelter = await page.evaluate(() => { const g = window.__game; const { sx, sy } = g.camera.tileToScreen(15, 15); return { x: sx + 8, y: sy + 8 }; });
  await page.mouse.click(shelter.x, shelter.y);
  for (let i = 0; i < 80 && (await state(page)) === 'town'; i++) await page.waitForTimeout(50);
  check((await state(page)) === 'hubMenu', 'clicking the shelter opens the hub');
  await page.evaluate(() => { window.__game.hubMenuIndex = 0; });
  await press(page, 'Enter');
  check((await state(page)) === 'playing', 'start run should enter the dungeon');
  for (const [key, prop] of [['i', 'inventoryOpen'], ['p', 'statsOpen'], ['m', 'mapOpen']]) {
    await press(page, key);
    check(await page.evaluate((p) => window.__game[p], prop), `${key} should open ${prop}`);
    await shot(page, prop);
    await press(page, 'Escape');
  }
  await press(page, 'Escape');
  check((await state(page)) === 'pauseMenu', 'escape should pause');
  await press(page, 'ArrowDown'); await press(page, 'ArrowDown'); await press(page, 'Enter');
  check((await state(page)) === 'settings', 'pause > settings');
  await press(page, 'Escape'); await press(page, 'Escape');
  check((await state(page)) === 'playing', 'resume from pause');

  // god mode hp so the bot can tour floors; skill points auto-invested so tree code runs
  await page.evaluate(() => { const p = window.__game.player; p.maxHp = 600; p.hp = 600; });
  let maxFloor = 1;
  let skillUses = 0;
  let lastFloor = 1;
  for (let t = 0; t < maxTurns; t++) {
    const d = await decide(page);
    if (!d.key) { say(`bot stopped: state ${d.state}`); break; }
    const isSkill = ['q', 'e', 'r', 'f'].includes(d.key);
    if (isSkill) skillUses++;
    await page.keyboard.press(d.key === ' ' ? 'Space' : d.key);
    await frames(page, 2);
    // a skill that could not fire (no target in line, nothing to enchant) does not spend a
    // turn; block that slot for a while so the bot does not spam it
    if (isSkill && d.info) await page.evaluate(([slot, turn]) => { const g = window.__game; if (g.turnCount === turn) window.__skillBlock[slot] = turn + 8; }, [['q', 'e', 'r', 'f'].indexOf(d.key), d.info.turn]);
    if (d.key === 'g') await page.evaluate(() => { const g = window.__game; if (!g.player) return; const k = window.__lastPickup; const [x, y] = k.split(':')[1].split(',').map(Number); if (g.map.items.some(i => i.position.x === x && i.position.y === y)) window.__skip.add(k); });
    if (t % 10 === 0) await page.evaluate(() => {
      const g = window.__game; if (!g.player) return;
      if (g.player.hp < 300) g.player.hp = 600;
      const ck = g.player.playerClass;
      if ((g.saveData.skillPoints[ck] || 0) > 0) {
        const inv = g.saveData.skillInvestments[ck] || {};
        // spend on actives first so they get exercised
        const nodes = getSkillTreeNodes(g).slice().sort((a, b) => (b.skillType === 'active') - (a.skillType === 'active'));
        for (const n of nodes) {
          if (canInvestSkill(ck, n.id, inv)) {
            investSkill(ck, n.id, inv); g.saveData.skillInvestments[ck] = inv; g.saveData.skillPoints[ck]--;
            g.treePassiveEffects = resolvePassiveEffects(ck, inv);
            const saved = Object.fromEntries((g.player.treeActiveSkills || []).map(s => [s.id, s.currentCooldown || 0]));
            g.player.treeActiveSkills = createTreeActiveSkills(ck, inv, saved);
            updateActiveSkills(g.player);
            recalcPlayerMaxHp(g);
            break;
          }
        }
      }
    });
    if (d.info && d.info.floor !== lastFloor) { lastFloor = d.info.floor; maxFloor = Math.max(maxFloor, lastFloor); say(`floor ${lastFloor} at turn ${d.info.turn}`); await shot(page, `floor-${lastFloor}`); }
  }
  const final = await page.evaluate(() => ({ state: window.__game.state, floor: window.__game.floorNumber, level: window.__game.saveData.classLevels[window.__game.player?.playerClass || 'fighter'], kills: window.__game.runSummary.enemiesKilled }));
  say(`bot: ${JSON.stringify(final)}, skill uses ${skillUses}`);
  const minFloor = maxTurns >= 800 ? 3 : 2;
  check(maxFloor >= minFloor || final.state === 'victory', `bot should reach floor ${minFloor} in ${maxTurns} turns (reached ${maxFloor})`);
  if (final.state === 'victory') { await shot(page, 'victory'); await press(page, 'Enter'); check((await state(page)) === 'town', 'victory returns to town'); }
  await page.close();
}

// --- 2. touch-only flow on a phone viewport ---
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, 'touch');
  await page.goto(base);
  await page.waitForFunction(() => window.__game && window.__game.state !== 'init');
  const tap = async (x, y) => { await page.touchscreen.tap(x, y); await frames(page, 3); };
  const tapLabel = async (label) => {
    const r = await page.evaluate((label) => { const r = window.__game.ui.regions.find(r => r.meta && r.meta.label === label); return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null; }, label);
    if (!check(!!r, `touch: button "${label}" should exist`)) return;
    await tap(r.x, r.y);
  };
  const rowsAt = () => page.evaluate(() => window.__game.ui.regions.filter(r => typeof r.action === 'function').map(r => ({ x: r.x + 10, y: r.y + r.h / 2 })));
  await tapLabel('Start Run');
  check((await state(page)) === 'town', 'touch: start run reaches town');
  const shelter = await page.evaluate(() => { const g = window.__game; const { sx, sy } = g.camera.tileToScreen(15, 15); return { x: sx + 8, y: sy + 8 }; });
  await tap(shelter.x, shelter.y);
  for (let i = 0; i < 60 && (await state(page)) === 'town'; i++) await page.waitForTimeout(50);
  check((await state(page)) === 'hubMenu', 'touch: tapping the shelter walks in and opens the hub');
  const hubRows = await rowsAt();
  await tap(hubRows[0].x, hubRows[0].y);
  check((await state(page)) === 'playing', 'touch: hub start run');
  await shot(page, 'phone-floor1');
  const target = await page.evaluate(() => { const g = window.__game; const room = g.map.rooms.find(r => r.type === 'start'); const { sx, sy } = g.camera.tileToScreen(room.x, room.y); return { tx: room.x, ty: room.y, x: sx + 8, y: sy + 8 }; });
  const startTurn = await page.evaluate(() => window.__game.turnCount);
  await tap(target.x, target.y);
  for (let i = 0; i < 60 && (await page.evaluate(() => !!window.__game.travel)); i++) await page.waitForTimeout(40);
  const pos = await page.evaluate(() => ({ ...window.__game.player.position, turn: window.__game.turnCount }));
  check(pos.turn > startTurn, 'touch: tapping a tile should travel (turns advanced)');
  for (const [label, prop] of [['Bag', 'inventoryOpen'], ['Stats', 'statsOpen'], ['Map', 'mapOpen']]) {
    await tapLabel(label);
    check(await page.evaluate((p) => window.__game[p], prop), `touch: ${label} opens ${prop}`);
    await shot(page, `phone-${prop}`);
    await tap(4, 4);
    if (prop === 'inventoryOpen') await tapLabel('Close');
    check(!(await page.evaluate((p) => window.__game[p], prop)), `touch: ${label} overlay closes`);
  }
  await tapLabel('Menu');
  check((await state(page)) === 'pauseMenu', 'touch: menu button pauses');
  await shot(page, 'phone-pause');
  const pauseRows = await rowsAt();
  await tap(pauseRows[0].x, pauseRows[0].y);
  check((await state(page)) === 'playing', 'touch: resume');
  await ctx.close();
}

await browser.close();
server.close();

if (problems.length) {
  console.error(`\nplaytest FAILED with ${problems.length} problem(s):`);
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
say('\nplaytest passed');

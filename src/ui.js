// src/ui.js
// hit regions: every draw function registers the rectangles a finger or mouse
// can act on. regions are cleared at the start of each frame and resolved by
// the input translation step in game.js. later registrations win, so overlays
// drawn on top of the map naturally take precedence.

export function clearRegions(game) {
  if (!game.ui) game.ui = { regions: [] };
  game.ui.regions.length = 0;
}

// action is either an action object (fed to the same handlers as key presses)
// or a function(game) that may return an action object or null.
export function registerRegion(game, x, y, w, h, action, meta = null) {
  if (!game.ui) game.ui = { regions: [] };
  game.ui.regions.push({ x, y, w, h, action, meta });
}

export function findRegion(regions, px, py) {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return r;
  }
  return null;
}

// draws a small labelled button and registers its region in one call
export function drawButton(game, x, y, w, h, label, action, opts = {}) {
  const ctx = game.ctx;
  const fontSize = opts.fontSize || Math.max(10, Math.round(h * 0.5));
  ctx.fillStyle = opts.active ? '#2f4a63' : (opts.fill || '#222a34');
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = opts.active ? '#9fd0ff' : (opts.stroke || '#4a5866');
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = opts.color || (opts.dim ? '#6f7b89' : '#d9e1ea');
  ctx.font = `${fontSize}px monospace`;
  const savedAlign = ctx.textAlign;
  const savedBaseline = ctx.textBaseline;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textAlign = savedAlign;
  ctx.textBaseline = savedBaseline;
  if (action !== null && action !== undefined) registerRegion(game, x, y, w, h, action, { label });
}

// menus: tapping a row selects it; tapping the selected row confirms.
// `indexProp` is the game field holding the cursor. `onSelect` may adjust
// extra state (e.g. the selected class) when the cursor moves.
export function rowSelectAction(indexProp, idx, confirmAction = { type: 'inventoryConfirm' }, onSelect = null) {
  return (game) => {
    if (game[indexProp] === idx) return confirmAction;
    game[indexProp] = idx;
    if (onSelect) onSelect(game, idx);
    if (game.audio) game.audio.uiClick();
    return null;
  };
}

// single-purpose menus (pause, hub, post-death): one tap selects and confirms
export function rowConfirmAction(indexProp, idx, confirmAction = { type: 'inventoryConfirm' }) {
  return (game) => {
    game[indexProp] = idx;
    return confirmAction;
  };
}

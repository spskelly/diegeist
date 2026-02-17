const KEY_MAP = {
  ArrowUp:    { type: 'move', dx: 0, dy: -1 },
  ArrowDown:  { type: 'move', dx: 0, dy: 1 },
  ArrowLeft:  { type: 'move', dx: -1, dy: 0 },
  ArrowRight: { type: 'move', dx: 1, dy: 0 },
  w:          { type: 'attack', dx: 0, dy: -1 },
  s:          { type: 'attack', dx: 0, dy: 1 },
  a:          { type: 'attack', dx: -1, dy: 0 },
  d:          { type: 'attack', dx: 1, dy: 0 },
  ' ':        { type: 'wait' },
  '.':        { type: 'wait' },
  i:          { type: 'inventory' },
  Tab:        { type: 'inventoryTab' },
  g:          { type: 'pickup' },
  '>':        { type: 'descend' },
  Escape:     { type: 'close' },
  q:          { type: 'skill', slot: 0 },
  e:          { type: 'skill', slot: 1 },
  r:          { type: 'skill', slot: 2 },
  '1':        { type: 'belt', slot: 0 },
  '2':        { type: 'belt', slot: 1 },
  '3':        { type: 'belt', slot: 2 },
  Enter:      { type: 'inventoryConfirm' },
  z:          { type: 'inventoryConfirm' },
  x:          { type: 'inventoryDrop' },
  c:          { type: 'inventoryBelt' },
  u:          { type: 'inventoryUnequip' },
  p:          { type: 'stats' },
  h:          { type: 'hub' },
  m:          { type: 'map' },
};

export function mapKeyToAction(key) {
  return KEY_MAP[key] || null;
}

export class InputHandler {
  constructor() {
    this.pendingAction = null;
    this.listening = false;
    this.heldKeys = new Set();
  }

  start() {
    this.listening = true;
    this._handler = (e) => {
      if (!this.listening) return;
      this.heldKeys.add(e.key);
      const action = mapKeyToAction(e.key);
      if (action) {
        e.preventDefault();
        this.pendingAction = action;
      }
    };
    this._upHandler = (e) => {
      this.heldKeys.delete(e.key);
    };
    document.addEventListener('keydown', this._handler);
    document.addEventListener('keyup', this._upHandler);
  }

  stop() {
    this.listening = false;
    if (this._handler) document.removeEventListener('keydown', this._handler);
    if (this._upHandler) document.removeEventListener('keyup', this._upHandler);
    this.heldKeys.clear();
  }

  consume() {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  }

  getHeldDirection() {
    if (this.heldKeys.has('ArrowUp'))    return { dx: 0, dy: -1 };
    if (this.heldKeys.has('ArrowDown'))  return { dx: 0, dy: 1 };
    if (this.heldKeys.has('ArrowLeft'))  return { dx: -1, dy: 0 };
    if (this.heldKeys.has('ArrowRight')) return { dx: 1, dy: 0 };
    return null;
  }
}

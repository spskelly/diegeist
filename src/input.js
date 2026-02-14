const KEY_MAP = {
  ArrowUp:    { type: 'move', dx: 0, dy: -1 },
  ArrowDown:  { type: 'move', dx: 0, dy: 1 },
  ArrowLeft:  { type: 'move', dx: -1, dy: 0 },
  ArrowRight: { type: 'move', dx: 1, dy: 0 },
  w:          { type: 'move', dx: 0, dy: -1 },
  s:          { type: 'move', dx: 0, dy: 1 },
  a:          { type: 'move', dx: -1, dy: 0 },
  d:          { type: 'move', dx: 1, dy: 0 },
  ' ':        { type: 'wait' },
  '.':        { type: 'wait' },
  i:          { type: 'inventory' },
  Tab:        { type: 'inventory' },
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
};

export function mapKeyToAction(key) {
  return KEY_MAP[key] || null;
}

export class InputHandler {
  constructor() {
    this.pendingAction = null;
    this.listening = false;
  }

  start() {
    this.listening = true;
    this._handler = (e) => {
      if (!this.listening) return;
      const action = mapKeyToAction(e.key);
      if (action) {
        e.preventDefault();
        this.pendingAction = action;
      }
    };
    document.addEventListener('keydown', this._handler);
  }

  stop() {
    this.listening = false;
    if (this._handler) {
      document.removeEventListener('keydown', this._handler);
    }
  }

  consume() {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  }
}

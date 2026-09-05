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
  f:          { type: 'skill', slot: 3 },
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

// a drag longer than this (in css pixels) is a swipe; anything shorter is a tap
export const SWIPE_MIN_DISTANCE = 24;
// presses held longer than this are ignored as taps (scrolling attempts, hesitation)
export const TAP_MAX_MS = 700;

export function mapKeyToAction(key) {
  return KEY_MAP[key] || null;
}

// turns a pointer press/release pair into a tap or a four-way swipe.
// returns null when the gesture should be ignored.
export function classifyPointerGesture(start, end, elapsedMs = 0) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= SWIPE_MIN_DISTANCE) {
    if (Math.abs(dx) >= Math.abs(dy)) return { type: 'swipe', dx: Math.sign(dx), dy: 0 };
    return { type: 'swipe', dx: 0, dy: Math.sign(dy) };
  }
  if (elapsedMs > TAP_MAX_MS) return null;
  return { type: 'tap', x: end.x, y: end.y };
}

export class InputHandler {
  constructor() {
    this.pendingAction = null;
    this.listening = false;
    this.heldKeys = new Set();
    this.pointerStart = null;
    this.hasTouch = false;
    // called on every key press or pointer press; the game uses it to resume audio
    this.onInput = null;
  }

  start() {
    this.listening = true;
    this._handler = (e) => {
      if (!this.listening) return;
      this.heldKeys.add(e.key);
      if (this.onInput) this.onInput();
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

  // pointer events cover mouse, pen and touch. coordinates are converted to
  // canvas pixels so hit regions and the camera can use them directly.
  attachPointer(canvas) {
    this.canvas = canvas;
    const toCanvas = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };
    this._pointerDown = (e) => {
      if (!this.listening) return;
      if (e.pointerType === 'touch') this.hasTouch = true;
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      this.pointerStart = { ...toCanvas(e), t: performance.now(), id: e.pointerId };
      if (this.onInput) this.onInput();
      e.preventDefault();
    };
    this._pointerUp = (e) => {
      if (!this.listening || !this.pointerStart) return;
      if (this.pointerStart.id !== undefined && e.pointerId !== undefined && e.pointerId !== this.pointerStart.id) return;
      const gesture = classifyPointerGesture(this.pointerStart, toCanvas(e), performance.now() - this.pointerStart.t);
      this.pointerStart = null;
      if (gesture) this.pendingAction = gesture;
      e.preventDefault();
    };
    this._pointerCancel = () => { this.pointerStart = null; };
    this._contextMenu = (e) => e.preventDefault();
    this._touchMove = (e) => e.preventDefault();
    canvas.addEventListener('pointerdown', this._pointerDown);
    canvas.addEventListener('pointerup', this._pointerUp);
    canvas.addEventListener('pointercancel', this._pointerCancel);
    canvas.addEventListener('contextmenu', this._contextMenu);
    // stop the page from scrolling or zooming while dragging on the canvas
    canvas.addEventListener('touchmove', this._touchMove, { passive: false });
  }

  stop() {
    this.listening = false;
    if (this._handler) document.removeEventListener('keydown', this._handler);
    if (this._upHandler) document.removeEventListener('keyup', this._upHandler);
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this._pointerDown);
      this.canvas.removeEventListener('pointerup', this._pointerUp);
      this.canvas.removeEventListener('pointercancel', this._pointerCancel);
      this.canvas.removeEventListener('contextmenu', this._contextMenu);
      this.canvas.removeEventListener('touchmove', this._touchMove);
    }
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

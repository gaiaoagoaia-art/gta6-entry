// Keyboard and mouse state: held keys, per-frame mouse motion, click edges,
// and pointer-lock capture for looking around Palmshade.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.clicked = false; this.mouseDown = false;
    this.locked = false;
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.pressed = new Set();
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('click', () => {
      if (!this.locked && this.wantsLock) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    this.wantsLock = true;
  }
  down(code) { return this.keys.has(code); }
  justPressed(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  consumeMouse() { const d = { x: this.mouseDX, y: this.mouseDY }; this.mouseDX = this.mouseDY = 0; return d; }
  endFrame() { this.pressed.clear(); this.clicked = false; }
}

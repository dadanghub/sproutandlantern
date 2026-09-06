// Keyboard state. Mouse input is handled by the DOM UI directly.

const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyE', 'KeyI', 'KeyJ', 'KeyL', 'KeyM', 'Digit1', 'Digit2', 'Digit3',
]);

export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.pressed = new Set();
    this._down = (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      // keep game keys from re-triggering focused UI buttons
      const a = document.activeElement;
      if (a && a.tagName === 'BUTTON') a.blur();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._up = (e) => this.keys.delete(e.code);
    this._blur = () => {
      this.keys.clear();
      this.pressed.clear();
    };
    target.addEventListener('keydown', this._down);
    target.addEventListener('keyup', this._up);
    target.addEventListener('blur', this._blur);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }
}

export function movementVector(input) {
  let dx = 0, dy = 0;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;
  if (dx !== 0 && dy !== 0) {
    const inv = 1 / Math.sqrt(2);
    dx *= inv;
    dy *= inv;
  }
  return { dx, dy };
}

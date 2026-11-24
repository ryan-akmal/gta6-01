// SOLMAR HEAT — keyboard and mouse input. Tracks held keys, pressed-this-frame
// edges, and the mouse position in screen and world coordinates.

export function createInput(canvas) {
  const input = {
    keys: Object.create(null),
    pressed: Object.create(null),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    mouseWorldX: 0,
    mouseWorldY: 0,
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!input.keys[k]) input.pressed[k] = true;
    input.keys[k] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys[k] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = Object.create(null);
    // A mouse held down across a window blur would otherwise stick firing.
    input.mouseDown = false;
    input.mouseClicked = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.isDown = (k) => !!input.keys[k];
  input.wasPressed = (k) => !!input.pressed[k];
  input.anyDirection = () => ({
    x: (input.isDown('d') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('a') || input.isDown('ArrowLeft') ? 1 : 0),
    y: (input.isDown('s') || input.isDown('ArrowDown') ? 1 : 0) - (input.isDown('w') || input.isDown('ArrowUp') ? 1 : 0),
  });
  // Call once per frame after the game reads input: clears edge-triggered flags.
  input.endFrame = () => {
    input.pressed = Object.create(null);
    input.mouseClicked = false;
  };
  return input;
}

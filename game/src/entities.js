// SOLMAR HEAT — the things that move: the player, cars and pedestrians.
// Factories build them, updates move them; rendering lives in render.js.

import { WORLD_W, WORLD_H, CAR_MODELS, TUNING, ECONOMY } from './config.js';
import { collideBuildings, clampToWorld, inSea, onBeach } from './city.js';
import { range, pick } from './random.js';

let nextId = 1;

export function createPlayer(x, y) {
  return {
    id: 0, kind: 'player',
    x, y, angle: -Math.PI / 2, hp: TUNING.playerHp, cash: ECONOMY.startCash,
    onFoot: true, car: null, speed: 0, shootCd: 0, punchCd: 0,
    invuln: 0, moving: false, run: false,
  };
}

export function createCar(modelKey, x, y, angle, driver) {
  const m = CAR_MODELS[modelKey];
  return {
    id: nextId++, kind: 'car', model: modelKey,
    x, y, angle, speed: 0, hp: m.hp, maxHp: m.hp,
    color: m.color, driver: driver || 'parked',
    targetSpeed: 0, laneOffset: 0, turnAt: null, smoke: 0,
    stuckTimer: 0, siren: driver === 'cop',
  };
}

export function createPed(rng, x, y) {
  const shirts = ['#e8e8e8', '#d96a4f', '#4f7ad9', '#e8c84f', '#7ad94f', '#c94fd9', '#4fd9c9'];
  return {
    id: nextId++, kind: 'ped',
    x, y, angle: range(rng, 0, Math.PI * 2),
    speed: 0, walkSpeed: range(rng, 40, 70),
    state: 'walk', downTimer: 0, fleeX: 0, fleeY: 0,
    shirt: pick(rng, shirts), skin: pick(rng, ['#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0']),
    targetX: x, targetY: y, waitTimer: range(rng, 0, 3),
  };
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// --- Player on foot ---------------------------------------------------------

export function updatePlayerOnFoot(state, dt, dir) {
  const p = state.player;
  const speed = (dir.x !== 0 || dir.y !== 0)
    ? (state.input.isDown('Shift') ? TUNING.playerRun : TUNING.playerWalk) : 0;
  p.moving = speed > 0;
  p.run = speed === TUNING.playerRun;
  if (speed > 0) {
    const len = Math.hypot(dir.x, dir.y) || 1;
    const nx = p.x + (dir.x / len) * speed * dt;
    const ny = p.y + (dir.y / len) * speed * dt;
    // Aim where you walk; the mouse aims the gun when it moves.
    p.angle = Math.atan2(dir.y, dir.x);
    let pos = collideBuildings(state.city, nx, ny, 13);
    if (inSea(pos.x, pos.y)) pos = { x: p.x, y: p.y, hit: null };
    pos = clampToWorld(pos.x, pos.y, 13);
    p.x = pos.x;
    p.y = pos.y;
  }
  // Face the mouse while shooting is possible.
  if (state.input.mouseDown || state.input.mouseClicked) {
    p.angle = Math.atan2(state.input.mouseWorldY - p.y, state.input.mouseWorldX - p.x);
  }
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
}

// --- Driving ----------------------------------------------------------------

// Arcade car physics: accelerate along the nose, steer harder at low speed,
// grip pulls velocity toward the nose so the car slides a little, not a lot.
export function driveCar(car, throttle, steer, dt, handbrake) {
  const m = CAR_MODELS[car.model];
  const sand = onBeach(car.x, car.y) ? 0.55 : 1;
  const top = m.top * sand;
  if (throttle > 0) car.speed += m.accel * throttle * dt;
  else if (throttle < 0) car.speed += m.accel * 0.8 * throttle * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
  car.speed = Math.max(-top * 0.45, Math.min(top, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * m.grip * steerAuthority * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  return { nx, ny };
}

// Move a car, colliding with buildings, the sea and the world edge.
// Returns true when it hit something hard (for crash sound/damage).
export function moveCar(state, car, nx, ny) {
  const r = 17;
  let pos = collideBuildings(state.city, nx, ny, r);
  if (inSea(pos.x, pos.y)) {
    pos = { x: car.x, y: car.y, hit: 'sea' };
    car.speed *= 0.4;
  }
  pos = clampToWorld(pos.x, pos.y, r);
  const hitHard = pos.hit != null && Math.abs(car.speed) > 140;
  if (pos.hit) car.speed *= 0.55;
  car.x = pos.x;
  car.y = pos.y;
  return hitHard;
}

// Circle-ish car-vs-car collision: push apart and trade a little speed.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 30;
  if (d === 0 || d >= min) return 0;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const impact = Math.abs(a.speed - b.speed);
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg;
  b.speed = avg;
  return impact;
}

export function damageCar(car, amount) {
  car.hp -= amount;
  car.smoke = Math.max(car.smoke, car.hp < car.maxHp * 0.4 ? 1 : 0.5);
  return car.hp <= 0;
}

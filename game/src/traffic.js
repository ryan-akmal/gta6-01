// SOLMAR HEAT — traffic and pedestrians: the city breathing on its own.
// Traffic cars follow the road grid and turn at intersections; pedestrians walk
// the sidewalks and run from gunfire, speeding cars and police chases.

import { VERTICAL_ROADS, HORIZONTAL_ROADS, ROAD_W, WORLD_W, BEACH_Y } from './config.js';
import { onRoad, nearestRoadPoint, collideBuildings, clampToWorld, inSea } from './city.js';
import { createCar, createPed, dist, driveCar, moveCar, collideCars } from './entities.js';
import { pick, range, chance } from './random.js';

const TRAFFIC_MODELS = ['comet', 'vortex', 'bison', 'liner', 'cruiser'];
const TRAFFIC_COLORS = ['#c94f42', '#3f6fb5', '#e8b923', '#4f7a5a', '#8a8f96', '#d9d9d9', '#2b2f36', '#7a4fb5'];

export function spawnTraffic(state) {
  const rng = state.rng;
  while (state.cars.filter((c) => c.driver === 'traffic').length < state.trafficTarget) {
    const p = nearestRoadPoint(range(rng, 100, WORLD_W - 100), range(rng, 100, BEACH_Y - 100));
    const vertical = p.vertical;
    const dir = chance(rng, 0.5) ? 1 : -1;
    const lane = (ROAD_W / 2 - 16) * (dir > 0 ? 1 : -1);
    const x = vertical ? p.x + lane : p.x;
    const y = vertical ? p.y : p.y + lane;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(pick(rng, TRAFFIC_MODELS), x, y, angle, 'traffic');
    car.color = pick(rng, TRAFFIC_COLORS);
    car.targetSpeed = range(rng, 150, 240);
    car.laneOffset = lane;
    car.vertical = vertical;
    car.dir = dir;
    state.cars.push(car);
  }
}

export function spawnPeds(state) {
  const rng = state.rng;
  while (state.peds.length < state.pedTarget) {
    const rx = pick(rng, VERTICAL_ROADS);
    const ry = range(rng, 80, BEACH_Y - 80);
    const onVertical = chance(rng, 0.5);
    const x = onVertical ? rx + (chance(rng, 0.5) ? 62 : -62) : range(rng, 80, WORLD_W - 80);
    const y = onVertical ? ry : pick(rng, HORIZONTAL_ROADS) + (chance(rng, 0.5) ? 62 : -62);
    const ped = createPed(rng, x, y);
    // Keep pedestrians out of buildings.
    const pos = collideBuildings(state.city, ped.x, ped.y, 12);
    ped.x = pos.x;
    ped.y = pos.y;
    state.peds.push(ped);
  }
}

function carAhead(state, car, lookAhead) {
  const ax = car.x + Math.cos(car.angle) * lookAhead;
  const ay = car.y + Math.sin(car.angle) * lookAhead;
  for (const other of state.cars) {
    if (other === car) continue;
    if (dist(ax, ay, other.x, other.y) < 34) return other;
  }
  return null;
}

export function updateTraffic(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    // At an intersection, sometimes turn onto the crossing road. Southbound
    // traffic at the coast road (y=1800) must turn — the beach is not a road.
    const nearX = VERTICAL_ROADS.find((rx) => Math.abs(car.x - rx) < 14);
    const nearY = HORIZONTAL_ROADS.find((ry) => Math.abs(car.y - ry) < 14);
    if (nearX !== undefined && nearY !== undefined && !car.turnAt) {
      car.turnAt = { x: nearX, y: nearY };
      const mustTurn = car.vertical && car.dir === 1 && nearY === 1800;
      if (mustTurn || chance(state.rng, 0.45)) {
        const turnVertical = !car.vertical;
        const newDir = chance(state.rng, 0.5) ? 1 : -1;
        const lane = (ROAD_W / 2 - 16) * (newDir > 0 ? 1 : -1);
        car.vertical = turnVertical;
        car.dir = newDir;
        car.laneOffset = lane;
        car.targetAngle = turnVertical
          ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (newDir > 0 ? 0 : Math.PI);
      }
    }
    if (car.turnAt && dist(car.x, car.y, car.turnAt.x, car.turnAt.y) > 60) car.turnAt = null;

    // Steer toward the target angle, then drive.
    let steer = 0;
    if (car.targetAngle !== undefined) {
      let d = car.targetAngle - car.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      steer = Math.max(-1, Math.min(1, d * 2.5));
      if (Math.abs(d) < 0.05) car.targetAngle = undefined;
    }
    // Ease back onto the lane centre after a turn.
    const blocked = carAhead(state, car, 70);
    const throttle = blocked ? 0 : 1;
    if (blocked && car.speed > 30) car.speed -= 300 * dt;
    const { nx, ny } = driveCar(car, throttle, steer, dt, false);
    if (car.speed > car.targetSpeed) car.speed = car.targetSpeed;
    // Brake lights flare when the car is slowing from speed with no throttle.
    car.brakeLight = throttle === 0 && Math.abs(car.speed) > 30;
    moveCar(state, car, nx, ny);
    // A traffic car the player shoves off the road finds its way back.
    if (!onRoad(car.x, car.y) && car.speed < 20) {
      const p = nearestRoadPoint(car.x, car.y);
      car.x += (p.x - car.x) * dt * 0.5;
      car.y += (p.y - car.y) * dt * 0.5;
    }
  }
  // Resolve car-vs-car bumps (traffic, parked, police and the player's car).
  for (let i = 0; i < state.cars.length; i++) {
    for (let j = i + 1; j < state.cars.length; j++) {
      const a = state.cars[i];
      const b = state.cars[j];
      if (a.driver === 'parked' && b.driver === 'parked') continue;
      const impact = collideCars(a, b);
      if (impact > 120 && (a.driver === 'player' || b.driver === 'player')) {
        state.effects.push({ kind: 'crash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0.25 });
        state.audio.crash();
        if (a.driver === 'player') a.hp -= impact * 0.02;
        if (b.driver === 'player') b.hp -= impact * 0.02;
      }
    }
  }
}

export function updatePeds(state, dt) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
  const gunfire = state.gunfireTimer > 0;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeX = ped.x + (ped.x - px);
        ped.fleeY = ped.y + (ped.y - py);
      }
      continue;
    }
    const dPlayer = dist(ped.x, ped.y, px, py);
    const scared = gunfire || state.wanted > 0 || (playerSpeed > 260 && dPlayer < 160) || dPlayer < 46;
    if (scared && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeX = ped.x + (ped.x - px) * 2 + (state.rng() - 0.5) * 120;
      ped.fleeY = ped.y + (ped.y - py) * 2 + (state.rng() - 0.5) * 120;
    }
    let tx = ped.targetX;
    let ty = ped.targetY;
    let speed = ped.walkSpeed;
    if (ped.state === 'flee') {
      tx = ped.fleeX;
      ty = ped.fleeY;
      speed = ped.walkSpeed * 2.6;
      if (dist(ped.x, ped.y, tx, ty) < 30 || dPlayer > 420) {
        ped.state = 'walk';
        ped.waitTimer = 1;
      }
    }
    if (ped.waitTimer > 0) {
      ped.waitTimer -= dt;
      ped.speed = 0;
      continue;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      // Pick a new sidewalk stroll target.
      const p = nearestRoadPoint(
        Math.max(80, Math.min(WORLD_W - 80, ped.x + (state.rng() - 0.5) * 700)),
        Math.max(80, Math.min(BEACH_Y - 80, ped.y + (state.rng() - 0.5) * 700)),
      );
      const off = 62;
      ped.targetX = p.vertical ? p.x + (chance(state.rng, 0.5) ? off : -off) : p.x;
      ped.targetY = p.vertical ? p.y : p.y + (chance(state.rng, 0.5) ? off : -off);
      ped.waitTimer = range(state.rng, 0, 2.5);
      ped.speed = 0;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.speed = speed;
    let nx = ped.x + (dx / d) * speed * dt;
    let ny = ped.y + (dy / d) * speed * dt;
    // Nobody strolls into the sea: pick a new target instead.
    if (inSea(nx, ny)) {
      ped.waitTimer = 1;
      ped.speed = 0;
      continue;
    }
    let pos = collideBuildings(state.city, nx, ny, 10);
    pos = clampToWorld(pos.x, pos.y, 10);
    ped.x = pos.x;
    ped.y = pos.y;
  }
}

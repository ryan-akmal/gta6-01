// SOLMAR HEAT — the wanted system and the police. Heat rises with crimes and
// cools when the player lies low; police Interceptors spawn to match the stars,
// chase, ram, and bust the player on foot when they catch up.

import { TUNING } from './config.js';
import { createCar, dist, driveCar, moveCar, damageCar } from './entities.js';
import { nearestRoadPoint } from './city.js';

export function addHeat(state, amount, reason) {
  state.heat = Math.min(TUNING.maxWanted, state.heat + amount);
  const stars = Math.floor(state.heat);
  if (stars > state.wanted) {
    state.wanted = stars;
    state.message(`Wanted level ${stars} — ${reason}`, 'bad');
    state.audio.setSiren(true, 0);
  }
  state.heatTimer = 0;
}

export function updateWanted(state, dt) {
  const stars = Math.floor(state.heat);
  state.wanted = stars;
  if (stars === 0) {
    state.heat = Math.max(0, state.heat - dt / TUNING.wantedDecaySeconds);
    return;
  }
  // Heat cools only when no cop can see the player.
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  let seen = false;
  for (const cop of state.cops) {
    if (dist(cop.x, cop.y, px, py) < 420) { seen = true; break; }
  }
  if (!seen) {
    state.heatTimer += dt;
    if (state.heatTimer > TUNING.wantedDecaySeconds) {
      state.heatTimer = 0;
      state.heat = Math.max(0, state.heat - 1);
      if (Math.floor(state.heat) < state.wanted) {
        state.wanted = Math.floor(state.heat);
        if (state.wanted === 0) state.message('You lost the heat.', 'good');
      }
    }
  } else {
    state.heatTimer = 0;
  }
}

function spawnCop(state) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  // Spawn on a road near the player but off-screen when possible.
  let x;
  let y;
  for (let tries = 0; tries < 8; tries++) {
    const rp = nearestRoadPoint(
      Math.max(80, Math.min(3200 - 80, px + (state.rng() - 0.5) * 1100)),
      Math.max(80, Math.min(2000, py + (state.rng() - 0.5) * 1100)),
    );
    x = rp.x;
    y = rp.y;
    if (dist(x, y, px, py) > 420) break;
  }
  const cop = createCar('interceptor', x, y, Math.atan2(py - y, px - x), 'cop');
  cop.bustTimer = 0;
  state.cars.push(cop);
  state.cops.push(cop);
  return cop;
}

export function updatePolice(state, dt) {
  // Keep the number of pursuit cars matched to the wanted level.
  const want = Math.min(state.wanted, 4);
  while (state.cops.length < want) spawnCop(state);
  while (state.cops.length > want) {
    const cop = state.cops.pop();
    cop.driver = 'traffic';
    cop.siren = false;
    state.cars = state.cars.filter((c) => c !== cop || true);
  }

  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const playerCar = p.car;

  for (const cop of [...state.cops]) {
    if (cop.hp <= 0) {
      // Disabled: the officer bails and the wreck stays as a smoking obstacle.
      cop.driver = 'wreck';
      cop.speed = 0;
      state.cops = state.cops.filter((c) => c !== cop);
      addHeat(state, -0.5, '');
      state.message('Interceptor disabled.', 'good');
      continue;
    }
    const d = dist(cop.x, cop.y, px, py);
    // Pursuit steering: aim at the player, lead a little when they are moving.
    let tx = px;
    let ty = py;
    if (playerCar) {
      tx += Math.cos(playerCar.angle) * playerCar.speed * 0.35;
      ty += Math.sin(playerCar.angle) * playerCar.speed * 0.35;
    }
    const wantAngle = Math.atan2(ty - cop.y, tx - cop.x);
    let da = wantAngle - cop.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, da * 2.2));
    // Cops drive harder as the wanted level climbs.
    const aggression = 0.75 + state.wanted * 0.12;
    // On top of a player on foot, the officer stops to make the bust instead
    // of ramming through: brake hard and let the bust timer run.
    const closingOnFoot = p.onFoot && d < 55;
    const throttle = closingOnFoot ? 0 : (d > 60 ? aggression : 0.4);
    const { nx, ny } = driveCar(cop, throttle, steer, dt, false);
    if (closingOnFoot) cop.speed *= Math.max(0, 1 - 6 * dt);
    moveCar(state, cop, nx, ny);

    // Ram damage when a cop car hits the player's car or the player.
    if (playerCar && d < 34 && Math.abs(cop.speed) > 60) {
      playerCar.hp -= TUNING.copRamDamage * dt * 4;
      cop.hp -= TUNING.copRamDamage * dt * 2;
      if (state.rng() < dt * 6) state.audio.crash();
    }
    if (p.onFoot && d < 30) {
      if (Math.abs(cop.speed) < 60) {
        // Caught on foot: the bust timer runs while the cop sits on the player.
        cop.bustTimer += dt;
        if (cop.bustTimer > TUNING.copBustSeconds) {
          state.busted = true;
          return;
        }
      } else {
        // Run over by a speeding Interceptor: it hurts.
        p.hp -= 30 * dt * 4;
        if (p.hp <= 0) state.wasted = true;
      }
    } else {
      cop.bustTimer = 0;
    }
    // A cop that falls far behind respawns closer (keeps the chase alive).
    if (d > 1500) {
      const rp = nearestRoadPoint(
        Math.max(80, Math.min(3200 - 80, px + (state.rng() - 0.5) * 700)),
        Math.max(80, Math.min(2000, py + (state.rng() - 0.5) * 700)),
      );
      cop.x = rp.x;
      cop.y = rp.y;
      cop.angle = Math.atan2(py - rp.y, px - rp.x);
      cop.speed = 200;
    }
  }
}

// Shooting or ramming a police car damages it; destroying one raises the heat.
export function damageCopCar(state, cop, amount) {
  const destroyed = damageCar(cop, amount);
  if (destroyed && state.cops.includes(cop)) {
    addHeat(state, 1, 'officer down');
  }
  return destroyed;
}

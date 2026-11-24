// SOLMAR HEAT — the screenshot scenes behind ?shot=start|chase|mission|drive.
// Each one builds a real game state from a fixed seed, places the player, cars,
// police and mission markers, then plays the live rules forward a few seconds,
// so every frame is what a short game really looks like — and the same seed
// always gives the same frame.

import { PLACES } from './config.js';
import { createCar, dist } from './entities.js';
import { startMission, missionObjective, missionTarget } from './missions.js';
import { addHeat } from './police.js';
import { updateTraffic, updatePeds } from './traffic.js';

const STEP = 1 / 60;

function stepWorld(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    updateTraffic(state, STEP);
    updatePeds(state, STEP);
    state.time += STEP;
  }
}

function focusCamera(state) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  state.camera.x = Math.max(0, Math.min(3200 - 1280, px - 640));
  state.camera.y = Math.max(0, Math.min(2400 - 720, py - 360));
}

function syncHud(state) {
  state.missionObjective = missionObjective(state);
  state.missionTarget = missionTarget(state);
}

// Title screen: the city lives behind the menu for six seconds.
function stageStart(state) {
  state.mode = 'title';
  state.titleIndex = 0;
  stepWorld(state, 6);
  state.camera.x = 1180;
  state.camera.y = 480;
  return { mode: 'title' };
}

// The cover: a 3-star chase through Downtown in the stolen Falcon GT,
// Interceptors on the tail, the HUD, minimap and mission objective all live.
function stageChase(state) {
  startMission(state, 1);
  const falcon = createCar('falcon', 1800, 1032, 0, 'player');
  falcon.missionFalcon = true;
  falcon.speed = 430;
  falcon.smoke = 0.45;
  state.cars.push(falcon);
  state.player.car = falcon;
  state.player.onFoot = false;
  state.player.x = falcon.x;
  state.player.y = falcon.y;
  state.mission.stage = 1;
  state.mission.target = { x: PLACES.spray.x, y: PLACES.spray.y, label: "Luna's Spray & Go" };
  addHeat(state, 3, 'the precinct wants you');
  // Interceptors trail behind the Falcon — close enough to read as a chase,
  // far enough that they never pile onto it.
  const cop1 = createCar('interceptor', 1420, 1032, 0, 'cop');
  cop1.speed = 400;
  const cop2 = createCar('interceptor', 1330, 1000, 0.1, 'cop');
  cop2.speed = 380;
  state.cars.push(cop1, cop2);
  state.cops.push(cop1, cop2);
  // Traffic: one oncoming car in the westbound lane, one ahead in our lane.
  const t1 = createCar('vortex', 2500, 968, Math.PI, 'traffic');
  t1.speed = 200;
  t1.targetSpeed = 200;
  const t2 = createCar('comet', 2600, 1032, 0, 'traffic');
  t2.speed = 180;
  t2.targetSpeed = 180;
  state.cars.push(t1, t2);
  state.mode = 'playing';
  state.hint = 'WASD drive • Space handbrake • E exit car';
  // Play the chase forward: the Falcon runs east, the Interceptors close in.
  for (let i = 0; i < Math.round(1.6 / STEP); i++) {
    falcon.x += falcon.speed * STEP;
    for (const cop of state.cops) {
      const want = Math.atan2(falcon.y - cop.y, falcon.x - cop.x);
      let da = want - cop.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      cop.angle += Math.max(-2.4 * STEP, Math.min(2.4 * STEP, da * 3 * STEP));
      cop.x += Math.cos(cop.angle) * cop.speed * STEP;
      cop.y += Math.sin(cop.angle) * cop.speed * STEP;
    }
    updateTraffic(state, STEP);
    updatePeds(state, STEP);
    state.time += STEP;
  }
  state.player.x = falcon.x;
  state.player.y = falcon.y;
  focusCamera(state);
  syncHud(state);
  return { mode: 'playing' };
}

// Mission in progress: Rook on foot at the Downtown Lot, the red Falcon GT
// waiting with its gold marker, the objective on the HUD.
function stageMission(state) {
  startMission(state, 1);
  const falcon = createCar('falcon', 1820, 1000, 0, 'parked');
  falcon.missionFalcon = true;
  state.cars.push(falcon);
  state.player.x = 1700;
  state.player.y = 1060;
  state.player.angle = 0;
  state.player.onFoot = true;
  state.mode = 'playing';
  state.hint = 'E — steal the Falcon GT';
  state.messages.push({ text: 'Luna wants the red Falcon GT at the Downtown Lot.', kind: 'info', t: state.time });
  stepWorld(state, 1.5);
  focusCamera(state);
  syncHud(state);
  return { mode: 'playing' };
}

// Free roam on the beach: a Cruiser rolling east on the sand, the sea below,
// traffic on the coast road above, a stash glinting ahead.
function stageDrive(state) {
  const cruiser = createCar('cruiser', 1200, 2160, 0, 'player');
  cruiser.speed = 210;
  cruiser.smoke = 0.35;
  state.cars.push(cruiser);
  state.player.car = cruiser;
  state.player.onFoot = false;
  state.player.x = cruiser.x;
  state.player.y = cruiser.y;
  state.player.cash = 1240;
  state.stats.missionsDone = 2;
  state.mode = 'playing';
  state.hint = 'WASD drive • Space handbrake • E exit car';
  state.messages.push({ text: 'Free roam — press N for a taxi fare.', kind: 'info', t: state.time });
  // A couple of cars on the coast road and a stash on the sand.
  const t1 = createCar('liner', 1500, 1824, 0, 'traffic');
  t1.speed = 220;
  t1.targetSpeed = 220;
  const t2 = createCar('bison', 900, 1776, Math.PI, 'traffic');
  t2.speed = 170;
  t2.targetSpeed = 170;
  state.cars.push(t1, t2);
  state.stashes.push({ x: 2050, y: 2140, taken: false, respawn: 0 });
  for (let i = 0; i < Math.round(2.5 / STEP); i++) {
    cruiser.x += cruiser.speed * STEP;
    updateTraffic(state, STEP);
    updatePeds(state, STEP);
    state.time += STEP;
  }
  state.player.x = cruiser.x;
  state.player.y = cruiser.y;
  focusCamera(state);
  syncHud(state);
  return { mode: 'playing' };
}

export function stageShot(name, state) {
  if (name === 'chase') return stageChase(state);
  if (name === 'mission') return stageMission(state);
  if (name === 'drive') return stageDrive(state);
  return stageStart(state);
}

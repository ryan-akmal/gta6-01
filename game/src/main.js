// SOLMAR HEAT — boot and the one loop: input every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Modes: title,
// howto, briefing, playing, paused, missionComplete, busted, wasted.
//
// ?seed=N fixes the city. ?shot=start|chase|mission|drive (with &seed=N) stages
// that scene instead of running the loop, paints it, and sets window.__shotReady.

import { WORLD_W, WORLD_H, TUNING, ECONOMY, PLACES, CAR_MODELS } from './config.js';
import { makeRng } from './random.js';
import { buildCity, nearestRoadPoint, collideBuildings, clampToWorld, inSea } from './city.js';
import { createPlayer, createCar, createPed, dist, driveCar, moveCar, updatePlayerOnFoot, damageCar } from './entities.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { addHeat, updateWanted, updatePolice, damageCopCar } from './police.js';
import { MISSIONS, startMission, updateMission, missionObjective, missionTarget, startFare } from './missions.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer, VIEW_W, VIEW_H } from './render.js';
import { loadSave, writeSave, SAVE_KEY } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261123;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);
const saveData = loadSave();

function createGame(seedValue) {
  const rng = makeRng(seedValue);
  const city = buildCity(seedValue);
  const state = {
    mode: 'title',
    time: 0,
    rng,
    seed: seedValue,
    city,
    player: createPlayer(PLACES.hideout.x + 40, PLACES.hideout.y + 40),
    cars: [],
    peds: [],
    cops: [],
    stashes: [],
    wanted: 0,
    heat: 0,
    heatTimer: 0,
    mission: null,
    missionComplete: null,
    messages: [],
    effects: [],
    camera: { x: 400, y: 300 },
    titleIndex: 0,
    stats: { missionsDone: 0, carsStolen: 0, earned: 0 },
    busted: false,
    wasted: false,
    lastLoss: 0,
    lastDamageAt: -99,
    gunfireTimer: 0,
    trafficTarget: TUNING.trafficCount,
    pedTarget: TUNING.pedCount,
    missionTarget: null,
    missionObjective: null,
    hint: '',
    input,
    audio,
    muted: false,
    saveData,
  };

  state.message = (text, kind) => {
    state.messages.push({ text, kind: kind || 'info', t: state.time });
    if (state.messages.length > 4) state.messages.shift();
  };

  state.saveGame = () => {
    writeSave({
      cash: state.player.cash,
      hp: state.player.hp,
      missionsDone: state.stats.missionsDone,
      earned: state.stats.earned,
      carsStolen: state.stats.carsStolen,
      muted: state.muted,
      x: state.player.x,
      y: state.player.y,
    });
  };

  // Parked cars in the lots and along the streets.
  const parkedModels = ['comet', 'vortex', 'bison', 'liner', 'cruiser'];
  for (const lot of city.lots) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = lot.x + 30 + rng() * (lot.w - 60);
      const y = lot.y + 24 + (i % 2) * (lot.h - 48);
      const car = createCar(parkedModels[Math.floor(rng() * parkedModels.length)], x, y, rng() < 0.5 ? 0 : Math.PI, 'parked');
      state.cars.push(car);
    }
  }
  for (let i = 0; i < 10; i++) {
    const rp = nearestRoadPoint(rng() * WORLD_W, rng() * 1800);
    const car = createCar(parkedModels[Math.floor(rng() * parkedModels.length)], rp.x + (rng() - 0.5) * 30, rp.y + (rng() - 0.5) * 30, rng() * Math.PI * 2, 'parked');
    state.cars.push(car);
  }
  // Cash stashes scattered near the roads.
  for (let i = 0; i < TUNING.stashCount; i++) {
    const rp = nearestRoadPoint(rng() * WORLD_W, rng() * 1800);
    state.stashes.push({ x: rp.x + (rng() - 0.5) * 120, y: rp.y + (rng() - 0.5) * 120, taken: false, respawn: 0 });
  }
  spawnTraffic(state);
  spawnPeds(state);
  return state;
}

const state = createGame(seed);
// A debug handle for play-testing (and for the finalist review to poke at):
// the live game state, read-only by convention.
window.__solmar = state;

function announce(message) {
  status.textContent = message;
}

// --- Entering and leaving cars ----------------------------------------------

function nearestCar(maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.driver === 'wreck') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = state.player;
  if (car.driver === 'cop') {
    state.message('Locked — that is a police Interceptor.', 'bad');
    return;
  }
  if (car.driver === 'traffic') {
    // The driver bails and runs; stealing a driven car draws heat.
    const driver = createPed(state.rng, car.x, car.y);
    driver.state = 'flee';
    driver.fleeX = car.x + (car.x - p.x) * 3;
    driver.fleeY = car.y + (car.y - p.y) * 3;
    state.peds.push(driver);
    state.stats.carsStolen += 1;
    addHeat(state, 1, 'car stolen');
    state.message('You jacked the car!', 'bad');
  }
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  audio.ensure();
  audio.click();
}

function exitCar() {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  let nx = car.x + Math.cos(side) * 30;
  let ny = car.y + Math.sin(side) * 30;
  const pos = collideBuildings(state.city, nx, ny, 13);
  nx = pos.x;
  ny = pos.y;
  if (inSea(nx, ny)) {
    nx = car.x - Math.cos(side) * 30;
    ny = car.y - Math.sin(side) * 30;
  }
  const clamped = clampToWorld(nx, ny, 13);
  p.x = clamped.x;
  p.y = clamped.y;
  p.car = null;
  p.onFoot = true;
}

// --- Combat -------------------------------------------------------------------

function shoot() {
  const p = state.player;
  if (p.shootCd > 0 || !p.onFoot) return;
  p.shootCd = TUNING.gunCooldown;
  audio.ensure();
  audio.shot();
  state.gunfireTimer = 1.2;
  const aim = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);
  p.angle = aim;
  const mx = p.x + Math.cos(aim) * 26;
  const my = p.y + Math.sin(aim) * 26;
  state.effects.push({ kind: 'muzzle', x: mx, y: my, t: 0.08, max: 0.08 });
  // Find the nearest thing the ray hits: cars, peds, then buildings stop it.
  let endX = p.x + Math.cos(aim) * TUNING.gunRange;
  let endY = p.y + Math.sin(aim) * TUNING.gunRange;
  let hit = null;
  let hitD = TUNING.gunRange;
  const consider = (x, y, r, ref) => {
    const dx = x - p.x;
    const dy = y - p.y;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim);
    if (along < 10 || along > hitD) return;
    const perp = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
    if (perp < r + 4) { hitD = along; hit = ref; endX = p.x + Math.cos(aim) * along; endY = p.y + Math.sin(aim) * along; }
  };
  for (const car of state.cars) consider(car.x, car.y, 18, { type: 'car', car });
  for (const ped of state.peds) {
    if (ped.state !== 'down') consider(ped.x, ped.y, 10, { type: 'ped', ped });
  }
  // A building in the way shortens the shot.
  for (const b of state.city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x + Math.cos(aim) * hitD, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y + Math.sin(aim) * hitD, b.y + b.h));
    const dx = cx - p.x;
    const dy = cy - p.y;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim);
    if (along > 10 && along < hitD) {
      const perp = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
      if (perp < 6) { hitD = along; hit = null; endX = cx; endY = cy; }
    }
  }
  state.effects.push({ kind: 'tracer', x: mx, y: my, x2: endX, y2: endY, t: 0.09, max: 0.09 });
  // Debug record for play-testing: what the last shot aimed at and hit.
  state.lastShot = { aim, hit: hit ? hit.type : null, range: Math.round(hitD) };
  addHeat(state, 0.25, 'shots fired');
  if (!hit) return;
  if (hit.type === 'ped') {
    knockPedDown(hit.ped, true);
  } else if (hit.type === 'car') {
    const car = hit.car;
    if (car.driver === 'cop') {
      damageCopCar(state, car, TUNING.gunDamage);
    } else {
      const destroyed = damageCar(car, TUNING.gunDamage);
      if (destroyed) wreckCar(car);
    }
    state.effects.push({ kind: 'sparkle', x: endX, y: endY, t: 0.2, max: 0.2 });
  }
}

function punch() {
  const p = state.player;
  if (p.punchCd > 0 || !p.onFoot) return;
  p.punchCd = 0.4;
  audio.ensure();
  audio.punch();
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(p.x, p.y, ped.x, ped.y) < TUNING.punchRange + 12) {
      knockPedDown(ped, true);
      return;
    }
  }
}

function knockPedDown(ped, byPlayer) {
  ped.state = 'down';
  ped.downTimer = 5;
  ped.speed = 0;
  if (byPlayer) {
    const drop = ECONOMY.pedDropMin + Math.floor(state.rng() * (ECONOMY.pedDropMax - ECONOMY.pedDropMin));
    state.player.cash += drop;
    state.message(`+$${drop}`, 'good');
    audio.cash();
    addHeat(state, 0.5, 'assault');
  }
}

function wreckCar(car) {
  car.driver = 'wreck';
  car.speed = 0;
  car.hp = 0;
  state.effects.push({ kind: 'crash', x: car.x, y: car.y, t: 0.5, max: 0.5 });
  audio.crash();
  if (car.driver === 'player') state.player.car = null;
}

// --- The frame update ---------------------------------------------------------

function updatePlaying(dt) {
  const p = state.player;
  // Mouse position in logical 1280x720 coordinates, then into world coordinates.
  const ratio = window.devicePixelRatio || 1;
  const lx = (input.mouseX * ratio - renderer.view.x) / renderer.view.scale;
  const ly = (input.mouseY * ratio - renderer.view.y) / renderer.view.scale;
  state.mouseLogical = { x: lx, y: ly };
  input.mouseWorldX = state.camera.x + lx;
  input.mouseWorldY = state.camera.y + ly;

  if (input.wasPressed('Escape') || input.wasPressed('p')) {
    state.mode = 'paused';
    state.saveGame();
    announce('Paused.');
    return;
  }
  if (input.wasPressed('m')) {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    state.message(state.muted ? 'Sound muted.' : 'Sound on.', 'info');
  }
  if (input.wasPressed('n') && !state.mission && state.stats.missionsDone >= MISSIONS.length) {
    startFare(state);
  }

  // Enter / exit cars and service interactions.
  if (input.wasPressed('e')) {
    if (p.onFoot) {
      const car = nearestCar(52);
      if (car) enterCar(car);
    } else {
      exitCar();
    }
  }
  if (input.wasPressed('r')) {
    if (p.car && dist(p.car.x, p.car.y, PLACES.spray.x, PLACES.spray.y) < 130 && p.cash >= ECONOMY.repairCost) {
      p.cash -= ECONOMY.repairCost;
      p.car.hp = p.car.maxHp;
      state.heat = 0;
      state.wanted = 0;
      state.cops = [];
      for (const c of state.cars) if (c.driver === 'cop') c.driver = 'traffic';
      state.message("Luna's Spray & Go: fresh paint, clean record. -$100", 'good');
      audio.cash();
    } else if (p.onFoot && dist(p.x, p.y, PLACES.hospital.x, PLACES.hospital.y) < 130 && p.cash >= ECONOMY.healCost && p.hp < 100) {
      p.cash -= ECONOMY.healCost;
      p.hp = 100;
      state.message('Solmar General patched you up. -$50', 'good');
      audio.pickup();
    }
  }
  if (input.wasPressed('f')) punch();
  if (input.mouseClicked || (input.mouseDown && p.shootCd <= 0)) shoot();

  // Move the player.
  if (p.onFoot) {
    const dir = input.anyDirection();
    updatePlayerOnFoot(state, dt, dir);
  } else if (p.car) {
    const car = p.car;
    const throttle = (input.isDown('w') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('s') || input.isDown('ArrowDown') ? 1 : 0);
    const steer = (input.isDown('d') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('a') || input.isDown('ArrowLeft') ? 1 : 0);
    const handbrake = input.isDown(' ');
    const { nx, ny } = driveCar(car, throttle, steer, dt, handbrake);
    const hitHard = moveCar(state, car, nx, ny);
    if (hitHard) {
      audio.crash();
      car.hp -= 6;
      p.hp -= 2;
      state.lastDamageAt = state.time;
      state.effects.push({ kind: 'crash', x: car.x, y: car.y, t: 0.3, max: 0.3 });
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (car.hp <= 0) {
      wreckCar(car);
      p.car = null;
      p.onFoot = true;
      p.hp -= 15;
      state.lastDamageAt = state.time;
      state.message('Your car is wrecked!', 'bad');
    }
    // Running over pedestrians in a fast car.
    if (Math.abs(car.speed) > 120) {
      for (const ped of state.peds) {
        if (ped.state !== 'down' && dist(car.x, car.y, ped.x, ped.y) < 26) {
          knockPedDown(ped, true);
          addHeat(state, 0.5, 'hit and run');
          car.speed *= 0.8;
          audio.crash();
        }
      }
    }
  }

  // Health slowly recovers when the player has been safe for a while.
  if (state.time - state.lastDamageAt > 6 && p.hp > 0 && p.hp < 100) {
    p.hp = Math.min(100, p.hp + 2 * dt);
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateWanted(state, dt);
  updatePolice(state, dt);
  updateMission(state, dt);

  // Cash stashes.
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  for (const s of state.stashes) {
    if (s.taken) {
      s.respawn -= dt;
      if (s.respawn <= 0) {
        const rp = nearestRoadPoint(state.rng() * WORLD_W, state.rng() * 1800);
        s.x = rp.x;
        s.y = rp.y;
        s.taken = false;
      }
      continue;
    }
    if (dist(px, py, s.x, s.y) < 30) {
      s.taken = true;
      s.respawn = 60;
      p.cash += ECONOMY.stashValue;
      state.message(`Stash found! +$${ECONOMY.stashValue}`, 'good');
      audio.cash();
      state.effects.push({ kind: 'sparkle', x: s.x, y: s.y, t: 0.4, max: 0.4 });
    }
  }

  // Effects age out.
  for (let i = state.effects.length - 1; i >= 0; i--) {
    state.effects[i].t -= dt;
    if (state.effects[i].t <= 0) state.effects.splice(i, 1);
  }
  state.gunfireTimer = Math.max(0, state.gunfireTimer - dt);
  state.messages = state.messages.filter((m) => state.time - m.t < 5);

  // HUD helpers.
  state.missionObjective = missionObjective(state);
  state.missionTarget = missionTarget(state);
  state.hint = computeHint();

  // Camera follows the player.
  const tx = Math.max(0, Math.min(WORLD_W - VIEW_W, px - VIEW_W / 2));
  const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, py - VIEW_H / 2));
  state.camera.x += (tx - state.camera.x) * Math.min(1, 8 * dt);
  state.camera.y += (ty - state.camera.y) * Math.min(1, 8 * dt);

  // Engine and siren follow the action.
  audio.setEngine(p.car ? Math.abs(p.car.speed) / CAR_MODELS[p.car.model].top : 0, !!p.car);
  audio.setSiren(state.cops.length > 0 && state.wanted > 0, dt);

  if (state.busted) {
    state.busted = false;
    const loss = Math.floor(p.cash * ECONOMY.bustedLoss);
    p.cash -= loss;
    state.lastLoss = loss;
    respawnAt(PLACES.precinct.x + 90, PLACES.precinct.y + 90);
    state.mode = 'busted';
    audio.busted();
    return;
  }
  if (state.wasted || p.hp <= 0) {
    state.wasted = false;
    const loss = Math.floor(p.cash * ECONOMY.wastedLoss);
    p.cash -= loss;
    state.lastLoss = loss;
    respawnAt(PLACES.hospital.x + 90, PLACES.hospital.y + 90);
    state.mode = 'wasted';
    audio.busted();
  }
}

function respawnAt(x, y) {
  const p = state.player;
  if (p.car) {
    p.car.driver = 'parked';
    p.car = null;
  }
  p.onFoot = true;
  p.x = x;
  p.y = y;
  p.hp = 100;
  state.heat = 0;
  state.wanted = 0;
  state.cops = [];
  for (const c of state.cars) if (c.driver === 'cop') c.driver = 'traffic';
  state.camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, x - VIEW_W / 2));
  state.camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, y - VIEW_H / 2));
}

function computeHint() {
  const p = state.player;
  if (p.onFoot) {
    const car = nearestCar(52);
    if (car) return `E — get in the ${CAR_MODELS[car.model].name}`;
    if (dist(p.x, p.y, PLACES.hospital.x, PLACES.hospital.y) < 130 && p.hp < 100) return 'R — heal up at Solmar General ($50)';
    return 'WASD move • E enter car • Click shoot • F punch';
  }
  if (dist(p.car.x, p.car.y, PLACES.spray.x, PLACES.spray.y) < 130) return "R — repair & clear heat at Luna's ($100)";
  return 'WASD drive • Space handbrake • E exit car';
}

// --- Modes --------------------------------------------------------------------

function startNewGame() {
  const fresh = createGame(seed);
  // Keep the audio/input bindings and the save slot.
  Object.assign(state, fresh, { mode: 'briefing', audio, input, saveData, muted: state.muted });
  audio.setMuted(state.muted);
  startMission(state, 0);
  announce('Mission: First Fare. Mara waits at the Marina.');
}

function continueGame() {
  const data = saveData;
  if (!data) return;
  const fresh = createGame(seed);
  Object.assign(state, fresh, { mode: 'playing', audio, input, saveData, muted: state.muted });
  state.player.cash = data.cash;
  state.player.hp = data.hp;
  state.stats.missionsDone = data.missionsDone;
  state.stats.earned = data.earned || 0;
  state.stats.carsStolen = data.carsStolen || 0;
  state.player.x = data.x ?? PLACES.hideout.x;
  state.player.y = data.y ?? PLACES.hideout.y;
  if (state.stats.missionsDone < MISSIONS.length) {
    state.mode = 'briefing';
    startMission(state, state.stats.missionsDone);
  }
  announce('Welcome back to Solmar City.');
}

function updateTitle(dt) {
  // Attract mode: the city lives behind the menu and the camera drifts.
  updateTraffic(state, dt);
  updatePeds(state, dt);
  state.camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, 1500 + Math.sin(state.time * 0.05) * 700 - VIEW_W / 2));
  state.camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, 900 + Math.cos(state.time * 0.04) * 350 - VIEW_H / 2));
  const rows = saveData ? 3 : 2;
  if (input.wasPressed('ArrowUp') || input.wasPressed('w')) {
    state.titleIndex = (state.titleIndex + rows - 1) % rows;
    audio.ensure();
    audio.click();
  }
  if (input.wasPressed('ArrowDown') || input.wasPressed('s')) {
    state.titleIndex = (state.titleIndex + 1) % rows;
    audio.ensure();
    audio.click();
  }
  if (input.wasPressed('1')) pickTitle(0);
  if (input.wasPressed('2')) pickTitle(1);
  if (input.wasPressed('3')) pickTitle(2);
  if (input.wasPressed('Enter') || input.mouseClicked) pickTitle(state.titleIndex);
}

function pickTitle(index) {
  audio.ensure();
  audio.click();
  if (index === 0) {
    startNewGame();
  } else if (index === 1 && saveData) {
    continueGame();
  } else if ((index === 1 && !saveData) || index === 2) {
    state.mode = 'howto';
  }
}

function frame(now) {
  // Manual mode is for the self-test driver: it calls __solmarFrame itself
  // with its own clock instead of letting requestAnimationFrame drive the loop.
  if (!window.__solmarManual) requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  state.time += dt;
  if (state.mode === 'title') updateTitle(dt);
  else if (state.mode === 'howto') {
    if (input.wasPressed('Escape') || input.wasPressed('Enter')) state.mode = 'title';
  } else if (state.mode === 'briefing') {
    if (input.wasPressed('Enter')) {
      state.mode = 'playing';
      announce(`Mission started: ${state.mission.def.title}`);
    }
  } else if (state.mode === 'playing') {
    updatePlaying(dt);
  } else if (state.mode === 'paused') {
    if (input.wasPressed('Escape') || input.wasPressed('p')) {
      state.mode = 'playing';
      announce('Playing.');
    } else if (input.wasPressed('s')) {
      state.saveGame();
      state.message('Game saved.', 'good');
    } else if (input.wasPressed('m')) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    } else if (input.wasPressed('q')) {
      state.mode = 'title';
      announce('SOLMAR HEAT. Press Space or click to start.');
    }
  } else if (state.mode === 'missionComplete') {
    if (input.wasPressed('Enter')) {
      state.missionComplete = null;
      if (state.stats.missionsDone < MISSIONS.length) {
        state.mode = 'briefing';
        startMission(state, state.stats.missionsDone);
      } else {
        state.mode = 'playing';
        state.message('Free roam — press N for a taxi fare.', 'info');
      }
    }
  } else if (state.mode === 'busted' || state.mode === 'wasted') {
    if (input.wasPressed('Enter')) {
      state.mode = 'playing';
      state.saveGame();
      announce('Back on the streets.');
    }
  }
  renderer.draw(state, saveData);
  input.endFrame();
}

// --- Boot ---------------------------------------------------------------------

let last = performance.now();

function runShot(name) {
  const scene = stageShot(name, state);
  state.mode = scene.mode;
  let painted = 0;
  function paint() {
    renderer.draw(state, saveData);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else {
  announce('SOLMAR HEAT. Press 1 for a new game.');
  window.__solmarFrame = frame;
  requestAnimationFrame(frame);
}

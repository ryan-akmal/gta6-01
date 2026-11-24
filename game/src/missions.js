// SOLMAR HEAT — the story: five missions for Rook Santana, a driver-for-hire
// in Solmar City, plus a repeatable taxi fare once the story is done. Each
// mission is a small stage machine: reach a marker, do the thing, get paid.

import { PLACES, MISSION_REWARDS } from './config.js';
import { dist, createCar } from './entities.js';
import { addHeat } from './police.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    client: 'Mara',
    briefing: [
      'Mara needs a ride from the Marina to the Sunset Hotel.',
      'Get in a car, pick her up, and drive her there in one piece.',
      'Tip: press E near a car to get in. Stealing a car draws heat.',
    ],
    reward: MISSION_REWARDS[0],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    client: 'Luna',
    briefing: [
      'Luna wants the red Falcon GT parked at the Downtown Lot.',
      'Take it — quietly if you can — and bring it to her spray shop.',
      "Luna's Spray & Go will clear your wanted level as a thank-you.",
    ],
    reward: MISSION_REWARDS[1],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    client: 'Rook',
    briefing: [
      'The precinct put a price on your head: 3 stars, right now.',
      'Lose the heat and make it to Rook\'s Garage. Lay low, use the alleys,',
      'and do not let an Interceptor sit on you — they will bust you.',
    ],
    reward: MISSION_REWARDS[2],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    client: 'Mara',
    briefing: [
      'Three packages are stashed around the city. Collect all three',
      'within 2 minutes 30 seconds. The cops are watching the streets,',
      'so keep moving and do not cause a scene.',
    ],
    reward: MISSION_REWARDS[3],
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    client: 'Luna',
    briefing: [
      'One hot package at the Marina, one buyer at Palm Beach.',
      'You have 90 seconds and the whole precinct will be on you',
      'the moment you grab it. Drive like your life depends on it.',
    ],
    reward: MISSION_REWARDS[4],
  },
];

// Where the mission's markers live, in world coordinates.
const PACKAGE_SPOTS = [
  { x: 600, y: 200, label: 'Package 1 — Old Town' },
  { x: 2600, y: 1000, label: 'Package 2 — Downtown' },
  { x: 1400, y: 1800, label: 'Package 3 — Harbor' },
];

// Waypoint beacon colour per mission (fare green, heat-wave red, ...).
const TARGET_COLORS = { 0: '#7dff8a', 1: '#ffd94f', 2: '#ff5a3c', 3: '#7ad9ff', 4: '#ff8ad9', 99: '#7dff8a' };

function coloredTarget(t, index) {
  if (!t) return t;
  return { ...t, color: TARGET_COLORS[index] || '#ffd94f' };
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  const m = {
    index, def, stage: 0, timer: 0, target: null,
    packages: [], collected: 0, passenger: false, done: false,
  };
  if (index === 0) m.target = { x: PLACES.marina.x, y: PLACES.marina.y, label: 'Marina — pick up Mara' };
  if (index === 1) {
    m.target = { x: PLACES.lot.x, y: PLACES.lot.y, label: 'Downtown Lot — the red Falcon GT' };
    // The red Falcon GT waits in the lot (spawn it if it is not there yet).
    if (!state.cars.some((c) => c.missionFalcon)) {
      const falcon = createCar('falcon', PLACES.lot.x + 20, PLACES.lot.y, 0, 'parked');
      falcon.missionFalcon = true;
      state.cars.push(falcon);
    }
  }
  if (index === 2) {
    addHeat(state, 3, 'the precinct wants you');
    m.target = { x: PLACES.hideout.x, y: PLACES.hideout.y, label: "Rook's Garage — lose the heat" };
    m.timer = 150;
  }
  if (index === 3) {
    m.packages = PACKAGE_SPOTS.map((p) => ({ ...p, taken: false }));
    m.target = { x: m.packages[0].x, y: m.packages[0].y, label: m.packages[0].label };
    m.timer = 150;
  }
  if (index === 4) {
    m.target = { x: PLACES.marina.x, y: PLACES.marina.y, label: 'Marina — grab the package' };
    m.timer = 90;
  }
  m.target = coloredTarget(m.target, index);
  state.mission = m;
  state.audio.missionStart();
  state.message(`Mission: ${def.title} — ${def.client}`, 'info');
}

export function missionObjective(state) {
  const m = state.mission;
  if (!m) return null;
  if (m.index === 0) {
    if (m.stage === 0) return 'Pick up Mara at the Marina';
    return 'Drive Mara to the Sunset Hotel';
  }
  if (m.index === 1) {
    if (m.stage === 0) return 'Steal the red Falcon GT at the Downtown Lot';
    return "Deliver the Falcon to Luna's Spray & Go";
  }
  if (m.index === 2) return "Reach Rook's Garage and lose the heat";
  if (m.index === 3) return `Collect the packages (${m.collected}/3)`;
  if (m.index === 4) {
    if (m.stage === 0) return 'Grab the package at the Marina';
    return 'Deliver to Palm Beach — fast!';
  }
  return 'Drive the fare to the marker';
}

export function missionTarget(state) {
  const m = state.mission;
  return m ? m.target : null;
}

function completeMission(state) {
  const m = state.mission;
  const reward = m.def.reward;
  state.player.cash += reward;
  state.stats.missionsDone += 1;
  state.stats.earned += reward;
  state.message(`Mission complete: ${m.def.title} — +$${reward}`, 'good');
  state.audio.missionDone();
  state.missionComplete = m;
  state.mission = null;
  state.mode = 'missionComplete';
  state.saveGame();
}

function failMission(state, why) {
  state.message(`Mission failed: ${why}`, 'bad');
  state.audio.busted();
  state.mission = null;
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }

  const near = (t, r) => t && dist(px, py, t.x, t.y) < (r || 70);

  if (m.index === 0) {
    if (m.stage === 0 && near(m.target, 70)) {
      if (!p.car) {
        state.message('Mara: "Get a car first, driver!"', 'info');
        return;
      }
      m.stage = 1;
      m.passenger = true;
      m.target = coloredTarget({ x: PLACES.hotel.x, y: PLACES.hotel.y, label: 'Sunset Hotel — drop off Mara' }, m.index);
      state.message('Mara is in. Drive her to the Sunset Hotel.', 'info');
    } else if (m.stage === 1 && near(m.target, 80)) {
      completeMission(state);
    }
  } else if (m.index === 1) {
    if (m.stage === 0) {
      const falcon = state.cars.find((c) => c.missionFalcon);
      if (falcon && p.car === falcon) {
        m.stage = 1;
        m.target = coloredTarget({ x: PLACES.spray.x, y: PLACES.spray.y, label: "Luna's Spray & Go" }, m.index);
        state.message('Got the Falcon. Take it to Luna — fast, before the heat finds you.', 'info');
      }
    } else if (near(m.target, 90) && p.car && p.car.missionFalcon) {
      // Luna clears the heat and takes the car.
      state.heat = 0;
      state.wanted = 0;
      state.cops = [];
      for (const c of state.cars) if (c.driver === 'cop') c.driver = 'traffic';
      state.cars = state.cars.filter((c) => c !== p.car);
      p.car = null;
      p.onFoot = true;
      p.x = PLACES.spray.x + 60;
      p.y = PLACES.spray.y + 60;
      completeMission(state);
    }
  } else if (m.index === 2) {
    if (near(m.target, 80) && state.wanted === 0) {
      completeMission(state);
    } else if (near(m.target, 80) && state.wanted > 0) {
      state.message('Too hot — lose the stars first, then come back.', 'info');
    }
  } else if (m.index === 3) {
    for (const pkg of m.packages) {
      if (!pkg.taken && dist(px, py, pkg.x, pkg.y) < 60) {
        pkg.taken = true;
        m.collected += 1;
        state.player.cash += 25;
        state.audio.cash();
        state.message(`Package ${m.collected}/3 collected (+$25)`, 'good');
        const next = m.packages.find((q) => !q.taken);
        m.target = coloredTarget(next ? { x: next.x, y: next.y, label: next.label } : null, m.index);
        if (m.collected === 3) completeMission(state);
        break;
      }
    }
  } else if (m.index === 4) {
    if (m.stage === 0 && near(m.target, 70)) {
      m.stage = 1;
      m.timer = 90;
      addHeat(state, 2, 'the package is hot');
      m.target = coloredTarget({ x: 2600, y: 1800, label: 'Palm Beach — the buyer' }, m.index);
      state.message('Package grabbed. 90 seconds to Palm Beach — GO!', 'bad');
    } else if (m.stage === 1 && near(m.target, 80)) {
      completeMission(state);
    }
  }
}

// --- The repeatable fare, once the story is done ---------------------------

export function startFare(state) {
  const rng = state.rng;
  const spots = Object.values(PLACES);
  const from = spots[Math.floor(rng() * spots.length)];
  let to = spots[Math.floor(rng() * spots.length)];
  while (to === from) to = spots[Math.floor(rng() * spots.length)];
  state.mission = {
    index: 99, def: { id: 'fare', title: 'Taxi Fare', client: 'Passenger', reward: 100 },
    stage: 0, timer: 120, target: coloredTarget({ x: from.x, y: from.y, label: `${from.name} — pick up the fare` }, 99),
    packages: [], collected: 0, passenger: false, done: false, fareFrom: from, fareTo: to,
  };
  state.audio.missionStart();
  state.message('Taxi fare: pick up the passenger.', 'info');
}

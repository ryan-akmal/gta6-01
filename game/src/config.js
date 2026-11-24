// SOLMAR HEAT — configuration: world size, colours, vehicles, economy and tuning.
// Everything here is original: the city of Solmar, its districts, people and cars
// are invented for this game and share nothing with any commercial title.

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const ROAD_SPACING = 400;
export const ROAD_FIRST = 200;

// Vertical roads at x = 200, 600, ... 3000; horizontal roads at y = 200, ... 1800.
// Below y = 2050 the city gives way to the beach and the sea.
export const VERTICAL_ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const HORIZONTAL_ROADS = [200, 600, 1000, 1400, 1800];
export const BEACH_Y = 2050;
export const SEA_Y = 2300;

export const COLORS = {
  grass: '#5d9b4a',
  grassDark: '#4c8340',
  road: '#33373f',
  roadLine: '#d8c95a',
  sidewalk: '#9a938a',
  sand: '#e3cd8f',
  sea: '#1f6f9e',
  seaDeep: '#155a82',
  buildingRoof: '#b08968',
  park: '#3f7d33',
  plaza: '#8d8578',
};

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1200, h: 800 },
  { name: 'Downtown', x: 1200, y: 0, w: 2000, h: 800 },
  { name: 'Harbor', x: 0, y: 800, w: 1200, h: 1250 },
  { name: 'Palm Beach', x: 1200, y: 800, w: 2000, h: 1250 },
];

// Named places the missions and the HUD point at. All invented.
export const PLACES = {
  marina: { name: 'Marina', x: 600, y: 1980, label: 'Marina' },
  hotel: { name: 'Sunset Hotel', x: 2600, y: 600, label: 'Sunset Hotel' },
  spray: { name: "Luna's Spray & Go", x: 1000, y: 1400, label: "Luna's Spray & Go" },
  lot: { name: 'Downtown Lot', x: 1800, y: 1000, label: 'Downtown Lot' },
  precinct: { name: 'Precinct 9', x: 1400, y: 600, label: 'Precinct 9' },
  hospital: { name: 'Solmar General', x: 2200, y: 1400, label: 'Solmar General' },
  hideout: { name: "Rook's Garage", x: 600, y: 1000, label: "Rook's Garage" },
  plaza: { name: 'Solmar Plaza', x: 1800, y: 1400, label: 'Solmar Plaza' },
};

// Vehicle models: top speed (px/s), acceleration, grip and look. All invented names.
export const CAR_MODELS = {
  comet: { name: 'Comet', top: 380, accel: 260, grip: 2.6, len: 44, wid: 22, color: '#c94f42', hp: 80 },
  vortex: { name: 'Vortex', top: 420, accel: 300, grip: 2.8, len: 46, wid: 22, color: '#3f6fb5', hp: 90 },
  bison: { name: 'Bison', top: 340, accel: 220, grip: 2.2, len: 52, wid: 24, color: '#7a6a4f', hp: 130 },
  falcon: { name: 'Falcon GT', top: 560, accel: 420, grip: 3.4, len: 46, wid: 22, color: '#d21f2b', hp: 70 },
  liner: { name: 'Liner Taxi', top: 400, accel: 280, grip: 2.7, len: 48, wid: 22, color: '#e8b923', hp: 90 },
  cruiser: { name: 'Cruiser', top: 360, accel: 240, grip: 2.5, len: 48, wid: 24, color: '#4f7a5a', hp: 100 },
  interceptor: { name: 'Interceptor', top: 520, accel: 400, grip: 3.2, len: 48, wid: 23, color: '#1c2733', hp: 110 },
};

export const ECONOMY = {
  startCash: 50,
  pedDropMin: 5,
  pedDropMax: 25,
  stashValue: 50,
  repairCost: 100,
  healCost: 50,
  bustedLoss: 0.15,
  wastedLoss: 0.1,
};

export const TUNING = {
  playerWalk: 170,
  playerRun: 250,
  playerHp: 100,
  wantedDecaySeconds: 25,
  maxWanted: 5,
  copBustSeconds: 2.5,
  copRamDamage: 8,
  gunDamage: 34,
  gunRange: 430,
  gunCooldown: 0.24,
  punchDamage: 16,
  punchRange: 34,
  trafficCount: 14,
  pedCount: 26,
  stashCount: 12,
};

export const MISSION_REWARDS = [150, 300, 400, 500, 800];

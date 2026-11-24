// SOLMAR HEAT — the city. Builds the road grid, the blocks between the roads,
// the buildings, parks, parking lots and named places, plus the collision and
// "is this point on a road" helpers the cars, pedestrians and police share.

import { WORLD_W, WORLD_H, ROAD_W, VERTICAL_ROADS, HORIZONTAL_ROADS, BEACH_Y, SEA_Y, PLACES } from './config.js';
import { makeRng, pick, range, rangeInt, chance } from './random.js';

const ROOF_COLORS = ['#b08968', '#8d7d6b', '#a87c5f', '#7d8ba0', '#9c8a7a', '#6f7f6a', '#b5a48c'];
const WALL_COLORS = ['#c9b18c', '#a8b8c4', '#c4a484', '#b8c4b0', '#d0c0a8', '#9fb4c8'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    buildings: [], // {x, y, w, h, roof, wall, windows, special}
    parks: [], // {x, y, w, h, trees: [{x,y,r}]}
    lots: [], // {x, y, w, h} parking lots with parked cars
    trees: [],
    lamps: [],
  };
  const half = ROAD_W / 2;

  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...VERTICAL_ROADS, WORLD_W];
  const ys = [0, ...HORIZONTAL_ROADS, BEACH_Y];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + (bi === 0 ? 0 : half + 14);
      const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 0 : half + 14);
      const y0 = ys[bj] + (bj === 0 ? 0 : half + 14);
      const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 0 : half + 14);
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const roll = rng();
      if (roll < 0.16) {
        // A park: green block with scattered trees.
        const park = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: [] };
        const n = rangeInt(rng, 4, 9);
        for (let i = 0; i < n; i++) {
          park.trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 9, 15) });
        }
        city.parks.push(park);
        city.trees.push(...park.trees);
      } else if (roll < 0.3) {
        // A parking lot: flat asphalt with parked cars (spawned by entities).
        city.lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      } else {
        // Buildings: 1-4 per block, placed on a loose grid inside it.
        const cols = rangeInt(rng, 1, 2);
        const rows = rangeInt(rng, 1, 2);
        const cw = (x1 - x0) / cols;
        const ch = (y1 - y0) / rows;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (chance(rng, 0.18)) continue;
            const bw = range(rng, cw * 0.45, cw * 0.8);
            const bh = range(rng, ch * 0.45, ch * 0.8);
            const bx = x0 + c * cw + (cw - bw) / 2 + range(rng, -8, 8);
            const by = y0 + r * ch + (ch - bh) / 2 + range(rng, -8, 8);
            city.buildings.push({
              x: bx, y: by, w: bw, h: bh,
              roof: pick(rng, ROOF_COLORS),
              wall: pick(rng, WALL_COLORS),
              windows: rangeInt(rng, 4, 12),
              special: null,
            });
          }
        }
      }
    }
  }

  // Named places get a marked building (or a clear lot) so missions can point at them.
  const specials = [
    { key: 'hotel', color: '#e8d27a', roof: '#c9a227' },
    { key: 'precinct', color: '#7a9cc4', roof: '#3f6fb5' },
    { key: 'hospital', color: '#e8e8e8', roof: '#c94f42' },
    { key: 'spray', color: '#d27ac9', roof: '#8e3f8a' },
    { key: 'hideout', color: '#8a7a5a', roof: '#5a4a3a' },
  ];
  for (const s of specials) {
    const p = PLACES[s.key];
    // Clear any building overlapping the marker, then plant the special one.
    city.buildings = city.buildings.filter((b) => Math.abs(b.x + b.w / 2 - p.x) > 130 || Math.abs(b.y + b.h / 2 - p.y) > 130);
    city.buildings.push({
      x: p.x - 70, y: p.y - 50, w: 140, h: 100,
      roof: s.roof, wall: s.color, windows: 10, special: s.key,
    });
  }

  // Street lamps along the roads, for the night-time look of the map.
  for (const rx of VERTICAL_ROADS) {
    for (let y = 120; y < BEACH_Y; y += 400) {
      city.lamps.push({ x: rx + half + 6, y });
      city.lamps.push({ x: rx - half - 6, y: y + 200 });
    }
  }
  for (const ry of HORIZONTAL_ROADS) {
    for (let x = 120; x < WORLD_W; x += 400) {
      city.lamps.push({ x, y: ry + half + 6 });
    }
  }

  // Beach props: palms and umbrellas on the sand strip.
  city.beachProps = [];
  for (let i = 0; i < 16; i++) {
    city.beachProps.push({
      kind: 'palm',
      x: range(rng, 80, WORLD_W - 80),
      y: range(rng, BEACH_Y + 30, SEA_Y - 60),
      r: range(rng, 10, 15),
    });
  }
  for (let i = 0; i < 9; i++) {
    city.beachProps.push({
      kind: 'umbrella',
      x: range(rng, 120, WORLD_W - 120),
      y: range(rng, BEACH_Y + 40, SEA_Y - 90),
      color: pick(rng, ['#e84f6a', '#4fb5e8', '#e8b923', '#7ad94f', '#c94fd9']),
    });
  }
  return city;
}

// --- Queries shared by the simulation ---------------------------------------

export function onRoad(x, y) {
  for (const rx of VERTICAL_ROADS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of HORIZONTAL_ROADS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function onBeach(x, y) {
  return y >= BEACH_Y && y < SEA_Y;
}

export function inSea(x, y) {
  return y >= SEA_Y;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of VERTICAL_ROADS) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of HORIZONTAL_ROADS) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

// Circle (x, y, r) against every building: push the circle out and report a hit.
export function collideBuildings(city, x, y, r) {
  let hit = null;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      const push = r - d;
      x += (dx / d) * push;
      y += (dy / d) * push;
      hit = b;
    }
  }
  return { x, y, hit };
}

export function clampToWorld(x, y, r) {
  return {
    x: Math.max(r, Math.min(WORLD_W - r, x)),
    y: Math.max(r, Math.min(WORLD_H - r, y)),
  };
}

export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    return { x: pick(rng, VERTICAL_ROADS) + range(rng, -20, 20), y: range(rng, 100, BEACH_Y - 100), vertical: true };
  }
  return { x: range(rng, 100, WORLD_W - 100), y: pick(rng, HORIZONTAL_ROADS) + range(rng, -20, 20), vertical: false };
}

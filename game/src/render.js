// SOLMAR HEAT — drawing only: the city, the cars and people in it, the effects,
// then the HUD with its minimap and the menu screens. The canvas is a logical
// 1280x720 view scaled to the window; the camera follows the player.

import { WORLD_W, WORLD_H, ROAD_W, VERTICAL_ROADS, HORIZONTAL_ROADS, BEACH_Y, SEA_Y, PLACES, DISTRICTS, CAR_MODELS, COLORS } from './config.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW_W, h / VIEW_H);
    view.x = (w - VIEW_W * view.scale) / 2;
    view.y = (h - VIEW_H * view.scale) / 2;
  }

  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- The world -----------------------------------------------------------

  function drawWorld(state) {
    const cam = state.camera;
    const x0 = cam.x - 60;
    const y0 = cam.y - 60;
    const x1 = cam.x + VIEW_W + 60;
    const y1 = cam.y + VIEW_H + 60;

    // Grass base.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // District tint: Downtown a little dustier, Palm Beach warmer.
    ctx.fillStyle = 'rgba(214, 186, 120, 0.10)';
    ctx.fillRect(1200, 0, WORLD_W - 1200, 800);
    ctx.fillStyle = 'rgba(255, 220, 160, 0.08)';
    ctx.fillRect(1200, 800, WORLD_W - 1200, 1250);

    // Beach and sea.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x0, BEACH_Y, x1 - x0, SEA_Y - BEACH_Y);
    const wave = Math.sin(state.time * 1.4) * 4;
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(x0, SEA_Y + wave, x1 - x0, WORLD_H - SEA_Y);
    ctx.fillStyle = COLORS.seaDeep;
    for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
      ctx.fillRect(x, SEA_Y + 40 + wave, 46, 5);
      ctx.fillRect(x + 30, SEA_Y + 110 + wave, 52, 5);
    }
    // Marina piers.
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(430, BEACH_Y + 30, 18, 130);
    ctx.fillRect(700, BEACH_Y + 30, 18, 130);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(430, BEACH_Y + 140, 18, 10);
    ctx.fillRect(700, BEACH_Y + 140, 18, 10);

    // Beach props: palms and umbrellas on the sand.
    for (const prop of state.city.beachProps || []) {
      if (prop.x < x0 || prop.x > x1 || prop.y < y0 || prop.y > y1) continue;
      if (prop.kind === 'palm') {
        ctx.strokeStyle = '#7a5a3a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.lineTo(prop.x + 6, prop.y - 16);
        ctx.stroke();
        ctx.fillStyle = '#2c7a34';
        ctx.beginPath();
        ctx.arc(prop.x + 8, prop.y - 18, prop.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f9e46';
        ctx.beginPath();
        ctx.arc(prop.x + 4, prop.y - 22, prop.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#8a6f4d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.lineTo(prop.x, prop.y - 16);
        ctx.stroke();
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y - 16, 14, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(prop.x - 14, prop.y - 16, 28, 3);
      }
    }

    // Parks.
    for (const park of state.city.parks) {
      if (park.x > x1 || park.y > y1 || park.x + park.w < x0 || park.y + park.h < y0) continue;
      ctx.fillStyle = COLORS.park;
      roundRect(park.x, park.y, park.w, park.h, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(park.x + 10, park.y + 10, park.w - 20, 6);
    }
    // Parking lots.
    for (const lot of state.city.lots) {
      if (lot.x > x1 || lot.y > y1 || lot.x + lot.w < x0 || lot.y + lot.h < y0) continue;
      ctx.fillStyle = '#4a4d52';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let sx = lot.x + 24; sx < lot.x + lot.w - 20; sx += 52) {
        ctx.strokeRect(sx, lot.y + 14, 40, 20);
        ctx.strokeRect(sx, lot.y + lot.h - 34, 40, 20);
      }
    }

    // Roads: asphalt, sidewalk edge, dashed centre line. Vertical roads stop
    // at the beach — they never run into the sea.
    const roadBottom = Math.min(y1, BEACH_Y);
    ctx.fillStyle = COLORS.sidewalk;
    for (const rx of VERTICAL_ROADS) ctx.fillRect(rx - ROAD_W / 2 - 10, y0, ROAD_W + 20, roadBottom - y0);
    for (const ry of HORIZONTAL_ROADS) ctx.fillRect(x0, ry - ROAD_W / 2 - 10, x1 - x0, ROAD_W + 20);
    ctx.fillStyle = COLORS.road;
    for (const rx of VERTICAL_ROADS) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, roadBottom - y0);
    for (const ry of HORIZONTAL_ROADS) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
    ctx.fillStyle = COLORS.roadLine;
    for (const rx of VERTICAL_ROADS) {
      for (let y = Math.floor(y0 / 48) * 48; y < roadBottom; y += 48) ctx.fillRect(rx - 2, y, 4, 24);
    }
    for (const ry of HORIZONTAL_ROADS) {
      for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) ctx.fillRect(x, ry - 2, 24, 4);
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of VERTICAL_ROADS) {
      for (const ry of HORIZONTAL_ROADS) {
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(rx + i * 12 - 4, ry - ROAD_W / 2 + 6, 8, 14);
          ctx.fillRect(rx + i * 12 - 4, ry + ROAD_W / 2 - 20, 8, 14);
        }
      }
    }

    // Trees.
    for (const t of state.city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = '#2c5a24';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f7d33';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Buildings: wall, roof, windows, and a label for the named places.
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < b.windows && i < cols * rows; i++) {
        const wx = b.x + 10 + (i % cols) * 26;
        const wy = b.y + 10 + Math.floor(i / cols) * 26;
        ctx.fillRect(wx, wy, 10, 8);
      }
      if (b.special) {
        const place = PLACES[b.special];
        ctx.font = font(13, true);
        ctx.fillStyle = '#1c2733';
        ctx.textAlign = 'center';
        ctx.fillText(place.label, b.x + b.w / 2, b.y + b.h + 16);
        ctx.fillStyle = '#c94f42';
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y - 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Street lamps.
    ctx.fillStyle = '#2b2f36';
    for (const lamp of state.city.lamps) {
      if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    }

    // District names, faint on the ground.
    ctx.font = font(26, true);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
    }
  }

  // --- Entities --------------------------------------------------------------

  function drawCarShape(car, flash) {
    const m = CAR_MODELS[car.model];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(-m.len / 2 + 3, -m.wid / 2 + 3, m.len, m.wid, 7);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(-m.len / 2, -m.wid / 2, m.len, m.wid, 7);
    ctx.fill();
    // Windshield + roof + rear window.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    ctx.fillRect(m.len * 0.12, -m.wid / 2 + 3, m.len * 0.22, m.wid - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-m.len * 0.28, -m.wid / 2 + 3, m.len * 0.3, m.wid - 6);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(m.len / 2 - 3, -m.wid / 2 + 2, 3, 5);
    ctx.fillRect(m.len / 2 - 3, m.wid / 2 - 7, 3, 5);
    if (car.model === 'interceptor') {
      // Black-and-white cruiser with a flashing light bar.
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-m.len * 0.28, -m.wid / 2 + 2, m.len * 0.3, m.wid - 4);
      const phase = Math.floor(flash * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2b2b' : '#2b6bff';
      ctx.fillRect(-6, -m.wid / 2 - 2, 12, 5);
      ctx.fillStyle = phase ? '#2b6bff' : '#ff2b2b';
      ctx.fillRect(-6, m.wid / 2 - 3, 12, 5);
    }
    if (car.model === 'liner') {
      ctx.fillStyle = '#1c2733';
      ctx.font = font(9, true);
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.missionFalcon) {
      ctx.strokeStyle = '#ffd94f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-m.len / 2 - 4, -m.wid / 2 - 4, m.len + 8, m.wid + 8);
    }
    ctx.restore();
    if (car.smoke > 0.3) {
      ctx.fillStyle = 'rgba(90,90,90,0.55)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 14 + Math.sin(flash * 7) * 4, car.y - Math.sin(car.angle) * 14, 6 + Math.sin(flash * 9) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPedShape(ped) {
    if (ped.state === 'down') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(12, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = ped.speed > 0 ? Math.sin(ped.x * 0.35 + ped.y * 0.35) * 1.5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayerShape(state) {
    const p = state.player;
    if (p.onFoot) {
      if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 9, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e86a1c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4 - 1, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1c2733';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      ctx.stroke();
    }
  }

  function drawEffects(state) {
    for (const e of state.effects) {
      const age = 1 - e.t / e.max;
      if (e.kind === 'muzzle') {
        ctx.fillStyle = `rgba(255, 214, 80, ${age})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 10 * age + 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'tracer') {
        ctx.strokeStyle = `rgba(255, 230, 120, ${age})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x2, e.y2);
        ctx.stroke();
      } else if (e.kind === 'crash') {
        ctx.fillStyle = `rgba(255, 120, 40, ${age})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16 * age + 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'sparkle') {
        ctx.fillStyle = `rgba(255, 217, 79, ${age})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 5 + 8 * (1 - age), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Cash stashes: glowing green $ markers.
    for (const s of state.stashes) {
      if (s.taken) continue;
      const pulse = 0.6 + Math.sin(state.time * 4 + s.x) * 0.25;
      ctx.fillStyle = `rgba(80, 220, 120, ${pulse})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = font(14, true);
      ctx.fillStyle = '#0b3d1c';
      ctx.textAlign = 'center';
      ctx.fillText('$', s.x, s.y + 5);
    }
    // Mission waypoint: a beacon of light plus a floating diamond.
    const target = state.missionTarget;
    if (target) {
      const pulse = 0.55 + Math.sin(state.time * 5) * 0.3;
      ctx.fillStyle = `rgba(255, 217, 79, ${pulse * 0.25})`;
      ctx.fillRect(target.x - 14, target.y - 120, 28, 120);
      ctx.fillStyle = '#ffd94f';
      ctx.save();
      ctx.translate(target.x, target.y - 30 + Math.sin(state.time * 3) * 6);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      ctx.strokeStyle = '#ffd94f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 26 + Math.sin(state.time * 5) * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Package markers for The Pickup.
    if (state.mission && state.mission.packages) {
      for (const pkg of state.mission.packages) {
        if (pkg.taken) continue;
        ctx.fillStyle = '#ffd94f';
        ctx.fillRect(pkg.x - 9, pkg.y - 7, 18, 14);
        ctx.fillStyle = '#8a6d1c';
        ctx.fillRect(pkg.x - 9, pkg.y - 1, 18, 3);
      }
    }
  }

  // --- Minimap -------------------------------------------------------------

  function drawMinimap(state) {
    const mw = 210;
    const mh = 150;
    const mx = VIEW_W - mw - 16;
    const my = 92;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.78)';
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#3d6b34';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#1f6f9e';
    ctx.fillRect(mx, my + BEACH_Y * sy, mw, (WORLD_H - BEACH_Y) * sy);
    ctx.fillStyle = '#33373f';
    for (const rx of VERTICAL_ROADS) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of HORIZONTAL_ROADS) ctx.fillRect(mx, my + ry * sy, mw, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const b of state.city.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
    const dot = (x, y, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.missionTarget) dot(state.missionTarget.x, state.missionTarget.y, 5, '#ffd94f');
    for (const cop of state.cops) dot(cop.x, cop.y, 3.5, Math.floor(state.time * 4) % 2 ? '#ff2b2b' : '#2b6bff');
    const p = state.player;
    dot(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y, 4.5, '#ffffff');
    // Viewport rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(mx + state.camera.x * sx, my + state.camera.y * sy, VIEW_W * sx, VIEW_H * sy);
    ctx.restore();
    text('SOLMAR CITY', mx + mw / 2, my + mh + 22, 11, 'rgba(255,255,255,0.75)', 'center', true);
  }

  // --- HUD -------------------------------------------------------------------

  function drawStars(state) {
    const x0 = VIEW_W - 16;
    const y0 = 30;
    for (let i = 0; i < 5; i++) {
      const cx = x0 - i * 30;
      const lit = i < state.wanted;
      ctx.fillStyle = lit ? '#ffd94f' : 'rgba(255,255,255,0.25)';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        const a2 = a + Math.PI / 5;
        const px = cx + Math.cos(a) * 11;
        const py = y0 + Math.sin(a) * 11;
        const qx = cx + Math.cos(a2) * 4.5;
        const qy = y0 + Math.sin(a2) * 4.5;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        ctx.lineTo(qx, qy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawHud(state) {
    // Cash + health, top-left.
    ctx.fillStyle = 'rgba(10, 14, 20, 0.72)';
    roundRect(14, 14, 250, 64, 10);
    ctx.fill();
    text(`$${state.player.cash}`, 28, 42, 26, '#7dff8a', 'left', true);
    const hpW = 150;
    const hpRatio = Math.max(0, state.player.hp / 100);
    ctx.fillStyle = '#3a2020';
    roundRect(96, 52, hpW, 12, 6);
    ctx.fill();
    ctx.fillStyle = hpRatio > 0.5 ? '#5dd65d' : hpRatio > 0.25 ? '#e8b923' : '#e5534b';
    roundRect(96, 52, hpW * hpRatio, 12, 6);
    ctx.fill();
    text('HP', 28, 62, 13, 'rgba(255,255,255,0.8)', 'left', true);
    if (state.player.car) {
      const car = state.player.car;
      const carRatio = Math.max(0, car.hp / car.maxHp);
      ctx.fillStyle = '#20242c';
      roundRect(96, 68, hpW, 6, 3);
      ctx.fill();
      ctx.fillStyle = carRatio > 0.5 ? '#8fb8e8' : '#e5534b';
      roundRect(96, 68, hpW * carRatio, 6, 3);
      ctx.fill();
    }
    drawStars(state);
    drawMinimap(state);

    // Mission objective, top-centre.
    const obj = state.missionObjective;
    if (obj) {
      ctx.font = font(16, true);
      const w = ctx.measureText(obj).width + 36;
      ctx.fillStyle = 'rgba(10, 14, 20, 0.72)';
      roundRect((VIEW_W - w) / 2, 14, w, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94f';
      ctx.beginPath();
      ctx.arc((VIEW_W - w) / 2 + 18, 31, 5, 0, Math.PI * 2);
      ctx.fill();
      text(obj, (VIEW_W - w) / 2 + 30, 37, 16, '#ffffff', 'left', true);
      const m = state.mission;
      if (m && m.timer > 0) {
        const mm = Math.floor(m.timer / 60);
        const ss = Math.floor(m.timer % 60).toString().padStart(2, '0');
        text(`${mm}:${ss}`, VIEW_W / 2, 74, 22, m.timer < 20 ? '#ff6b6b' : '#ffffff', 'center', true);
      }
    }

    // Message feed, under the objective.
    let my = 92;
    if (!state.missionObjective) my = 14;
    state.messages.forEach((msg, i) => {
      const age = state.time - msg.t;
      if (age > 5) return;
      const alpha = age > 4 ? 5 - age : 1;
      ctx.globalAlpha = alpha;
      ctx.font = font(15, false);
      const w = ctx.measureText(msg.text).width + 24;
      ctx.fillStyle = msg.kind === 'bad' ? 'rgba(90, 20, 20, 0.8)' : msg.kind === 'good' ? 'rgba(20, 70, 30, 0.8)' : 'rgba(10, 14, 20, 0.75)';
      roundRect((VIEW_W - w) / 2, my + i * 30, w, 26, 8);
      ctx.fill();
      text(msg.text, VIEW_W / 2, my + i * 30 + 18, 15, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    });

    // Context hint, bottom-left.
    if (state.hint) {
      ctx.font = font(15, false);
      const w = ctx.measureText(state.hint).width + 24;
      ctx.fillStyle = 'rgba(10, 14, 20, 0.72)';
      roundRect(14, VIEW_H - 44, w, 30, 8);
      ctx.fill();
      text(state.hint, 26, VIEW_H - 24, 15, '#ffffff', 'left');
    }

    // Speedometer while driving, bottom-centre.
    if (state.player.car) {
      const kmh = Math.round(Math.abs(state.player.car.speed) * 0.36);
      text(`${kmh}`, VIEW_W / 2, VIEW_H - 24, 30, '#ffffff', 'center', true);
      text('km/h', VIEW_W / 2 + 46, VIEW_H - 24, 14, 'rgba(255,255,255,0.7)', 'left', true);
      const model = CAR_MODELS[state.player.car.model];
      text(model.name, VIEW_W / 2, VIEW_H - 52, 14, 'rgba(255,255,255,0.8)', 'center', true);
    }

    // Crosshair at the mouse while on foot.
    if (state.player.onFoot && state.mode === 'playing' && state.mouseLogical) {
      const mx = state.mouseLogical.x;
      const my2 = state.mouseLogical.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my2, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 13, my2);
      ctx.lineTo(mx - 5, my2);
      ctx.moveTo(mx + 5, my2);
      ctx.lineTo(mx + 13, my2);
      ctx.moveTo(mx, my2 - 13);
      ctx.lineTo(mx, my2 - 5);
      ctx.moveTo(mx, my2 + 5);
      ctx.lineTo(mx, my2 + 13);
      ctx.stroke();
    }
  }

  // --- Screens -----------------------------------------------------------------

  function panel(x, y, w, h, title, titleColor) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.88)';
    roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 217, 79, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (title) text(title, VIEW_W / 2, y + 58, 40, titleColor || '#ffd94f', 'center', true);
  }

  function drawTitle(state, saveData) {
    // Dim the city behind the panel.
    ctx.fillStyle = 'rgba(8, 10, 16, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text('SOLMAR', VIEW_W / 2, 150, 84, '#ffd94f', 'center', true);
    text('HEAT', VIEW_W / 2, 232, 84, '#ff5a3c', 'center', true);
    text('AN OPEN-WORLD CRIME STORY  •  SOLMAR CITY', VIEW_W / 2, 272, 18, '#ffffff', 'center', true);
    const items = [];
    items.push({ key: '1', label: 'New Game' });
    if (saveData) items.push({ key: '2', label: `Continue — ${saveData.missionsDone} mission${saveData.missionsDone === 1 ? '' : 's'} done, $${saveData.cash}` });
    items.push({ key: '3', label: 'How to Play' });
    const y0 = 330;
    items.forEach((it, i) => {
      const selected = state.titleIndex === i;
      ctx.fillStyle = selected ? 'rgba(255, 217, 79, 0.9)' : 'rgba(255,255,255,0.10)';
      roundRect(VIEW_W / 2 - 220, y0 + i * 58, 440, 44, 10);
      ctx.fill();
      text(`${it.key}.  ${it.label}`, VIEW_W / 2, y0 + i * 58 + 30, 20, selected ? '#1c2733' : '#ffffff', 'center', selected);
    });
    text('WASD move  •  E enter / exit car  •  Mouse aim, click to shoot  •  F punch  •  M mute', VIEW_W / 2, 620, 15, 'rgba(255,255,255,0.75)', 'center');
    text('An original game. No affiliation with any commercial title.', VIEW_W / 2, 648, 13, 'rgba(255,255,255,0.45)', 'center');
    text('Press 1 / 2 / 3 or click a row', VIEW_W / 2, 676, 13, 'rgba(255,255,255,0.6)', 'center');
  }

  function drawHowTo(state) {
    panel(VIEW_W / 2 - 330, 90, 660, 540, 'HOW TO PLAY', '#ffffff');
    const lines = [
      'You are Rook Santana, a driver-for-hire in Solmar City.',
      '',
      'WASD / Arrows — move on foot, drive in a car',
      'Shift — run faster on foot',
      'E — get in / out of the nearest car',
      'Mouse + Click — aim and shoot (on foot)',
      'F — punch someone close by',
      'Space — handbrake while driving',
      'Esc / P — pause, save and quit',
      'M — mute the sound',
      '',
      'Stealing cars, hitting people and shooting raise your',
      'wanted level. The police chase you — lose them, or pay',
      "Luna's Spray & Go $100 to clear the heat.",
      'Finish missions to earn cash. Grab green $ stashes.',
      'Busted or wasted? You lose some cash and wake up again.',
    ];
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, 190 + i * 26, 16, line === '' ? '#fff' : '#e8e8e8', 'center');
    });
    text('Press Esc to go back', VIEW_W / 2, 600, 15, '#ffd94f', 'center', true);
  }

  function drawBriefing(state) {
    const m = state.mission;
    const def = m.def;
    panel(VIEW_W / 2 - 330, 130, 660, 420, def.title.toUpperCase(), '#ffd94f');
    text(`From: ${def.client}    •    Reward: $${def.reward}`, VIEW_W / 2, 240, 18, '#7dff8a', 'center', true);
    def.briefing.forEach((line, i) => {
      text(line, VIEW_W / 2, 290 + i * 28, 17, '#e8e8e8', 'center');
    });
    text('Press Enter to start the mission', VIEW_W / 2, 500, 18, '#ffd94f', 'center', true);
  }

  function drawPaused(state) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(VIEW_W / 2 - 280, 150, 560, 400, 'PAUSED', '#ffffff');
    const lines = [
      `Cash: $${state.player.cash}    •    Missions done: ${state.stats.missionsDone}`,
      `Cars stolen: ${state.stats.carsStolen}    •    Earned: $${state.stats.earned}`,
      '',
      'Esc / P — resume',
      'S — save game now',
      'M — mute sound',
      'Q — quit to title',
    ];
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, 260 + i * 30, 17, '#e8e8e8', 'center');
    });
  }

  function drawBusted(state) {
    ctx.fillStyle = 'rgba(10, 10, 40, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(VIEW_W / 2 - 300, 200, 600, 280, 'BUSTED', '#6b9dff');
    text('The police caught up with you.', VIEW_W / 2, 300, 18, '#e8e8e8', 'center');
    text(`You lost $${state.lastLoss}. The heat is off — for now.`, VIEW_W / 2, 336, 18, '#e8e8e8', 'center');
    text('Press Enter to walk out of Precinct 9', VIEW_W / 2, 420, 18, '#ffd94f', 'center', true);
  }

  function drawWasted(state) {
    ctx.fillStyle = 'rgba(40, 10, 10, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(VIEW_W / 2 - 300, 200, 600, 280, 'WASTED', '#ff6b6b');
    text('You got knocked out cold.', VIEW_W / 2, 300, 18, '#e8e8e8', 'center');
    text(`The hospital patched you up — minus $${state.lastLoss}.`, VIEW_W / 2, 336, 18, '#e8e8e8', 'center');
    text('Press Enter to leave Solmar General', VIEW_W / 2, 420, 18, '#ffd94f', 'center', true);
  }

  function drawMissionComplete(state) {
    const m = state.missionComplete;
    ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(VIEW_W / 2 - 300, 170, 600, 320, 'MISSION COMPLETE', '#7dff8a');
    text(m.def.title, VIEW_W / 2, 280, 24, '#ffffff', 'center', true);
    text(`Reward: $${m.def.reward}    •    Total cash: $${state.player.cash}`, VIEW_W / 2, 326, 18, '#7dff8a', 'center', true);
    const next = state.stats.missionsDone < 5
      ? `Next: ${['First Fare', 'Hot Wheels', 'Heat Wave', 'The Pickup', 'Harbor Run'][state.stats.missionsDone]}`
      : 'Story complete — you run Solmar City now. Taxi fares keep paying.';
    text(next, VIEW_W / 2, 372, 17, '#e8e8e8', 'center');
    text('Press Enter to keep playing', VIEW_W / 2, 440, 18, '#ffd94f', 'center', true);
  }

  // --- Entry point ------------------------------------------------------------

  function draw(state, saveData) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // World space: the camera window.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.translate(-state.camera.x, -state.camera.y);
    drawWorld(state);
    drawEffects(state);
    for (const ped of state.peds) drawPedShape(ped);
    for (const car of state.cars) drawCarShape(car, state.time);
    drawPlayerShape(state);
    ctx.restore();
    // Screen space: HUD and menus.
    if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'missionComplete' || state.mode === 'busted' || state.mode === 'wasted') {
      drawHud(state);
    }
    if (state.mode === 'title') drawTitle(state, saveData);
    else if (state.mode === 'howto') drawHowTo(state);
    else if (state.mode === 'briefing') drawBriefing(state);
    else if (state.mode === 'paused') drawPaused(state);
    else if (state.mode === 'busted') drawBusted(state);
    else if (state.mode === 'wasted') drawWasted(state);
    else if (state.mode === 'missionComplete') drawMissionComplete(state);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}

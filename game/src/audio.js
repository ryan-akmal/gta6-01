// SOLMAR HEAT — synthesized sound with WebAudio: no audio files, everything is
// generated (engine hum, sirens, gunshots, pickups, jingles). Created lazily on
// the first user gesture so autoplay rules never block the game.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.35;
      audio.master.connect(audio.ctx.destination);
      // Engine: a low sawtooth through a low-pass filter, pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      const filter = audio.engineFilter = audio.engineFilter || audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Siren: a square wave that alternates two tones while police are close.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'square';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  };

  audio.setMuted = (m) => {
    audio.muted = m;
    if (audio.master && audio.ctx) {
      audio.master.gain.value = m ? 0 : 0.35;
    }
  };

  audio.setEngine = (speedRatio, driving) => {
    if (!audio.ctx || !audio.engineOsc) return;
    const target = driving ? 0.05 + speedRatio * 0.1 : 0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
    audio.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, audio.ctx.currentTime, 0.08);
    // The engine opens up as it revs: the low-pass cutoff follows speed.
    if (audio.engineFilter) {
      audio.engineFilter.frequency.setTargetAtTime(420 + speedRatio * 900, audio.ctx.currentTime, 0.1);
    }
  };

  audio.setSiren = (on, dt) => {
    if (!audio.ctx || !audio.sirenOsc) return;
    if (on) {
      audio.sirenTimer += dt;
      if (audio.sirenTimer > 0.42) {
        audio.sirenTimer = 0;
        audio.sirenHigh = !audio.sirenHigh;
        audio.sirenOsc.frequency.setTargetAtTime(audio.sirenHigh ? 920 : 660, audio.ctx.currentTime, 0.02);
      }
      audio.sirenGain.gain.setTargetAtTime(0.045, audio.ctx.currentTime, 0.1);
    } else {
      audio.sirenGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
    }
  };

  function blip(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || !audio.master) return;
    try {
      const t = audio.ctx.currentTime;
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(audio.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* sound is optional */ }
  }

  function noiseBurst(dur, vol, freq) {
    if (!audio.ctx || !audio.master) return;
    try {
      const t = audio.ctx.currentTime;
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq || 1800;
      const g = audio.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f);
      f.connect(g);
      g.connect(audio.master);
      src.start(t);
    } catch { /* sound is optional */ }
  }

  audio.shot = () => noiseBurst(0.12, 0.35, 2600);
  audio.punch = () => noiseBurst(0.08, 0.25, 900);
  audio.crash = () => noiseBurst(0.22, 0.4, 700);
  // Tyre skid: a short band-passed noise burst around 1200 Hz.
  audio.skid = () => {
    if (!audio.ctx || !audio.master) return;
    try {
      const t = audio.ctx.currentTime;
      const len = Math.floor(audio.ctx.sampleRate * 0.25);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1200;
      f.Q.value = 1.2;
      const g = audio.ctx.createGain();
      g.gain.value = 0.22;
      src.connect(f);
      f.connect(g);
      g.connect(audio.master);
      src.start(t);
    } catch { /* sound is optional */ }
  };
  audio.pickup = () => { blip(660, 0.09, 'sine', 0.22); setTimeout(() => blip(990, 0.12, 'sine', 0.22), 70); };
  audio.cash = () => { blip(880, 0.08, 'triangle', 0.2); setTimeout(() => blip(1318, 0.14, 'triangle', 0.2), 60); };
  audio.click = () => blip(520, 0.05, 'square', 0.12);
  audio.busted = () => { blip(392, 0.25, 'sawtooth', 0.18, 196); };
  audio.missionDone = () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110));
  };
  audio.missionStart = () => {
    [392, 523, 659].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.2), i * 90));
  };
  return audio;
}

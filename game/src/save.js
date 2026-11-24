// SOLMAR HEAT — saving to localStorage: cash, story progress, stats and the
// mute setting. The game autosaves after every mission and on pause.

export const SAVE_KEY = 'solmar-heat.save.v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    // quality records the visual tier this save was written at; loadSave
    // ignores fields it does not know, so old saves still load.
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, quality: 'high' }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage can be off; the game still plays */ }
}

import { newProgress } from './journey.js';

const KEY = 'ammaJourney.v1';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...newProgress(), ...JSON.parse(raw) };
  } catch (e) {
    // Storage can be blocked or empty. We start fresh.
  }
  return newProgress();
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    // If saving fails the game still works, it just won't remember.
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // ignore
  }
}
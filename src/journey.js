export const STAGES = 7;      // daily stages from start to destination
export const BASE_TARGET = 80; // metres for a day's goal at normal difficulty

export const DESTINATIONS = {
  temple: { emoji: '🛕', label: 'Temple', to: 'the temple', arrived: 'You reached the temple!' },
  home: { emoji: '🏡', label: 'My Hometown', to: 'your hometown', arrived: 'Welcome home!' },
  festival: { emoji: '🎪', label: 'Hill Festival', to: 'the hill festival', arrived: 'You reached the festival!' },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newProgress() {
  return {
    dest: null,
    stages: {},          // stages completed, per destination
    totalMetres: 0,
    bestFruits: 0,
    streak: 0,
    bestStreak: 0,
    lastPlayDate: null,
    tokens: 1,           // rest-day tokens
    difficulty: 1,
    sessions: 0,
    arrivals: 0,
  };
}

export function stageOf(p) {
  return (p.dest && p.stages[p.dest]) || 0;
}

// ---- dates (local, as YYYY-MM-DD) ----
export function todayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dayNumber(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
export function daysBetween(a, b) {
  return dayNumber(b) - dayNumber(a);
}

// What the home screen should show for the streak today.
export function streakStatus(p, today) {
  if (!p.lastPlayDate || p.streak === 0) return { days: 0, covered: false };
  const missed = daysBetween(p.lastPlayDate, today) - 1;
  if (missed <= 0) return { days: p.streak, covered: false };
  if (missed === 1 && p.tokens > 0) return { days: p.streak, covered: true };
  return { days: 0, covered: false };
}

// ---- difficulty ----
export function sessionDifficulty(p, today) {
  let d = p.difficulty;
  if (p.lastPlayDate && daysBetween(p.lastPlayDate, today) >= 3) d *= 0.9; // ease after a break
  return clamp(d, 0.7, 1.6);
}

export function sessionSettings(p, today, goalOverride = 0) {
  const d = sessionDifficulty(p, today);
  return {
    d,
    target: goalOverride || Math.round(BASE_TARGET * d),
    fall: 0.18 * d,   // fruit fall speed (screen heights per second)
    spawn: 1.6 / d,   // seconds between fruits
  };
}

// Call once when a round finishes. Changes p and tells the game what happened.
export function completeSession(p, r, today, sessionD) {
  const out = {
    firstToday: p.lastPlayDate !== today,
    destKey: p.dest,
    stageNow: stageOf(p),
    arrived: false,
    tokenUsed: false,
    tokenEarned: false,
    streakReset: false,
  };

  p.totalMetres += r.metres;
  p.totalFruits += r.fruits;
  p.sessions += 1;

  // about +5% a week when she reaches her goal, gentler when it was a slow day
  let d = sessionD;
  if (r.fraction >= 1) d *= 1.007;
  else if (r.fraction < 0.6) d *= 0.97;
  p.difficulty = clamp(d, 0.7, 1.6);

  if (out.firstToday) {
    if (!p.lastPlayDate) {
      p.streak = 1;
    } else {
      const missed = daysBetween(p.lastPlayDate, today) - 1;
      if (missed <= 0) p.streak += 1;
      else if (missed === 1 && p.tokens > 0) {
        p.tokens -= 1;
        p.streak += 1;
        out.tokenUsed = true;
      } else {
        p.streak = 1;
        out.streakReset = true;
      }
    }
    if (p.streak % 7 === 0 && p.tokens < 2) {
      p.tokens += 1;
      out.tokenEarned = true;
    }
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    p.lastPlayDate = today;

    const next = stageOf(p) + 1;
    out.stageNow = next;
    if (next >= STAGES) {
      p.stages[p.dest] = 0;
      p.dest = null;
      p.arrivals += 1;
      out.arrived = true;
    } else {
      p.stages[p.dest] = next;
    }
  }
  return out;
}
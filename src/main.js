import { PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import {
  createTracker, startCamera, makeSmoother, isVisible, UPPER_BODY, FULL_BODY,
} from './tracking.js';
import { createGestures } from './gestures.js';
import { createScene } from './scene.js';
import { loadProgress, saveProgress, clearProgress } from './storage.js';
import {
  STAGES, DESTINATIONS, todayString, stageOf, streakStatus, sessionSettings, completeSession,
} from './journey.js';
import { createUI } from './ui.js';

// ---------- Settings ----------
const ROUND_SECONDS = 180;
const METRES_PER_MOVE = 0.5;
const REACH = 1.4;
const FRUITS = ['🍎', '🍌', '🍊', '🍇', '🍉', '🍐'];

// Test options in the link:  ?goal=10  ?round=40  ?reset  ?dayoffset=1  ?gpu
const params = new URLSearchParams(location.search);
const useGpu = params.has('gpu');
const dayOffset = Number(params.get('dayoffset')) || 0;
const goalOverride = Number(params.get('goal')) || 0;
const roundSeconds = Number(params.get('round')) || ROUND_SECONDS;
if (params.has('reset')) clearProgress();
const today = () => todayString(dayOffset);

// ---------- Page elements ----------
const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const video = document.getElementById('video');
const preview = document.getElementById('preview');
const skel = document.getElementById('skel');
const skelCtx = skel.getContext('2d');
const skelDrawing = new DrawingUtils(skelCtx);
const statusEl = document.getElementById('status');
const ui = createUI(onAction);

// ---------- Screen size (fixed 16:9 stage) ----------
let W = 0, H = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = stage.clientWidth;
  H = stage.clientHeight;
  document.documentElement.style.fontSize = H / 100 + 'px'; // 1rem = 1% of height
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- State ----------
let progress = loadProgress();
let landmarker = null;
let loopStarted = false;
let lastVideoTime = -1;
let lastFrame = performance.now();
const smoother = makeSmoother();
const gestures = createGestures();
const scene = createScene();

let seated = false;
let ready = false;
let guideMsg = '';
let hands = { left: null, right: null };

let state = 'menu'; // 'menu' or 'playing'
let session = null;
let score = 0;
let timeLeft = 0;
let spawnTimer = 0;
let fruits = [];
let floats = [];
let roundStartTotal = 0;
let lastTotal = 0;
let bannerText = '';
let missed = 0;
let combo = 0;
let bestCombo = 0;
let bannerTime = 0;

// scenery
let sceneDest = progress.dest || 'temple';
let justArrived = false;
let scrollTarget = 0;
let scroll = 0;
let sceneProgress = idleProgressTarget();

let detTotal = 0, detCount = 0, statStart = performance.now();

// ---------- Sound ----------
let audioCtx = null;
function ping(freq = 880) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.26);
}
function bell() {
  if (!audioCtx) return;
  [523, 659, 784].forEach((f, i) => {
    const t = audioCtx.currentTime + i * 0.35;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1.7);
  });
}

// ---------- Screens ----------
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function gardenHTML(streak, animate) {
  const full = Math.floor(streak / 7);
  const part = streak % 7;
  const growth = ['🌱', '🌱', '🌿', '🌿', '🌷', '🌷', '🌺'];
  const items = [];
  for (let i = 0; i < Math.min(full, 8); i++) items.push('🌸');
  let newest = items.length - 1;
  if (part > 0 || full === 0) {
    items.push(growth[part]);
    newest = items.length - 1;
  } else {
    items.push('🌱'); // a flower just bloomed, a new sprout waits
  }
  const filled = streak > 0 && part === 0 ? 7 : part;
  const flowers = items
    .map((e, i) => (animate && i === newest ? '<span class="bloom">' + e + '</span>' : e))
    .join('');
  return flowers + '<div class="dots">' + '●'.repeat(filled) + '○'.repeat(7 - filled) + '</div>';
}

function welcomeScreen(msg, showButton = true) {
  ui.show(
    "<h1>🌸 Amma's Journey</h1><p>" + msg + '</p>' +
    (showButton ? '<div class="row"><button class="btn" data-act="begin">Tap to begin</button></div>' : '')
  );
}

function pickScreen() {
  const buttons = Object.entries(DESTINATIONS)
    .map(([key, d]) => '<button class="btn dest" data-act="pick" data-dest="' + key + '">' + d.emoji + '<br>' + d.label + '</button>')
    .join('');
  ui.show(
    '<h1>Where shall we walk to?</h1><div class="row">' + buttons + '</div>' +
    (progress.dest ? '<div class="row"><button class="btn small" data-act="home">Back</button></div>' : '')
  );
}

function homeScreen() {
  const d = DESTINATIONS[progress.dest];
  const st = streakStatus(progress, today());
  const done = progress.lastPlayDate === today();
  const streakLine = st.days > 0
    ? '🔥 ' + st.days + ' day streak' + (st.covered ? ' (your rest token will protect it)' : '')
    : '🔥 Start your streak today';
  ui.show(
    '<h1>' + d.emoji + " Amma's Journey</h1>" +
    '<p>On the way to ' + d.to + ': ' + stageOf(progress) + ' of ' + STAGES + ' stages done</p>' +
    '<p>' + (done ? "Today's walk is done ✅" : "Today's walk is waiting") + '</p>' +
    '<p>' + streakLine + ' &nbsp; 🛡️ ' + progress.tokens + '</p>' +
    '<div class="garden">' + gardenHTML(st.days, false) + '</div>' +
    '<div class="row"><button class="btn" data-act="play">' + (done ? '▶ Walk again (bonus)' : "▶ Start today's walk") + '</button></div>' +
    '<div class="row"><button class="btn small" data-act="mode">Mode: ' + (seated ? 'Seated' : 'Standing') + '</button>' +
    '<button class="btn small" data-act="dest">Change destination</button></div>'
  );
}

function showHome() {
  if (!progress.dest) pickScreen();
  else homeScreen();
}


// ---------- Button actions (taps or held hand) ----------
function onAction(act, data) {
  if (act === 'begin') beginApp();
  else if (act === 'pick') {
    progress.dest = data.dest;
    sceneDest = data.dest;
    justArrived = false;
    sceneProgress = idleProgressTarget();
    saveProgress(progress);
    homeScreen();
  } else if (act === 'dest') pickScreen();
  else if (act === 'home') showHome();
  else if (act === 'mode') {
    seated = !seated;
    gestures.clearRecent();
    homeScreen();
  } else if (act === 'play') beginRound();
}

async function beginApp() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (e) {
    // Fullscreen is optional.
  }
  welcomeScreen('Loading body tracking... please wait a few seconds', false);
  try {
    if (!landmarker) {
      landmarker = await createTracker({ useGpu });
      await startCamera(video);
    }
    if (!loopStarted) {
      loopStarted = true;
      lastFrame = performance.now();
      requestAnimationFrame(loop);
    }
    showHome();
  } catch (err) {
    welcomeScreen('Problem: ' + err.message);
  }
}

// ---------- Body -> game ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function toScreen(p) {
  const x = ((1 - p.x) - 0.5) * REACH + 0.5;
  const y = (p.y - 0.5) * REACH + 0.5;
  return { x: clamp(x, 0, 1) * W, y: clamp(y, 0, 1) * H };
}

function pointerHand() {
  const l = hands.left, r = hands.right;
  if (l && r) return l.y < r.y ? l : r; // the raised hand points
  return l || r;
}

function handlePose(result) {
  skelCtx.clearRect(0, 0, 640, 480);

  if (result.landmarks.length === 0) {
    smoother.reset();
    gestures.lostBody();
    ready = false;
    hands = { left: null, right: null };
    guideMsg = 'I cannot see you. Please step in front of the camera.';
  } else {
    const lm = smoother.apply(result.landmarks[0]);
    skelDrawing.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 4 });
    skelDrawing.drawLandmarks(lm, { color: '#ff3366', radius: 4 });

    ready = isVisible(lm, seated ? UPPER_BODY : FULL_BODY);
    if (ready) {
      gestures.update(lm, seated, performance.now());
      hands.left = (lm[15].visibility ?? 1) > 0.5 ? toScreen(lm[15]) : null;
      hands.right = (lm[16].visibility ?? 1) > 0.5 ? toScreen(lm[16]) : null;
      guideMsg = '';
    } else {
      gestures.lostBody();
      hands = { left: null, right: null };
      guideMsg = seated
        ? 'Please show your head, shoulders and both arms.'
        : 'Please step back so your head to feet are in view.';
    }
  }
  preview.style.borderColor = ready ? '#22cc66' : '#cc2244';

  if (state === 'playing') {
    ui.point(null, performance.now());
  } else {
    ui.setHint(ready ? 'Raise one hand and hold it on a button' : guideMsg);
    ui.point(pointerHand(), performance.now());
  }
}

// ---------- Game logic ----------
function sessionMetres() {
  return (gestures.total - roundStartTotal) * METRES_PER_MOVE;
}

function idleProgressTarget() {
  if (justArrived) return 1;
  return progress.dest ? stageOf(progress) / STAGES : 0;
}

function playProgress() {
  const base = stageOf(progress) / STAGES;
  if (!session.firstToday) return base;
  return base + Math.min(1, sessionMetres() / session.target) / STAGES;
}

function spawnFruit() {
  fruits.push({
    x: (0.1 + Math.random() * 0.8) * W,
    y: -0.1 * H,
    emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
  });
}

function beginRound() {
  if (!progress.dest) {
    pickScreen();
    return;
  }
  session = {
    ...sessionSettings(progress, today(), goalOverride),
    firstToday: progress.lastPlayDate !== today(),
    goalHit: false,
  };
  score = 0;
  timeLeft = roundSeconds;
  spawnTimer = 0.5;
  fruits = [];
  floats = [];
  roundStartTotal = gestures.total;
  lastTotal = gestures.total;
    bannerTime = 0;
  missed = 0;
  combo = 0;
  bestCombo = 0;
  state = 'playing';
  ui.hide();
}

function endRound() {
  const metres = sessionMetres();
  const total = score + missed;
  const accuracy = total > 0 ? score / total : 1;
  const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
  const prevBest = progress.bestFruits || 0;
  const result = {
    metres, fruits: score, fraction: metres / session.target,
    missed, total, accuracy, stars, bestCombo,
    newBest: prevBest > 0 && score > prevBest, prevBest,
  };
  const out = completeSession(progress, result, today(), session.d);
  progress.bestFruits = Math.max(prevBest, score);
  saveProgress(progress);
  justArrived = out.arrived;
  state = 'menu';
  if (out.arrived || result.newBest) bell();
  resultsScreen(result, out);
}

function resultsScreen(r, out) {
  const d = DESTINATIONS[out.destKey];
  let stageMsg;
  if (out.arrived) stageMsg = d.arrived + ' 🔔';
  else if (out.firstToday) stageMsg = 'Stage ' + out.stageNow + ' of ' + STAGES + ' done. ' + cap(d.to) + ' is getting closer!';
  else stageMsg = "Bonus walk! Today's stage was already done.";

  const goalMsg = r.fraction >= 1 ? "You reached today's goal! 🌟" : 'Every step counts. Well done!';
  const extras = [];
  if (out.tokenUsed) extras.push('🛡️ Your rest token kept your streak safe.');
  if (out.streakReset) extras.push('Welcome back! A new streak begins today.');
  if (out.tokenEarned) extras.push('🎁 You earned a rest token!');

  const stars = '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  const bestLine = r.newBest
    ? '🏆 New best! Your old record was ' + r.prevBest + '.'
    : r.prevBest > 0 ? 'Your best so far: ' + Math.max(r.prevBest, r.fruits) + ' fruits.' : '';

  ui.show(
    '<h1>Well done! 🎉</h1>' +
    '<div class="garden">' + stars + '</div>' +
    '<p>You caught ' + r.fruits + ' of ' + r.total + ' fruits (' + Math.round(r.accuracy * 100) + '%)' +
    (r.bestCombo >= 3 ? ', best streak 🔥 ' + r.bestCombo : '') + '.</p>' +
    (bestLine ? '<p>' + bestLine + '</p>' : '') +
    '<p>You walked ' + Math.round(r.metres) + ' metres. ' + goalMsg + '</p>' +
    '<p>' + stageMsg + '</p>' +
    '<p>🔥 ' + progress.streak + ' day streak</p>' +
    (extras.length ? '<p>' + extras.join(' ') + '</p>' : '') +
    '<div class="garden">' + gardenHTML(progress.streak, out.firstToday) + '</div>' +
    '<div class="row">' +
    (out.arrived
      ? '<button class="btn" data-act="dest">Choose the next journey</button>'
      : '<button class="btn" data-act="home">Continue</button>') +
    '</div>'
  );
}

function update(dt) {
  if (state !== 'playing' || !ready) return; // pause when she is out of view

  timeLeft -= dt;
  if (timeLeft <= 0) {
    endRound();
    return;
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnFruit();
    spawnTimer = session.spawn;
  }

  const handR = 0.07 * H;
  const fruitR = 0.05 * H;
  for (const f of fruits) {
    f.y += session.fall * H * dt;
    for (const h of [hands.left, hands.right]) {
      if (!h || f.caught) continue;
      if (Math.hypot(h.x - f.x, h.y - f.y) < handR + fruitR) {
                f.caught = true;
        score++;
        combo++;
        bestCombo = Math.max(bestCombo, combo);
        if (combo === 5 || combo === 10 || (combo > 10 && combo % 10 === 0)) {
          floats.push({ x: f.x, y: f.y - 0.1 * H, text: '🔥 ' + combo + ' in a row!', life: 1.6 });
          bell();
        } else {
          floats.push({ x: f.x, y: f.y, text: '+1', life: 1 });
          ping(660 + Math.random() * 400);
        }
      }
    }
  }
    for (const f of fruits) {
    if (!f.caught && f.y >= H * 1.1) {
      missed++;
      combo = 0;
    }
  }
   
  fruits = fruits.filter((f) => !f.caught && f.y < H * 1.1);

  for (const fl of floats) {
    fl.y -= 0.12 * H * dt;
    fl.life -= dt * 1.2;
  }
  floats = floats.filter((fl) => fl.life > 0);

  const gained = gestures.total - lastTotal;
  lastTotal = gestures.total;
  scrollTarget += gained * METRES_PER_MOVE;

  if (!session.goalHit && sessionMetres() >= session.target) {
    session.goalHit = true;
    bannerText = "Today's goal reached! 🌟";
    bannerTime = 5;
    bell();
  }
  if (bannerTime > 0) bannerTime -= dt;
}

// ---------- Drawing ----------
function hudText(text, x, y, align) {
  ctx.font = 'bold ' + 0.07 * H + 'px sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.lineWidth = 0.012 * H;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = 'white';
  ctx.fillText(text, x, y);
}

function drawHand(h, fill, stroke) {
  if (!h) return;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 0.07 * H, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 0.008 * H;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function draw(now) {
  scene.draw(ctx, W, H, scroll, 1000, now / 1000, sceneDest, sceneProgress);
  if (state !== 'playing') return;

  ctx.font = 0.12 * H + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of fruits) ctx.fillText(f.emoji, f.x, f.y);

  drawHand(hands.left, 'rgba(0,200,255,0.35)', '#00c8ff');
  drawHand(hands.right, 'rgba(255,80,160,0.35)', '#ff50a0');

  for (const fl of floats) {
    ctx.globalAlpha = Math.max(fl.life, 0);
    ctx.font = 'bold ' + 0.09 * H + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffec3d';
    ctx.fillText(fl.text, fl.x, fl.y);
    ctx.globalAlpha = 1;
  }

  hudText('🍎 ' + score, 0.03 * W, 0.03 * H, 'left');
  hudText('⏱ ' + Math.ceil(timeLeft) + 's', W / 2, 0.03 * H, 'center');
  hudText('🚶 ' + Math.round(sessionMetres()) + ' m', 0.97 * W, 0.03 * H, 'right');
  hudText('💨 ' + missed, 0.97 * W, 0.11 * H, 'right');
  if (combo >= 3) hudText('🔥 ' + combo, 0.03 * W, 0.11 * H, 'left');
  // today's goal bar
  const pct = clamp(sessionMetres() / session.target, 0, 1);
  const bx = W * 0.25, bw = W * 0.5, by = H * 0.125, bh = H * 0.025;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#ffc93c';
  ctx.fillRect(bx, by, bw * pct, bh);
  ctx.font = 0.05 * H + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚶', bx + bw * pct, by + bh / 2);
  ctx.fillText(DESTINATIONS[sceneDest].emoji, bx + bw + 0.04 * W, by + bh / 2);

  if (bannerTime > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H * 0.25, W, H * 0.16);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold ' + 0.08 * H + 'px sans-serif';
    ctx.fillText(bannerText, W / 2, H * 0.33);
  }

  if (!ready) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, H * 0.4, W, H * 0.2);
    ctx.fillStyle = 'white';
    ctx.font = 'bold ' + 0.055 * H + 'px sans-serif';
    ctx.fillText(guideMsg || 'Getting ready...', W / 2, H * 0.5);
  }
}

// ---------- Main loop ----------
function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, t0);
    detTotal += performance.now() - t0;
    detCount++;
    handlePose(result);
  }

  const target = state === 'playing' ? playProgress() : idleProgressTarget();
  sceneProgress += (target - sceneProgress) * Math.min(1, dt * 2);
  scroll += (scrollTarget - scroll) * Math.min(1, dt * 4);

  update(dt);
  draw(now);

  if (now - statStart >= 1000) {
    const avg = detCount ? Math.round(detTotal / detCount) : '-';
    statusEl.textContent = 'Detect ' + avg + ' ms | ' + (useGpu ? 'GPU' : 'CPU') + ' | ' + (seated ? 'Seated' : 'Standing');
    detTotal = 0;
    detCount = 0;
    statStart = now;
  }
  requestAnimationFrame(loop);
}

// ---------- Start ----------
welcomeScreen('Turn your phone sideways, then tap to begin.');

// Offline support and installing as an app (only in the deployed version)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
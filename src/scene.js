const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) =>
  'rgb(' + c1.map((v, i) => Math.round(lerp(v, c2[i], t))).join(',') + ')';
const rnd = (k) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Calls fn for every repeating item that is on screen.
function each(spacing, offset, W, fn) {
  const k0 = Math.floor(offset / spacing) - 1;
  const k1 = Math.ceil((offset + W) / spacing) + 1;
  for (let k = k0; k <= k1; k++) fn(k * spacing - offset, k);
}

function roundTree(ctx, x, baseY, h, color) {
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(x - h * 0.05, baseY - h * 0.4, h * 0.1, h * 0.4);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, baseY - h * 0.65, h * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

function palm(ctx, x, baseY, h, lean) {
  const tx = x + lean * h * 0.4;
  const ty = baseY - h;
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = h * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * h * 0.05, baseY - h * 0.5, tx, ty);
  ctx.stroke();
  ctx.fillStyle = '#2f8f3a';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55;
    ctx.beginPath();
    ctx.ellipse(tx + Math.cos(a) * h * 0.14, ty + Math.sin(a) * h * 0.14, h * 0.17, h * 0.045, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTemple(ctx, cx, baseY, u) {
  const w = u * 0.7;
  // soft golden glow
  const g = ctx.createRadialGradient(cx, baseY - u * 0.5, u * 0.1, cx, baseY - u * 0.5, u * 0.9);
  g.addColorStop(0, 'rgba(255,214,120,0.35)');
  g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - u, baseY - u * 1.5, u * 2, u * 2);

  // platform and steps
  ctx.fillStyle = '#cdb89a';
  ctx.fillRect(cx - w * 0.62, baseY - u * 0.035, w * 1.24, u * 0.035);
  ctx.fillStyle = '#dbc9ad';
  ctx.fillRect(cx - w * 0.55, baseY - u * 0.07, w * 1.1, u * 0.035);

  // base block with pillars and door
  const bb = baseY - u * 0.07;
  const bh = u * 0.2;
  ctx.fillStyle = '#f6e7c8';
  ctx.fillRect(cx - w * 0.5, bb - bh, w, bh);
  ctx.fillStyle = '#d9a05b';
  ctx.fillRect(cx - w * 0.5, bb - bh, w * 0.07, bh);
  ctx.fillRect(cx + w * 0.43, bb - bh, w * 0.07, bh);
  const d = w * 0.12;
  ctx.fillStyle = '#3b2314';
  ctx.beginPath();
  ctx.moveTo(cx - d, bb);
  ctx.lineTo(cx - d, bb - bh * 0.55);
  ctx.arc(cx, bb - bh * 0.55, d, Math.PI, 0);
  ctx.lineTo(cx + d, bb);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath();
  ctx.arc(cx, bb - bh * 0.3, d * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // tiered tower
  const th = u * 0.1;
  for (let i = 0; i < 6; i++) {
    const tw = w * (0.96 - i * 0.13);
    const y = bb - bh - (i + 1) * th;
    ctx.fillStyle = i % 2 === 0 ? '#e07b39' : '#f2b45b';
    ctx.fillRect(cx - tw / 2, y, tw, th);
    ctx.fillStyle = '#a3471f';
    ctx.fillRect(cx - tw / 2 - tw * 0.03, y + th * 0.82, tw * 1.06, th * 0.18);
    ctx.fillStyle = '#5a2a12';
    for (const dx of [-0.25, 0, 0.25]) {
      ctx.fillRect(cx + dx * tw - tw * 0.04, y + th * 0.25, tw * 0.08, th * 0.4);
    }
  }

  // golden tops and flag
  const top = bb - bh - 6 * th;
  ctx.fillStyle = '#ffc93c';
  for (const dx of [-0.12, 0, 0.12]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * w, top - u * 0.025, u * 0.02, u * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#5a2a12';
  ctx.lineWidth = Math.max(1, u * 0.008);
  ctx.beginPath();
  ctx.moveTo(cx, top - u * 0.05);
  ctx.lineTo(cx, top - u * 0.14);
  ctx.stroke();
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.moveTo(cx, top - u * 0.14);
  ctx.lineTo(cx + u * 0.07, top - u * 0.12);
  ctx.lineTo(cx, top - u * 0.1);
  ctx.fill();
}
function drawGlow(ctx, cx, baseY, u) {
  const g = ctx.createRadialGradient(cx, baseY - u * 0.4, u * 0.1, cx, baseY - u * 0.4, u * 0.9);
  g.addColorStop(0, 'rgba(255,214,120,0.35)');
  g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - u, baseY - u * 1.4, u * 2, u * 2);
}

function drawHome(ctx, cx, baseY, u) {
  const w = u * 0.8;
  drawGlow(ctx, cx, baseY, u);
  roundTree(ctx, cx + w * 0.8, baseY, u * 0.6, '#3f8f3f');
  ctx.fillStyle = '#cdb89a';
  ctx.fillRect(cx - w * 0.58, baseY - u * 0.03, w * 1.16, u * 0.03);
  ctx.fillStyle = '#f3e3c3';
  ctx.fillRect(cx - w * 0.5, baseY - u * 0.38, w, u * 0.35);
  ctx.fillStyle = '#8a5a44';
  ctx.fillRect(cx + w * 0.25, baseY - u * 0.72, w * 0.1, u * 0.2);
  ctx.fillStyle = '#b5532f';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.62, baseY - u * 0.38);
  ctx.lineTo(cx, baseY - u * 0.78);
  ctx.lineTo(cx + w * 0.62, baseY - u * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8f3d20';
  ctx.fillRect(cx - w * 0.62, baseY - u * 0.4, w * 1.24, u * 0.03);
  ctx.fillStyle = '#5a3420';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.09, baseY - u * 0.03);
  ctx.lineTo(cx - w * 0.09, baseY - u * 0.2);
  ctx.arc(cx, baseY - u * 0.2, w * 0.09, Math.PI, 0);
  ctx.lineTo(cx + w * 0.09, baseY - u * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd36b';
  for (const dx of [-0.32, 0.22]) ctx.fillRect(cx + dx * w, baseY - u * 0.28, w * 0.1, u * 0.1);
}

function drawFestival(ctx, cx, baseY, u) {
  const w = u * 0.9;
  drawGlow(ctx, cx, baseY, u);

  // tent with stripes
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, baseY);
  ctx.lineTo(cx - w * 0.5, baseY - u * 0.3);
  ctx.lineTo(cx, baseY - u * 0.7);
  ctx.lineTo(cx + w * 0.5, baseY - u * 0.3);
  ctx.lineTo(cx + w * 0.5, baseY);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#e53935';
  ctx.fillRect(cx - w * 0.5, baseY - u * 0.7, w, u * 0.7);
  ctx.fillStyle = '#fff3d6';
  for (let i = 0; i < 4; i++) ctx.fillRect(cx - w * 0.5 + (i * 2 + 1) * w * 0.125, baseY - u * 0.7, w * 0.125, u * 0.7);
  ctx.restore();

  // door and flag
  ctx.fillStyle = '#4a1e12';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.1, baseY);
  ctx.lineTo(cx, baseY - u * 0.25);
  ctx.lineTo(cx + w * 0.1, baseY);
  ctx.fill();
  ctx.strokeStyle = '#5a2a12';
  ctx.lineWidth = Math.max(1, u * 0.01);
  ctx.beginPath();
  ctx.moveTo(cx, baseY - u * 0.7);
  ctx.lineTo(cx, baseY - u * 0.85);
  ctx.stroke();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(cx, baseY - u * 0.85);
  ctx.lineTo(cx + u * 0.08, baseY - u * 0.82);
  ctx.lineTo(cx, baseY - u * 0.79);
  ctx.fill();

  // bunting between two poles
  const lx = cx - w * 0.75, rx = cx + w * 0.75, py = baseY - u * 0.5;
  ctx.beginPath();
  ctx.moveTo(lx, baseY);
  ctx.lineTo(lx, py);
  ctx.moveTo(rx, baseY);
  ctx.lineTo(rx, py);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lx, py);
  ctx.quadraticCurveTo(cx, py + u * 0.16, rx, py);
  ctx.stroke();
  const cols = ['#ffd23f', '#ff5c8a', '#3fb6ff', '#7be36b'];
  for (let i = 1; i <= 9; i++) {
    const t = i / 10;
    const x = lx + (rx - lx) * t;
    const y = py + u * 0.08 * 4 * t * (1 - t) * 2;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.moveTo(x - u * 0.035, y);
    ctx.lineTo(x + u * 0.035, y);
    ctx.lineTo(x, y + u * 0.09);
    ctx.fill();
  }
}

function drawDestination(ctx, dest, cx, baseY, u) {
  if (dest === 'home') drawHome(ctx, cx, baseY, u);
  else if (dest === 'festival') drawFestival(ctx, cx, baseY, u);
  else drawTemple(ctx, cx, baseY, u);
}

function drawWalker(ctx, x, footY, h, phase) {
  const swing = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase)) * h * 0.015;
  const hipY = footY - h * 0.42 - bob;
  const shoulderY = footY - h * 0.78 - bob;
  const skin = '#c68b59';

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, footY + h * 0.01, h * 0.16, h * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.strokeStyle = skin;
  ctx.lineWidth = h * 0.045;
  // legs
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x + s * swing * h * 0.16, footY - Math.max(0, -s * Math.cos(phase)) * h * 0.03);
    ctx.stroke();
  }
  // saree
  ctx.fillStyle = '#c2185b';
  ctx.beginPath();
  ctx.moveTo(x - h * 0.09, shoulderY);
  ctx.lineTo(x + h * 0.09, shoulderY);
  ctx.lineTo(x + h * 0.14, footY - h * 0.07);
  ctx.lineTo(x - h * 0.14, footY - h * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(x - h * 0.14, footY - h * 0.1, h * 0.28, h * 0.03);
  // arms
  ctx.lineWidth = h * 0.04;
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(x, shoulderY + h * 0.03);
    ctx.lineTo(x - s * swing * h * 0.12, shoulderY + h * 0.27);
    ctx.stroke();
  }
  // head and hair bun
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, shoulderY - h * 0.09, h * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1d14';
  ctx.beginPath();
  ctx.arc(x - h * 0.02, shoulderY - h * 0.1, h * 0.077, Math.PI * 0.9, Math.PI * 1.9);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - h * 0.07, shoulderY - h * 0.14, h * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

export function createScene() {
  const clouds = Array.from({ length: 6 }, (_, i) => ({
    x: rnd(i + 1),
    y: 0.05 + rnd(i + 20) * 0.2,
    s: 0.7 + rnd(i + 40) * 0.8,
  }));
  const flowerColors = ['#ff5c8a', '#ffd23f', '#ffffff', '#ff9d3f'];

    function draw(ctx, W, H, scroll, journey, time, dest = 'temple', progress = null) {
    const p = clamp(scroll / journey, 0, 1); // 0 = start, 1 = at the temple
    const hor = H * 0.62;                    // horizon line
    const px = W * 0.12;                     // pixels per metre on the nearest layer

    // Sky turns golden as she nears the temple
    const sky = ctx.createLinearGradient(0, 0, 0, hor);
    sky.addColorStop(0, mix([110, 195, 255], [255, 170, 100], p));
    sky.addColorStop(1, mix([223, 244, 255], [255, 232, 190], p));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hor + 1);

    // Sun sinks slowly
    const sx = W * 0.84, sy = H * (0.15 + 0.3 * p), sr = H * 0.06;
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 3);
    glow.addColorStop(0, 'rgba(255,240,170,0.9)');
    glow.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
    ctx.fillStyle = '#fff6c2';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();

    // Clouds drift by themselves and a little with her walking
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const span = W * 1.6;
    for (const c of clouds) {
      const x = ((((c.x * span + time * 10 * c.s - scroll * px * 0.02) % span) + span) % span) - W * 0.3;
      const y = c.y * H;
      const r = H * 0.035 * c.s;
      for (const [dx, dy, k] of [[0, 0, 1], [1.1, 0.2, 0.8], [-1.1, 0.25, 0.75], [0.4, -0.4, 0.8]]) {
        ctx.beginPath();
        ctx.arc(x + dx * r, y + dy * r, r * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Far mountains (slowest)
    ctx.fillStyle = mix([150, 170, 205], [205, 150, 150], p);
    each(W * 0.45, scroll * px * 0.03, W, (x, k) => {
      const h = H * (0.1 + rnd(k + 3) * 0.12);
      ctx.beginPath();
      ctx.moveTo(x - W * 0.3, hor);
      ctx.lineTo(x, hor - h);
      ctx.lineTo(x + W * 0.3, hor);
      ctx.fill();
    });

    // Hills
    ctx.fillStyle = mix([120, 180, 130], [160, 150, 100], p);
    each(W * 0.3, scroll * px * 0.08, W, (x, k) => {
      ctx.beginPath();
      ctx.ellipse(x, hor + H * 0.02, W * 0.2, H * (0.06 + rnd(k + 8) * 0.04), 0, Math.PI, Math.PI * 2);
      ctx.fill();
    });

    // Ground
    ctx.fillStyle = mix([107, 191, 89], [150, 175, 80], p);
    ctx.fillRect(0, hor, W, H - hor);

    // Far trees
    each(W * 0.07, scroll * px * 0.2, W, (x, k) => {
      if (rnd(k + 50) < 0.35) return;
      roundTree(ctx, x, hor + H * 0.05, H * (0.07 + rnd(k + 60) * 0.03), '#3f8f3f');
    });

    // The temple: far and small at first, big and glowing at the end
    ctx.globalAlpha = 0.6 + 0.4 * p;
        drawDestination(ctx, dest, W * lerp(0.88, 0.72, p), H * lerp(0.64, 0.8, p), H * (0.14 + 0.48 * p * p));
    ctx.globalAlpha = 1;

    // Palm trees
    each(W * 0.16, scroll * px * 0.45, W, (x, k) => {
      if (rnd(k + 70) < 0.4) return;
      palm(ctx, x, H * 0.75, H * (0.22 + rnd(k + 80) * 0.08), rnd(k + 90) - 0.5);
    });

    // Path
    ctx.fillStyle = '#c9a66b';
    ctx.fillRect(0, H * 0.8, W, H * 0.12);
    ctx.fillStyle = '#b58e55';
    ctx.fillRect(0, H * 0.8, W, H * 0.008);
    ctx.fillRect(0, H * 0.912, W, H * 0.008);
    ctx.fillStyle = '#a98350';
    each(W * 0.09, scroll * px, W, (x, k) => {
      const r = rnd(k + 100);
      ctx.beginPath();
      ctx.ellipse(x, H * (0.83 + r * 0.07), W * 0.008 * (0.5 + r), H * 0.006, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#4f9a45';
    ctx.fillRect(0, H * 0.92, W, H * 0.08);

    // Bushes along the path
    ctx.fillStyle = '#3a8a3a';
    each(W * 0.22, scroll * px * 0.8, W, (x, k) => {
      if (rnd(k + 110) < 0.3) return;
      for (const dx of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.arc(x + dx * H * 0.035, H * 0.8 - (dx === 0 ? H * 0.015 : 0), H * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // The woman walking: her legs move only as the scenery moves
    drawWalker(ctx, W * 0.32, H * 0.89, H * 0.3, scroll * 5);

    // Flowers in front (fastest)
    each(W * 0.05, scroll * px, W, (x, k) => {
      const y = H * (0.94 + rnd(k + 120) * 0.04);
      ctx.strokeStyle = '#2e7d32';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + H * 0.03);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = flowerColors[Math.abs(k) % flowerColors.length];
      ctx.beginPath();
      ctx.arc(x, y, H * 0.012, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return { draw };
}
const DWELL_MS = 1300; // how long a hand must stay on a button to press it

export function createUI(onAction) {
  const stage = document.getElementById('stage');
  const screenEl = document.getElementById('screen');
  const cursor = document.getElementById('cursor');
  const hint = document.getElementById('hint');

  let current = null;
  let since = 0;
  let lockUntil = 0;

  // Works for taps and for hand presses
  screenEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) onAction(b.dataset.act, b.dataset);
  });

  function clearFill() {
    screenEl.querySelectorAll('.btn').forEach((b) => b.style.removeProperty('--fill'));
  }
  function resetDwell() {
    current = null;
    clearFill();
  }

  function show(html) {
    screenEl.innerHTML = html;
    screenEl.classList.remove('hidden');
    hint.style.display = 'block';
    resetDwell();
  }
  function hide() {
    screenEl.classList.add('hidden');
    cursor.style.display = 'none';
    hint.style.display = 'none';
    resetDwell();
  }
  function setHint(text) {
    hint.textContent = text;
  }

  // hand = {x, y} in stage pixels, or null
  function point(hand, now) {
    if (screenEl.classList.contains('hidden') || !hand) {
      cursor.style.display = 'none';
      if (current) resetDwell();
      return;
    }
    cursor.style.display = 'block';
    cursor.style.left = hand.x + 'px';
    cursor.style.top = hand.y + 'px';

    const r = stage.getBoundingClientRect();
    const cx = r.left + hand.x;
    const cy = r.top + hand.y;
    const pad = 8;
    let hit = null;
    for (const b of screenEl.querySelectorAll('.btn')) {
      const br = b.getBoundingClientRect();
      if (cx > br.left - pad && cx < br.right + pad && cy > br.top - pad && cy < br.bottom + pad) {
        hit = b;
        break;
      }
    }

    if (hit !== current) {
      clearFill();
      current = hit;
      since = now;
    }
    if (!current) return;
    if (now <= lockUntil) {
      since = now; // right after a press, wait before the next one can start
      return;
    }
    const t = (now - since) / DWELL_MS;
    current.style.setProperty('--fill', Math.min(t, 1) * 100 + '%');
    if (t >= 1) {
      lockUntil = now + 1500;
      const b = current;
      resetDwell();
      b.click();
    }
  }

  return { show, hide, setHint, point };
}
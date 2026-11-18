// Turns body points into simple moves: marching steps and arm raises.
export function createGestures() {
  let liftState = null;
  let lastFoot = null;
  let baseline = null;
  let total = 0;
  const armUp = { left: false, right: false };
  const recent = [];

  function addMove(now) {
    recent.push(now);
    total++;
  }

  function updateArms(lm, seated, now) {
    const arms = [
      { name: 'left', wrist: lm[15], shoulder: lm[11] },
      { name: 'right', wrist: lm[16], shoulder: lm[12] },
    ];
    for (const a of arms) {
      if (!armUp[a.name] && a.wrist.y < a.shoulder.y - 0.03) {
        armUp[a.name] = true;
      } else if (armUp[a.name] && a.wrist.y > a.shoulder.y + 0.08) {
        armUp[a.name] = false;
        if (seated) addMove(now); // seated: an arm raise counts as a move
      }
    }
  }

  function updateSteps(lm, now) {
    const shoulderY = (lm[11].y + lm[12].y) / 2;
    const hipY = (lm[23].y + lm[24].y) / 2;
    const torso = Math.abs(hipY - shoulderY);

    const rawDiff = ((lm[25].y - lm[26].y) + (lm[27].y - lm[28].y)) / 2;
    if (baseline === null) baseline = rawDiff;
    const diff = rawDiff - baseline;

    const enter = 0.07 * torso;
    const exit = 0.03 * torso;

    if (Math.abs(diff) < enter) baseline += 0.03 * (rawDiff - baseline);

    let state = liftState;
    if (diff < -enter) state = 'L';
    else if (diff > enter) state = 'R';
    else if (Math.abs(diff) < exit) state = null;

    if (state && state !== liftState && state !== lastFoot) {
      lastFoot = state;
      addMove(now);
    }
    liftState = state;
  }

  return {
    update(lm, seated, now) {
      updateArms(lm, seated, now);
      if (!seated) updateSteps(lm, now);
    },
    lostBody() {
      baseline = null;
    },
    clearRecent() {
      recent.length = 0;
    },
    pace(now) {
      while (recent.length && now - recent[0] > 4000) recent.shift();
      return recent.length / 4; // moves per second
    },
    get total() {
      return total;
    },
  };
}
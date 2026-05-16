// Shared swing-analysis heuristics. Imported by both the Snack App.js
// (via copy-on-publish in snack/save.mjs) and the Node debugging harness
// in tools/. Pure functions over a keypoint timeline — no UI, no IO.

export const KP = {
  NOSE: 0,
  L_EYE_INNER: 1, L_EYE: 2, L_EYE_OUTER: 3,
  R_EYE_INNER: 4, R_EYE: 5, R_EYE_OUTER: 6,
  L_EAR: 7, R_EAR: 8,
  MOUTH_L: 9, MOUTH_R: 10,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_PINKY: 17, R_PINKY: 18,
  L_INDEX: 19, R_INDEX: 20,
  L_THUMB: 21, R_THUMB: 22,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
  L_HEEL: 29, R_HEEL: 30,
  L_FOOT: 31, R_FOOT: 32,
};

export const EDGES = [
  [KP.L_SHOULDER, KP.R_SHOULDER],
  [KP.L_SHOULDER, KP.L_HIP],
  [KP.R_SHOULDER, KP.R_HIP],
  [KP.L_HIP, KP.R_HIP],
  [KP.L_SHOULDER, KP.L_ELBOW], [KP.L_ELBOW, KP.L_WRIST],
  [KP.R_SHOULDER, KP.R_ELBOW], [KP.R_ELBOW, KP.R_WRIST],
  [KP.L_HIP, KP.L_KNEE], [KP.L_KNEE, KP.L_ANKLE],
  [KP.R_HIP, KP.R_KNEE], [KP.R_KNEE, KP.R_ANKLE],
];

export const Vec = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]),
  unit: (a) => {
    const n = Vec.norm(a);
    return n > 1e-9 ? Vec.scale(a, 1 / n) : a;
  },
  projectPlane: (a, normal) => {
    const u = Vec.unit(normal);
    return Vec.sub(a, Vec.scale(u, Vec.dot(a, u)));
  },
  angle: (a, b) => {
    const an = Vec.norm(a), bn = Vec.norm(b);
    if (an < 1e-9 || bn < 1e-9) return 0;
    const c = Math.max(-1, Math.min(1, Vec.dot(a, b) / (an * bn)));
    return Math.acos(c);
  },
};

export function world(frame, idx) {
  const kp = frame && frame[idx];
  if (!kp || kp.wx == null) return null;
  return [kp.wx, kp.wy, kp.wz];
}

export function midpoint3(a, b) {
  return (a && b) ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] : null;
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

export function rotationAroundSpine(frameA, frameB, leftIdx, rightIdx) {
  const lA = world(frameA, leftIdx), rA = world(frameA, rightIdx);
  const lB = world(frameB, leftIdx), rB = world(frameB, rightIdx);
  if (!lA || !rA || !lB || !rB) return 0;
  const sB = midpoint3(world(frameB, KP.L_SHOULDER), world(frameB, KP.R_SHOULDER));
  const hB = midpoint3(world(frameB, KP.L_HIP), world(frameB, KP.R_HIP));
  if (!sB || !hB) return 0;
  const spine = Vec.sub(sB, hB);
  const vAp = Vec.projectPlane(Vec.sub(rA, lA), spine);
  const vBp = Vec.projectPlane(Vec.sub(rB, lB), spine);
  return Math.round(Vec.angle(vAp, vBp) * 180 / Math.PI);
}

export function analyzeKeypoints(frames, frameTimestamps, _view = 'face-on') {
  // ---- keyframe detection ----
  // Strategy: the most reliable signal in a swing is the top of the backswing
  // (hands at their highest point = wrist y minimum). Find that first, then
  // walk outward to find the address (when hands left address-height before
  // the top) and impact (when hands return to address-height after the top).
  // No fixed assumption that frame 0 = address: many videos have dead time.

  const handY = frames.map((f) => {
    if (!f) return null;
    const lw = f[KP.L_WRIST], rw = f[KP.R_WRIST];
    if (!lw || !rw) return null;
    return (lw.y + rw.y) / 2;
  });
  // 3-frame moving average smooths MediaPipe jitter.
  const handYSmooth = handY.map((_, i) => {
    const window = [handY[i - 1], handY[i], handY[i + 1]].filter((v) => v != null);
    return window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
  });

  // top = arg-min of smoothed hand y across the whole video (right-handed assumption).
  let topIdx = 0;
  let minHandY = Infinity;
  for (let i = 0; i < handYSmooth.length; i++) {
    const y = handYSmooth[i];
    if (y != null && y < minHandY) {
      minHandY = y;
      topIdx = i;
    }
  }

  // estimate address height = the highest (numerically largest) hand y seen
  // BEFORE the top, robust to noise via the 90th percentile.
  const preTop = handYSmooth.slice(0, topIdx).filter((v) => v != null);
  const addressY = percentile(preTop, 0.9) ?? handYSmooth[0] ?? minHandY + 0.2;

  // swingStart = LAST frame before top where the hands were still at address
  // height. (Walking back from top, find the first frame >= addressY * 0.95.)
  // This is the moment just before the backswing begins.
  let swingStart = 0;
  for (let i = topIdx - 1; i >= 0; i--) {
    if (handYSmooth[i] != null && handYSmooth[i] >= addressY * 0.95) {
      swingStart = i;
      break;
    }
  }

  // impact = FIRST frame after top where hands return to address height.
  // Fall back to peak downward velocity if they never quite get there.
  let impactIdx = -1;
  for (let i = topIdx + 1; i < handYSmooth.length; i++) {
    if (handYSmooth[i] != null && handYSmooth[i] >= addressY * 0.95) {
      impactIdx = i;
      break;
    }
  }
  if (impactIdx === -1) {
    let best = -Infinity;
    for (let i = topIdx + 1; i < handYSmooth.length; i++) {
      const a = handYSmooth[i - 1], b = handYSmooth[i];
      if (a == null || b == null) continue;
      const dt = Math.max(0.001, frameTimestamps[i] - frameTimestamps[i - 1]);
      const dy = (b - a) / dt;
      if (dy > best) { best = dy; impactIdx = i; }
    }
    if (impactIdx === -1) impactIdx = Math.min(handYSmooth.length - 1, topIdx + 1);
  }

  // finish = last "active" frame after impact. Use a hand-velocity drop-off:
  // first frame after impact where hands have been close-to-stationary for K samples.
  let finishIdx = handYSmooth.length - 1;
  for (let i = impactIdx + 2; i < handYSmooth.length; i++) {
    const a = handYSmooth[i - 1], b = handYSmooth[i];
    const c = handYSmooth[i - 2];
    if (a == null || b == null || c == null) continue;
    const dt1 = Math.max(0.001, frameTimestamps[i] - frameTimestamps[i - 1]);
    const dt2 = Math.max(0.001, frameTimestamps[i - 1] - frameTimestamps[i - 2]);
    const v1 = Math.abs(b - a) / dt1;
    const v2 = Math.abs(a - c) / dt2;
    if (v1 < 0.03 && v2 < 0.03) {
      finishIdx = i - 1;
      break;
    }
  }

  const debug = {
    topIdx,
    swingStart,
    impactIdx,
    finishIdx,
    addressY: Number(addressY.toFixed(3)),
    minHandY: Number(minHandY.toFixed(3)),
  };

  // Head stability over the active swing window, in image space (normalized
  // 0-1 across the frame). World coords are camera-relative so body rotation
  // induces phantom head motion; image space is what the viewer perceives as
  // "the head moved." Threshold 8% of frame diagonal -> 0/100; pros score >95.
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let noseSamples = 0;
  for (let i = swingStart; i <= impactIdx; i++) {
    const n = frames[i] && frames[i][KP.NOSE];
    if (!n || n.score < 0.3) continue;
    if (n.x < xMin) xMin = n.x; if (n.x > xMax) xMax = n.x;
    if (n.y < yMin) yMin = n.y; if (n.y > yMax) yMax = n.y;
    noseSamples++;
  }
  const headRange = noseSamples > 0 ? Math.hypot(xMax - xMin, yMax - yMin) : 0;
  const headStability = Math.round((1 - Math.min(1, headRange / 0.08)) * 100);

  // rotations use the swing-start frame as "address," not frame 0.
  const addressF = frames[swingStart];
  const topF = frames[topIdx];
  const impactF = frames[impactIdx];
  const shoulderTurnDeg = rotationAroundSpine(addressF, topF, KP.L_SHOULDER, KP.R_SHOULDER);
  const hipTurnDeg = rotationAroundSpine(addressF, impactF, KP.L_HIP, KP.R_HIP);

  const backswingSec = frameTimestamps[topIdx] - frameTimestamps[swingStart];
  const downswingSec = Math.max(0.01, frameTimestamps[impactIdx] - frameTimestamps[topIdx]);
  const ratio = backswingSec / downswingSec;
  const tempo = ratio > 2.5 && ratio < 3.5 ? 'on-tempo' : ratio < 2.5 ? 'quick' : 'slow';

  const durationMs = Math.round((frameTimestamps[finishIdx] - frameTimestamps[swingStart]) * 1000);

  return {
    keyframes: { swingStart, topIdx, impactIdx, finishIdx },
    debug,
    metrics: {
      headStability,
      headRange: Number(headRange.toFixed(3)),
      shoulderTurnDeg,
      hipTurnDeg,
      tempo,
      tempoRatio: Number(ratio.toFixed(2)),
      durationMs,
      backswingSec: Number(backswingSec.toFixed(2)),
      downswingSec: Number(downswingSec.toFixed(2)),
    },
    insights: buildInsights({ headStability, shoulderTurnDeg, hipTurnDeg, tempo, ratio }),
  };
}

export function buildInsights({ headStability, shoulderTurnDeg, hipTurnDeg, tempo, ratio }) {
  const out = [];
  if (headStability >= 80) out.push(`Head stayed steady through impact (${headStability}/100) — keep it.`);
  else if (headStability >= 60) out.push(`Some head drift (${headStability}/100). Pick a spot on the ball and keep eyes on it through impact.`);
  else out.push(`Head moved a lot (${headStability}/100). Try the "eyes on a spot" drill — fixed gaze for the full swing.`);

  if (shoulderTurnDeg > 0 && shoulderTurnDeg < 70) out.push(`Shoulder turn shallow (${shoulderTurnDeg}°). Pros sit ~90° at the top — get the lead shoulder under the chin.`);
  else if (shoulderTurnDeg >= 70 && shoulderTurnDeg <= 110) out.push(`Shoulder turn ${shoulderTurnDeg}° — solid coil.`);
  else if (shoulderTurnDeg > 110) out.push(`Big shoulder turn (${shoulderTurnDeg}°). Powerful — make sure you're not losing posture to get there.`);

  if (hipTurnDeg > 0 && hipTurnDeg < 25) out.push(`Hips barely cleared (${hipTurnDeg}°). Drill: feel the lead hip working back and around through impact.`);
  else if (hipTurnDeg >= 25 && hipTurnDeg <= 60) out.push(`Hips opening ${hipTurnDeg}° at impact — body leading the club through.`);
  else if (hipTurnDeg > 60) out.push(`Hips very open at impact (${hipTurnDeg}°) — fast lower body. Watch that the upper body keeps up.`);

  if (isFinite(ratio) && ratio > 0) {
    if (tempo === 'on-tempo') out.push(`Tempo ${ratio.toFixed(2)}:1 — near pro 3:1 ratio.`);
    else if (tempo === 'quick') out.push(`Tempo quick (${ratio.toFixed(2)}:1, pros sit ~3:1). Pause at the top.`);
    else out.push(`Tempo slow (${ratio.toFixed(2)}:1, pros sit ~3:1). Let the club fall — don't steer.`);
  }
  return out;
}

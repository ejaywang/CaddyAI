// Run the shared analysis heuristics against a pose-JSON file produced by
// tools/extract_pose.py. Prints a structured report so we can see exactly
// what the app would have reported for the same input.
//
// Usage:
//   node tools/run_analysis.mjs <pose.json> [view]
//     view = 'face-on' | 'down-the-line' (default 'face-on')

import fs from 'node:fs';
import { analyzeKeypoints, KP } from '../lib/analysis.mjs';

const [, , poseJson, view = 'face-on'] = process.argv;
if (!poseJson) {
  console.error('usage: node tools/run_analysis.mjs <pose.json> [face-on|down-the-line]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(poseJson, 'utf8'));
const frames = data.frames;
const timestamps = data.sampledFrameTimestamps;

// Carry-forward fill for missing frames (same as App.js).
let last = null;
for (let i = 0; i < frames.length; i++) {
  if (frames[i]) last = frames[i];
  else if (last) frames[i] = last;
}

const result = analyzeKeypoints(frames, timestamps, view);

console.log('=== input ===');
console.log(`video:      ${data.video}`);
console.log(`size:       ${data.width} x ${data.height}`);
console.log(`duration:   ${data.videoDurationSec.toFixed(2)}s`);
console.log(`frames:     ${frames.length} sampled, ${frames.filter(Boolean).length} with pose`);
console.log(`view:       ${view}`);

console.log('\n=== keyframes ===');
const { swingStart, topIdx, impactIdx, finishIdx } = result.keyframes;
const fmt = (idx) => `frame ${idx} @ ${timestamps[idx]?.toFixed(2)}s`;
console.log(`address:    ${fmt(swingStart)}`);
console.log(`top:        ${fmt(topIdx)}`);
console.log(`impact:     ${fmt(impactIdx)}`);
console.log(`finish:     ${fmt(finishIdx)}`);
console.log('debug:     ', result.debug);

console.log('\n=== metrics ===');
for (const [k, v] of Object.entries(result.metrics)) {
  console.log(`${k.padEnd(16)} ${v}`);
}

console.log('\n=== insights ===');
for (const line of result.insights) console.log('- ' + line);

console.log('\n=== keypoint sanity ===');
// Spot-check: how close is the detected pose to the image?
const f0 = frames[0];
if (f0) {
  console.log('frame 0 — visibility avg:',
    (f0.reduce((a, p) => a + (p?.score || 0), 0) / 33).toFixed(2));
  console.log(`  nose       (img):     ${f0[KP.NOSE].x.toFixed(3)}, ${f0[KP.NOSE].y.toFixed(3)} score=${f0[KP.NOSE].score.toFixed(2)}`);
  console.log(`  l_shoulder (img):     ${f0[KP.L_SHOULDER].x.toFixed(3)}, ${f0[KP.L_SHOULDER].y.toFixed(3)} score=${f0[KP.L_SHOULDER].score.toFixed(2)}`);
  console.log(`  r_wrist    (img):     ${f0[KP.R_WRIST].x.toFixed(3)}, ${f0[KP.R_WRIST].y.toFixed(3)} score=${f0[KP.R_WRIST].score.toFixed(2)}`);
  console.log(`  r_wrist    (world):   ${f0[KP.R_WRIST].wx?.toFixed(3)}, ${f0[KP.R_WRIST].wy?.toFixed(3)}, ${f0[KP.R_WRIST].wz?.toFixed(3)}`);
  console.log(`  l_shoulder (world):   ${f0[KP.L_SHOULDER].wx?.toFixed(3)}, ${f0[KP.L_SHOULDER].wy?.toFixed(3)}, ${f0[KP.L_SHOULDER].wz?.toFixed(3)}`);
}
const fT = frames[topIdx];
if (fT) {
  console.log(`top frame  — r_wrist   (img):     ${fT[KP.R_WRIST].x.toFixed(3)}, ${fT[KP.R_WRIST].y.toFixed(3)} score=${fT[KP.R_WRIST].score.toFixed(2)}`);
  console.log(`             l_shoulder(world):   ${fT[KP.L_SHOULDER].wx?.toFixed(3)}, ${fT[KP.L_SHOULDER].wy?.toFixed(3)}, ${fT[KP.L_SHOULDER].wz?.toFixed(3)}`);
  console.log(`             r_shoulder(world):   ${fT[KP.R_SHOULDER].wx?.toFixed(3)}, ${fT[KP.R_SHOULDER].wy?.toFixed(3)}, ${fT[KP.R_SHOULDER].wz?.toFixed(3)}`);
}

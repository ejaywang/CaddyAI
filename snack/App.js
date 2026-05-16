// CaddyAI - on-device swing analysis (Snack build)
// Pick a swing video → MediaPipe Pose runs in a hidden WebView (WASM) →
// skeleton overlay + metrics + coaching text. Everything runs on the
// device. No API, no account, no cost. Works in Expo Go.

import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { WebView } from 'react-native-webview';

// ---------- theme ----------
const C = {
  bg: '#0B1A14',
  surface: '#13261E',
  border: '#26473A',
  text: '#E8F2EC',
  dim: '#8FA89B',
  primary: '#4ADE80',
  warn: '#E9A23B',
  bad: '#E5715C',
  skeleton: '#4ADE80',
  faceBox: '#E5715C',
};

// ---------- MediaPipe Pose Landmarker: 33 keypoints ----------
// https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
const KP = {
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

const EDGES = [
  // torso
  [KP.L_SHOULDER, KP.R_SHOULDER],
  [KP.L_SHOULDER, KP.L_HIP],
  [KP.R_SHOULDER, KP.R_HIP],
  [KP.L_HIP, KP.R_HIP],
  // arms
  [KP.L_SHOULDER, KP.L_ELBOW], [KP.L_ELBOW, KP.L_WRIST],
  [KP.R_SHOULDER, KP.R_ELBOW], [KP.R_ELBOW, KP.R_WRIST],
  // legs
  [KP.L_HIP, KP.L_KNEE], [KP.L_KNEE, KP.L_ANKLE],
  [KP.R_HIP, KP.R_KNEE], [KP.R_KNEE, KP.R_ANKLE],
];

const FACE_KEYPOINTS = [KP.NOSE, KP.L_EYE, KP.R_EYE, KP.L_EAR, KP.R_EAR];

// ---------- pose-detector WebView HTML ----------
// Loads MediaPipe Tasks Vision (Pose Landmarker) from jsDelivr CDN and exposes
// a postMessage protocol: { type: 'frame', id, dataUrl } -> { type: 'result',
// id, keypoints[] | error }. Stays alive across multiple frame requests.

const DETECTOR_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>html,body{margin:0;background:#000;color:#fff;font-family:sans-serif;font-size:12px;padding:8px}</style>
</head><body>
<div id="status">Loading MediaPipe…</div>
<script type="module">
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const statusEl = document.getElementById('status');
const setStatus = (t) => { try { statusEl.textContent = t; } catch (e) {} };

function post(msg) {
  const s = JSON.stringify(msg);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
}

let landmarker = null;
let initError = null;

async function init() {
  try {
    setStatus('Loading WASM…');
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    setStatus('Loading model…');
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
    });
    setStatus('Ready');
    post({ type: 'ready' });
  } catch (e) {
    initError = String(e);
    setStatus('Init error: ' + initError);
    post({ type: 'init_error', error: initError });
  }
}

async function processFrame(id, dataUrl) {
  if (!landmarker) {
    post({ type: 'result', id, error: 'not_ready' });
    return;
  }
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const result = landmarker.detect(canvas);
    const lm = (result.landmarks && result.landmarks[0]) || [];
    const wlm = (result.worldLandmarks && result.worldLandmarks[0]) || [];
    const keypoints = lm.map((p, i) => {
      const w = wlm[i];
      return {
        x: p.x, y: p.y,
        score: p.visibility != null ? p.visibility : 1,
        wx: w ? w.x : null,
        wy: w ? w.y : null,
        wz: w ? w.z : null,
      };
    });
    post({ type: 'result', id, keypoints });
  } catch (e) {
    post({ type: 'result', id, error: String(e) });
  }
}

function handle(raw) {
  try {
    const msg = JSON.parse(raw);
    if (msg.type === 'frame') processFrame(msg.id, msg.dataUrl);
  } catch (e) {}
}
window.addEventListener('message', (e) => handle(e.data));
document.addEventListener('message', (e) => handle(e.data));

init();
</script></body></html>
`;

// ---------- 3D vector helpers ----------
const Vec = {
  sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  scale: (a, k) => [a[0]*k, a[1]*k, a[2]*k],
  dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
  norm: (a) => Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]),
  unit: (a) => { const n = Vec.norm(a); return n > 1e-9 ? Vec.scale(a, 1/n) : a; },
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

function world(frame, idx) {
  const kp = frame && frame[idx];
  if (!kp || kp.wx == null) return null;
  return [kp.wx, kp.wy, kp.wz];
}

function midpoint3(a, b) {
  return (a && b) ? [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2] : null;
}

// Angle between the left↔right vector of `leftIdx`/`rightIdx` joints at frame A
// vs frame B, projected onto the plane perpendicular to the spine. View-agnostic.
function rotationAroundSpine(frameA, frameB, leftIdx, rightIdx) {
  const lA = world(frameA, leftIdx), rA = world(frameA, rightIdx);
  const lB = world(frameB, leftIdx), rB = world(frameB, rightIdx);
  if (!lA || !rA || !lB || !rB) return 0;
  const shouldersMidB = midpoint3(world(frameB, KP.L_SHOULDER), world(frameB, KP.R_SHOULDER));
  const hipsMidB = midpoint3(world(frameB, KP.L_HIP), world(frameB, KP.R_HIP));
  if (!shouldersMidB || !hipsMidB) return 0;
  const spine = Vec.sub(shouldersMidB, hipsMidB);
  const vAp = Vec.projectPlane(Vec.sub(rA, lA), spine);
  const vBp = Vec.projectPlane(Vec.sub(rB, lB), spine);
  return Math.round(Vec.angle(vAp, vBp) * 180 / Math.PI);
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// ---------- analysis (metrics + text from keypoint timeline) ----------
function analyzeKeypoints(frames, frameTimestamps, view) {
  // Keyframe detection: find the top (argmin of smoothed hand y), then walk
  // outward to find the address (last frame at address-height before top) and
  // impact (first frame back to address-height after top). This handles videos
  // that have dwell time before/after the swing.
  const handY = frames.map((f) => {
    if (!f) return null;
    const lw = f[KP.L_WRIST], rw = f[KP.R_WRIST];
    if (!lw || !rw) return null;
    return (lw.y + rw.y) / 2;
  });
  const handYSmooth = handY.map((_, i) => {
    const w = [handY[i - 1], handY[i], handY[i + 1]].filter((v) => v != null);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  });

  let topIdx = 0;
  let minHandY = Infinity;
  for (let i = 0; i < handYSmooth.length; i++) {
    if (handYSmooth[i] != null && handYSmooth[i] < minHandY) {
      minHandY = handYSmooth[i];
      topIdx = i;
    }
  }

  const preTop = handYSmooth.slice(0, topIdx).filter((v) => v != null);
  const addressY = percentile(preTop, 0.9) ?? handYSmooth[0] ?? minHandY + 0.2;

  let swingStart = 0;
  for (let i = topIdx - 1; i >= 0; i--) {
    if (handYSmooth[i] != null && handYSmooth[i] >= addressY * 0.95) {
      swingStart = i;
      break;
    }
  }

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

  let finishIdx = handYSmooth.length - 1;
  for (let i = impactIdx + 2; i < handYSmooth.length; i++) {
    const a = handYSmooth[i - 1], b = handYSmooth[i], c = handYSmooth[i - 2];
    if (a == null || b == null || c == null) continue;
    const dt1 = Math.max(0.001, frameTimestamps[i] - frameTimestamps[i - 1]);
    const dt2 = Math.max(0.001, frameTimestamps[i - 1] - frameTimestamps[i - 2]);
    if (Math.abs(b - a) / dt1 < 0.03 && Math.abs(a - c) / dt2 < 0.03) {
      finishIdx = i - 1;
      break;
    }
  }

  // Head stability over the active swing window, in image space. World coords
  // are camera-relative so body rotation induces phantom head motion; image
  // space is what the viewer perceives as "head moved." 8% of frame = 0/100.
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

  // 3D rotations around the spine axis (view-agnostic).
  // Rotations: use swingStart frame as "address," not frame 0 (which may be
  // pre-swing dwell).
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
    metrics: {
      headStability,
      shoulderTurnDeg,
      hipTurnDeg,
      tempo,
      tempoRatio: Number(ratio.toFixed(2)),
      durationMs,
    },
    insights: buildInsights({ headStability, shoulderTurnDeg, hipTurnDeg, tempo, ratio }),
  };
}

function buildInsights({ headStability, shoulderTurnDeg, hipTurnDeg, tempo, ratio }) {
  const out = [];
  if (headStability >= 80) out.push(`Head stayed steady through impact (${headStability}/100) — keep it.`);
  else if (headStability >= 60) out.push(`Some head drift (${headStability}/100). Pick a spot on the ball and keep eyes on it through impact.`);
  else out.push(`Head moved a lot (${headStability}/100). Try the "eyes on a spot" drill — fixed gaze for the full swing.`);

  // Pro shoulder turn at top ~85-100°. Under 70 is shallow.
  if (shoulderTurnDeg > 0 && shoulderTurnDeg < 70) out.push(`Shoulder turn shallow (${shoulderTurnDeg}°). Pros sit ~90° at the top — get the lead shoulder under the chin.`);
  else if (shoulderTurnDeg >= 70 && shoulderTurnDeg <= 110) out.push(`Shoulder turn ${shoulderTurnDeg}° — solid coil.`);
  else if (shoulderTurnDeg > 110) out.push(`Big shoulder turn (${shoulderTurnDeg}°). Powerful — make sure you're not losing posture to get there.`);

  // Pro hip turn at impact ~40-50°. Under 25 means hips aren't clearing.
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

// ---------- the WebView-backed pose runner ----------

function usePoseRunner() {
  const webRef = useRef(null);
  const pendingRef = useRef(new Map());
  const idRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const onMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'init_error') setError(msg.error || 'init failed');
    else if (msg.type === 'result') {
      const cb = pendingRef.current.get(msg.id);
      if (cb) {
        pendingRef.current.delete(msg.id);
        cb(msg);
      }
    }
  }, []);

  const detect = useCallback((dataUrl) => {
    return new Promise((resolve, reject) => {
      if (!webRef.current) return reject(new Error('detector not mounted'));
      const id = String(++idRef.current);
      pendingRef.current.set(id, (m) => {
        if (m.error) reject(new Error(m.error));
        else resolve(m.keypoints);
      });
      const payload = JSON.stringify({ type: 'frame', id, dataUrl });
      webRef.current.postMessage(payload);
      // safety timeout
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          reject(new Error('detect timeout'));
        }
      }, 15000);
    });
  }, []);

  const node = (
    <View style={styles.hiddenWeb} pointerEvents="none">
      <WebView
        ref={webRef}
        source={{ html: DETECTOR_HTML }}
        onMessage={onMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowFileAccess
        allowUniversalAccessFromFileURLs
        style={{ flex: 1, backgroundColor: '#000' }}
      />
    </View>
  );

  return { node, ready, error, detect };
}

// ---------- App ----------
export default function App() {
  const runner = usePoseRunner();
  const [stage, setStage] = useState('home');
  const [videoUri, setVideoUri] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('face-on'); // 'face-on' | 'down-the-line'

  const pickAndAnalyze = useCallback(async () => {
    setError(null);
    if (!runner.ready) {
      setError('Pose detector still loading. Try again in a moment.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Need photo library access.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    setVideoUri(asset.uri);
    setStage('analyzing');

    try {
      const durationMs = asset.duration || 3000;
      const targetFps = 10; // sampling rate, not playback rate
      const numFrames = Math.max(15, Math.min(60, Math.round((durationMs / 1000) * targetFps)));
      const stepMs = durationMs / (numFrames - 1);
      const frameTimestamps = []; // seconds, one per frame

      const frames = new Array(numFrames).fill(null);

      for (let i = 0; i < numFrames; i++) {
        setProgress({ done: i, total: numFrames, label: 'Extracting frame' });
        const timeMs = Math.round(i * stepMs);
        frameTimestamps.push(timeMs / 1000);
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(asset.uri, {
          time: timeMs,
          quality: 0.5,
        });
        const dataUrl = await uriToDataUrl(thumbUri);
        setProgress({ done: i, total: numFrames, label: 'Detecting pose' });
        const keypoints = await runner.detect(dataUrl).catch(() => null);
        frames[i] = keypoints;
      }

      setProgress({ done: numFrames, total: numFrames, label: 'Computing metrics' });
      const dense = frames.map((f) => (f && f.length ? f : null));
      let last = null;
      for (let i = 0; i < dense.length; i++) {
        if (dense[i]) last = dense[i];
        else if (last) dense[i] = last;
      }
      if (!dense.some(Boolean)) {
        throw new Error('No pose detected in this video. Try a clearer full-body swing video.');
      }

      const summary = analyzeKeypoints(dense, frameTimestamps, view);
      setAnalysis({ frames: dense, frameTimestamps, view, durationSec: durationMs / 1000, ...summary });
      setStage('result');
    } catch (e) {
      setError(String(e.message || e));
      setStage('home');
    }
  }, [runner]);

  const reset = () => {
    setStage('home');
    setVideoUri(null);
    setAnalysis(null);
    setError(null);
    setProgress({ done: 0, total: 0, label: '' });
  };

  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      {runner.node}
      {stage === 'home' && (
        <HomeScreen
          onPick={pickAndAnalyze}
          ready={runner.ready}
          runnerError={runner.error}
          error={error}
          view={view}
          setView={setView}
        />
      )}
      {stage === 'analyzing' && <AnalyzingScreen progress={progress} />}
      {stage === 'result' && analysis && (
        <ResultScreen videoUri={videoUri} analysis={analysis} onReset={reset} />
      )}
    </View>
  );
}

async function uriToDataUrl(uri) {
  // expo-video-thumbnails returns a file:// URI. Convert to base64 data URL
  // via fetch (works in Expo Go for file URIs).
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ---------- screens ----------
function HomeScreen({ onPick, ready, runnerError, error, view, setView }) {
  return (
    <View style={styles.center}>
      <Text style={styles.brand}>CaddyAI</Text>
      <Text style={styles.tagline}>Swing analysis with on-device pose tracking</Text>

      <Text style={styles.viewLabel}>Camera angle</Text>
      <View style={styles.viewToggle}>
        <Pressable
          onPress={() => setView('face-on')}
          style={[styles.viewBtn, view === 'face-on' && styles.viewBtnActive]}
        >
          <Text style={[styles.viewBtnText, view === 'face-on' && styles.viewBtnTextActive]}>
            Face-on
          </Text>
          <Text style={styles.viewBtnHint}>golfer faces camera</Text>
        </Pressable>
        <Pressable
          onPress={() => setView('down-the-line')}
          style={[styles.viewBtn, view === 'down-the-line' && styles.viewBtnActive]}
        >
          <Text style={[styles.viewBtnText, view === 'down-the-line' && styles.viewBtnTextActive]}>
            Down-the-line
          </Text>
          <Text style={styles.viewBtnHint}>camera behind golfer</Text>
        </Pressable>
      </View>

      <Pressable onPress={onPick} disabled={!ready} style={[styles.cta, !ready && { opacity: 0.5 }]}>
        <Text style={styles.ctaText}>{ready ? 'Pick a swing video' : 'Loading pose model…'}</Text>
      </Pressable>

      <Text style={styles.hint}>
        {view === 'face-on'
          ? 'Camera in front of you, body facing the lens, full body in frame, 2–5 seconds.'
          : 'Camera behind you on the target line, capturing your back. Full body in frame, 2–5 seconds.'}
      </Text>

      {runnerError ? <Text style={styles.error}>Pose model error: {runnerError}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.footer}>
        Pose detection: MediaPipe (Google) running on-device in WebView.
        No API, no account, no cost.
      </Text>
    </View>
  );
}

function AnalyzingScreen({ progress }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={[styles.brand, { marginTop: 24, fontSize: 18 }]}>
        {progress.label || 'Analyzing…'}
      </Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={{ color: C.dim, marginTop: 12, fontSize: 13 }}>
        {progress.done}/{progress.total} frames
      </Text>
    </View>
  );
}

function ResultScreen({ videoUri, analysis, onReset }) {
  const player = useVideoPlayer(videoUri, (p) => { p.loop = true; p.play(); });
  const [currentTime, setCurrentTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      try { setCurrentTime(player.currentTime || 0); } catch (e) {}
    }, 50);
    return () => clearInterval(id);
  }, [player]);

  const togglePlay = () => {
    if (paused) { player.play(); setPaused(false); }
    else { player.pause(); setPaused(true); }
  };

  const frameIdx = frameIndexForTime(analysis.frameTimestamps, currentTime);
  const currentKeypoints = analysis.frames[frameIdx];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <Pressable onPress={onReset} hitSlop={8}><Text style={styles.back}>‹ New swing</Text></Pressable>
        <Text style={styles.headerTitle}>Analysis</Text>
        <View style={{ width: 80 }} />
      </View>

      <Pressable
        onPress={togglePlay}
        onLayout={(e) => setSize(e.nativeEvent.layout)}
        style={styles.videoFrame}
      >
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        <SkeletonOverlay keypoints={currentKeypoints} width={size.width} height={size.height} />
        {paused ? (
          <View style={styles.playBadge}><Text style={{ color: C.text, fontWeight: '700' }}>▶</Text></View>
        ) : null}
      </Pressable>

      <KeyframeStrip
        keyframes={analysis.keyframes}
        frameTimestamps={analysis.frameTimestamps}
        currentFrame={frameIdx}
        onSeek={(idx) => { try { player.currentTime = analysis.frameTimestamps[idx]; } catch (e) {} }}
      />

      <View style={styles.metricsRow}>
        <Tile
          label="Head stability"
          value={`${analysis.metrics.headStability}`}
          hint="/ 100"
          tone={analysis.metrics.headStability >= 80 ? 'good' : 'warn'}
        />
        <Tile
          label="Tempo"
          value={`${analysis.metrics.tempoRatio}:1`}
          hint={analysis.metrics.tempo}
          tone={analysis.metrics.tempo === 'on-tempo' ? 'good' : 'warn'}
        />
      </View>
      <View style={styles.metricsRow}>
        <Tile label="Shoulder turn" value={`${analysis.metrics.shoulderTurnDeg}°`} hint="at top" />
        <Tile label="Hip turn" value={`${analysis.metrics.hipTurnDeg}°`} hint="at impact" />
      </View>

      <View style={styles.insightsSection}>
        <Text style={styles.sectionTitle}>Coach notes</Text>
        {analysis.insights.map((insight, i) => (
          <View key={i} style={styles.insightCard}>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SkeletonOverlay({ keypoints, width, height }) {
  if (!keypoints || !width || !height) return null;
  const px = (x) => x * width;
  const py = (y) => y * height;

  const faceXs = FACE_KEYPOINTS.map((i) => keypoints[i]?.x).filter((v) => typeof v === 'number');
  const faceYs = FACE_KEYPOINTS.map((i) => keypoints[i]?.y).filter((v) => typeof v === 'number');
  let faceBox = null;
  if (faceXs.length > 0) {
    const fx = Math.min(...faceXs) * width - 6;
    const fy = Math.min(...faceYs) * height - 10;
    const fw = (Math.max(...faceXs) - Math.min(...faceXs)) * width + 12;
    const fh = (Math.max(...faceYs) - Math.min(...faceYs)) * height + 16;
    faceBox = { fx, fy, fw, fh };
  }

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {EDGES.map(([a, b], i) => {
        const ka = keypoints[a], kb = keypoints[b];
        if (!ka || !kb || ka.score < 0.3 || kb.score < 0.3) return null;
        return (
          <Line key={i} x1={px(ka.x)} y1={py(ka.y)} x2={px(kb.x)} y2={py(kb.y)}
                stroke={C.skeleton} strokeWidth={3} strokeLinecap="round" />
        );
      })}
      {keypoints.map((kp, i) => {
        if (!kp || kp.score < 0.3) return null;
        if (i <= KP.MOUTH_R) return null; // skip face dots, we draw a box
        if (i > KP.R_ANKLE) return null;   // skip foot details (cleaner overlay)
        return (
          <Circle key={i} cx={px(kp.x)} cy={py(kp.y)} r={4}
                  fill="#fff" stroke={C.skeleton} strokeWidth={2} />
        );
      })}
      {faceBox ? (
        <Rect x={faceBox.fx} y={faceBox.fy} width={faceBox.fw} height={faceBox.fh}
              stroke={C.faceBox} strokeWidth={2.5} fill="none" />
      ) : null}
    </Svg>
  );
}

function KeyframeStrip({ keyframes, frameTimestamps, currentFrame, onSeek }) {
  const marks = [
    { label: 'Address', idx: keyframes.swingStart },
    { label: 'Top', idx: keyframes.topIdx },
    { label: 'Impact', idx: keyframes.impactIdx },
    { label: 'Finish', idx: keyframes.finishIdx },
  ];
  return (
    <View style={styles.keyframeStrip}>
      {marks.map((m) => (
        <Pressable
          key={m.label}
          onPress={() => onSeek(m.idx)}
          style={[styles.keyframeBtn, Math.abs(currentFrame - m.idx) < 2 && styles.keyframeBtnActive]}
        >
          <Text style={styles.keyframeBtnText}>{m.label}</Text>
          <Text style={styles.keyframeBtnTime}>{(frameTimestamps[m.idx] ?? 0).toFixed(2)}s</Text>
        </Pressable>
      ))}
    </View>
  );
}

function frameIndexForTime(timestamps, t) {
  if (!timestamps || timestamps.length === 0) return 0;
  if (t <= timestamps[0]) return 0;
  if (t >= timestamps[timestamps.length - 1]) return timestamps.length - 1;
  let lo = 0, hi = timestamps.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid] <= t) lo = mid;
    else hi = mid;
  }
  return Math.abs(timestamps[lo] - t) < Math.abs(timestamps[hi] - t) ? lo : hi;
}

function Tile({ label, value, hint, tone = 'default' }) {
  const color = tone === 'good' ? C.primary : tone === 'warn' ? C.warn : C.text;
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg, paddingTop: 50 },
  hiddenWeb: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  brand: { color: C.text, fontSize: 32, fontWeight: '700', letterSpacing: 0.5 },
  tagline: { color: C.dim, fontSize: 14, marginTop: 8, textAlign: 'center' },
  viewLabel: {
    color: C.dim, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: 32, marginBottom: 8,
  },
  viewToggle: { flexDirection: 'row', gap: 8 },
  viewBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center',
  },
  viewBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '22' },
  viewBtnText: { color: C.text, fontSize: 14, fontWeight: '700' },
  viewBtnTextActive: { color: C.primary },
  viewBtnHint: { color: C.dim, fontSize: 10, marginTop: 2 },
  cta: { marginTop: 28, backgroundColor: C.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  ctaText: { color: '#03130B', fontSize: 16, fontWeight: '700' },
  hint: { color: C.dim, fontSize: 13, marginTop: 24, textAlign: 'center', lineHeight: 18 },
  footer: { color: C.dim, fontSize: 11, marginTop: 40, textAlign: 'center', lineHeight: 16, fontStyle: 'italic' },
  error: { color: C.bad, marginTop: 16, fontSize: 13, textAlign: 'center' },
  progressBar: {
    marginTop: 16, width: 200, height: 6, borderRadius: 3,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  back: { color: C.primary, fontSize: 15, fontWeight: '600' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  videoFrame: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000', position: 'relative' },
  playBadge: {
    position: 'absolute', top: '45%', left: '45%', width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center',
  },
  keyframeStrip: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 8, backgroundColor: C.surface },
  keyframeBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: 'center',
  },
  keyframeBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '22' },
  keyframeBtnText: { color: C.text, fontSize: 12, fontWeight: '700' },
  keyframeBtnTime: { color: C.dim, fontSize: 11, marginTop: 2 },
  metricsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  tile: { flex: 1, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12 },
  tileLabel: { color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  tileHint: { color: C.dim, fontSize: 11, marginTop: 2 },
  insightsSection: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { color: C.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  insightCard: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  insightText: { color: C.text, fontSize: 14, lineHeight: 20 },
});

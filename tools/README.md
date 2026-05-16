# Debugging harness

Tools for testing the CaddyAI swing analysis pipeline outside of the
React Native app. The harness runs the **same** analysis heuristics
(`lib/analysis.mjs`) the Snack build runs — guaranteed in lockstep —
but uses Python MediaPipe + OpenCV for frame extraction so we can see
what's happening, render annotated frames, and iterate faster than the
phone-app loop.

## Setup

```bash
pip install mediapipe opencv-python numpy pillow
# also need libgles2 + libegl1 on Linux:
apt install -y libgles2 libegl1 libgl1
# and the MediaPipe model:
curl -L -o /tmp/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

## End-to-end run

```bash
# 1) extract pose keypoints from a video
python tools/extract_pose.py path/to/swing.mp4 /tmp/swing.pose.json

# 2) run the same analysis the app runs
node tools/run_analysis.mjs /tmp/swing.pose.json down-the-line
# (or face-on)

# 3) render the detected keyframes with skeleton overlay
python tools/render_overlay.py path/to/swing.mp4 /tmp/swing.pose.json /tmp/out \
  --keyframes 21,41,55,57
# or sample every N frames:
python tools/render_overlay.py ... /tmp/out --every 5
```

## Fixture

`tools/fixtures/pro_dtl_swing.mp4` is a tour-quality right-handed
swing in down-the-line view, sourced from
[HeleenaRobert/golf-swing-analysis](https://github.com/HeleenaRobert/golf-swing-analysis).
Use it as the calibration baseline when changing heuristics — known
characteristics:

| Truth (visual)            | Current metric output | Notes |
|---------------------------|-----------------------|-------|
| Address ~5.5s             | 5.52s ✓               | swingStart detection |
| Top ~10.5s                | 10.77s ✓              | argmin hand y |
| Impact ~14.4s             | 14.45s ✓              | hands return to address height |
| Pro head stability (~95)  | 15/100                | image-space; some real drift visible in DTL |
| Shoulder turn ~85-95°     | 53°                   | MediaPipe world-coord rotation; underestimates |
| Hip turn ~40-50°          | 6°                    | MediaPipe hip world coords nearly identical at address & impact |
| Pro tempo ~3:1            | 1.43:1                | could be impact-frame placement (off by one sample) |

Three classes of issue this fixture exposes:

1. **MediaPipe's pose world landmarks for hips are nearly symmetric and
   change very little frame-to-frame** — the hip turn calculation gets
   ~zero. Need a different signal (image-space hip line, or wait until
   we have club tracking).
2. **Shoulder-turn projection underestimates** the visual rotation,
   probably because spine direction is angled (golf posture) and the
   projection plane reduces the effective rotation. Switching to a
   fixed-vertical rotation axis would change the number but doesn't
   necessarily make it more correct.
3. **Tempo ratio is too quick on a pro swing.** Likely the impact frame
   is one sample past actual impact (we sample at 0.26s on a 15s clip,
   so true impact falls between samples). Need either finer sampling
   around the bottom of the wrist trajectory or sub-sample interpolation.

The bottom of the table is where future iterations should aim.

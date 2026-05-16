"""Render frames with the pose skeleton overlay drawn on top.

Used for visual debugging — emit PNGs we can look at to verify that
keypoints and keyframe detection are correct.

Usage:
    python tools/render_overlay.py <video> <pose.json> <out_dir> [--keyframes top,impact,finish] [--every N]
"""
import json
import sys
from pathlib import Path

import cv2

# COCO-ish edges over MediaPipe Pose 33-landmark format.
EDGES = [
    (11, 12), (11, 23), (12, 24), (23, 24),
    (11, 13), (13, 15),
    (12, 14), (14, 16),
    (23, 25), (25, 27),
    (24, 26), (26, 28),
]
FACE_KP = [0, 2, 5, 7, 8]  # nose, eyes, ears


def draw_overlay(img, kps, label=None):
    h, w = img.shape[:2]

    # face bounding box
    face_xs = [kps[i]["x"] for i in FACE_KP if kps[i]["x"] is not None]
    face_ys = [kps[i]["y"] for i in FACE_KP if kps[i]["y"] is not None]
    if face_xs:
        fx0 = int(min(face_xs) * w) - 6
        fy0 = int(min(face_ys) * h) - 10
        fx1 = int(max(face_xs) * w) + 6
        fy1 = int(max(face_ys) * h) + 10
        cv2.rectangle(img, (fx0, fy0), (fx1, fy1), (60, 80, 230), 2)

    # skeleton edges
    for a, b in EDGES:
        ka, kb = kps[a], kps[b]
        if (ka.get("score", 0) or 0) < 0.3: continue
        if (kb.get("score", 0) or 0) < 0.3: continue
        pa = (int(ka["x"] * w), int(ka["y"] * h))
        pb = (int(kb["x"] * w), int(kb["y"] * h))
        cv2.line(img, pa, pb, (80, 220, 130), 3)

    # joint dots
    for i, kp in enumerate(kps):
        if i in FACE_KP or i in (1, 3, 4, 6, 9, 10, 17, 18, 19, 20, 21, 22, 29, 30, 31, 32):
            continue
        if (kp.get("score", 0) or 0) < 0.3: continue
        p = (int(kp["x"] * w), int(kp["y"] * h))
        cv2.circle(img, p, 5, (255, 255, 255), -1)
        cv2.circle(img, p, 5, (80, 220, 130), 2)

    if label:
        cv2.rectangle(img, (0, 0), (w, 36), (0, 0, 0), -1)
        cv2.putText(img, label, (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)


def render(video_path, pose_path, out_dir, keyframe_indices=None, every=None):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    pose = json.loads(Path(pose_path).read_text())
    frames = pose["frames"]
    timestamps = pose["sampledFrameTimestamps"]

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise SystemExit(f"could not open {video_path}")

    indices = set()
    if keyframe_indices:
        indices.update(keyframe_indices)
    if every is not None:
        for i in range(0, len(frames), every):
            indices.add(i)

    for idx in sorted(indices):
        if idx >= len(frames): continue
        kps = frames[idx]
        if not kps:
            continue
        t_ms = int(timestamps[idx] * 1000)
        cap.set(cv2.CAP_PROP_POS_MSEC, float(t_ms))
        ok, frame = cap.read()
        if not ok: continue
        label = f"frame {idx} @ {timestamps[idx]:.2f}s"
        draw_overlay(frame, kps, label=label)
        out_path = out / f"f{idx:03d}_{timestamps[idx]:.2f}s.png"
        cv2.imwrite(str(out_path), frame)
        print(out_path)

    cap.release()


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 3:
        print(__doc__); sys.exit(1)
    video, pose_path, out_dir = args[:3]
    keyframes, every = None, None
    if "--keyframes" in args:
        kfs = args[args.index("--keyframes") + 1]
        keyframes = [int(x) for x in kfs.split(",")]
    if "--every" in args:
        every = int(args[args.index("--every") + 1])
    if not keyframes and every is None:
        every = 5
    render(video, pose_path, out_dir, keyframes, every)

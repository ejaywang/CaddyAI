"""Extract MediaPipe pose keypoints from a video, matching the Snack app's sampling.

Uses the same MediaPipe Pose Landmarker model the Snack's WebView loads
(pose_landmarker_lite, float16). Sampling: 10 FPS target, clamped 15-60
frames, evenly distributed across the video duration — identical to the
React Native pipeline in snack/App.js.

Output: JSON file with per-frame keypoints (33 landmarks + worldLandmarks).

Usage:
    python tools/extract_pose.py <video> <out.json> [--model path/to/.task]
"""
import json
import sys
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

DEFAULT_MODEL = "/tmp/pose_landmarker_lite.task"


def sample_timestamps_ms(duration_ms: float, target_fps: int = 10,
                          min_frames: int = 15, max_frames: int = 60):
    n = max(min_frames, min(max_frames, round((duration_ms / 1000) * target_fps)))
    step = duration_ms / (n - 1) if n > 1 else 0
    return [round(i * step) for i in range(n)]


def extract(video_path: str, model_path: str = DEFAULT_MODEL):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise SystemExit(f"could not open {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_ms = (n_frames / fps) * 1000

    timestamps_ms = sample_timestamps_ms(duration_ms)

    options = mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=model_path),
        running_mode=mp_vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.3,
        min_pose_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    )

    frames_out = []
    timestamps_out = []

    with mp_vision.PoseLandmarker.create_from_options(options) as landmarker:
        for t_ms in timestamps_ms:
            cap.set(cv2.CAP_PROP_POS_MSEC, float(t_ms))
            ok, frame = cap.read()
            if not ok:
                frames_out.append(None)
                timestamps_out.append(t_ms / 1000.0)
                continue
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect(mp_image)

            if not result.pose_landmarks:
                frames_out.append(None)
                timestamps_out.append(t_ms / 1000.0)
                continue

            lms = result.pose_landmarks[0]
            wlms = result.pose_world_landmarks[0] if result.pose_world_landmarks else [None] * 33

            kps = []
            for i in range(33):
                p = lms[i]
                w = wlms[i] if i < len(wlms) else None
                kps.append({
                    "x": p.x, "y": p.y,
                    "score": p.visibility,
                    "wx": w.x if w else None,
                    "wy": w.y if w else None,
                    "wz": w.z if w else None,
                })
            frames_out.append(kps)
            timestamps_out.append(t_ms / 1000.0)

    cap.release()
    return {
        "video": str(video_path),
        "width": width,
        "height": height,
        "videoFps": fps,
        "videoDurationSec": duration_ms / 1000.0,
        "sampledFrameTimestamps": timestamps_out,
        "frames": frames_out,
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    video, out = sys.argv[1], sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_MODEL
    data = extract(video, model)
    Path(out).write_text(json.dumps(data, indent=2))
    detected = sum(1 for f in data["frames"] if f)
    print(f"extracted {len(data['frames'])} frames, pose detected in {detected}")
    print(f"-> {out}")

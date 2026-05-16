# CaddyAI on Expo Snack

On-device golf swing analysis. Pick a video from your library, get a
pose-skeleton overlay, swing metrics, and coaching notes. The pose model
(MediaPipe Pose Landmarker, by Google) runs on-device inside a hidden
WebView — **no API, no account, no cost.**

## Run it

Open this URL in your phone browser, then "Open with Expo Go":

> https://snack.expo.dev/CDqSPQTGVUOzuwKtP68v8

## How it works

```
┌──────────────────┐    pick video    ┌───────────────────┐
│ expo-image-      │ ────────────────▶│ expo-video-       │
│   picker         │                  │   thumbnails      │ (extract N frames)
└──────────────────┘                  └─────────┬─────────┘
                                                │ JPEG data URLs
                                                ▼
                                      ┌───────────────────┐
                                      │ hidden WebView    │
                                      │ + @mediapipe/     │ (WASM, on-device)
                                      │   tasks-vision    │
                                      └─────────┬─────────┘
                                                │ keypoints[]
                                                ▼
                                      ┌───────────────────┐
                                      │ analyzeKeypoints  │ (metrics + text)
                                      └─────────┬─────────┘
                                                ▼
                                      ┌───────────────────┐
                                      │ VideoView with    │
                                      │ react-native-svg  │ (overlay)
                                      │ overlay           │
                                      └───────────────────┘
```

The WebView mounts an HTML page that loads MediaPipe's WASM pose model
from jsDelivr CDN. We send each extracted frame as a base64 data URL via
`postMessage`; the model runs in the WebView's JS engine and posts
keypoints back. The whole pipeline runs on the device — the only network
traffic is the one-time load of the WASM + model file (~10 MB cached).

## Re-publishing after edits

```bash
node snack/save.mjs   # prints the new hashId / URL
```

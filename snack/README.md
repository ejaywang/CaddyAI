# CaddyAI on Expo Snack

A single-file build of CaddyAI hosted on [Expo Snack](https://snack.expo.dev/)
so it can run on a phone via Expo Go without a local dev environment.

## Run it

Open this URL on a phone (or any browser) and follow the "My Device" /
QR-code instructions inside Expo Go:

> https://snack.expo.dev/exIFJpJTYQSm9VGAzz769

The Snack version is intentionally flattened: one `App.js`, state-based
navigation between Feed and Log views, but the same SQLite schema and
feedback heuristic as the full repo. Drills, progress charts, and the
swing-detail screen are trimmed.

## Re-publishing after edits

The single-file build is `App.js` in this folder. After editing it:

```bash
node snack/save.mjs
# prints { hashId: "..." } — that's the new Snack id
```

The full repo (multi-file expo-router app) under the project root is
the source of truth; this folder is a packaging detail for Snack.

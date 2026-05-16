# CaddyAI

An 18Birdies-inspired golf practice app. The MVP is focused, not encyclopedic:
log swings, get heuristic feedback, run targeted drills, track trends.

Built with Expo (React Native) + expo-router + expo-sqlite. All data lives
on-device — no account, no backend.

## Features

- **Log a swing**: club, shot type, strike (pure/thin/fat/toe/heel/pull/push),
  ball flight (straight/draw/fade/hook/slice), 1–5 ratings for quality,
  contact, and tempo, target + carry distance, free-form notes.
- **Auto feedback**: a heuristic engine reads each swing (and the last few
  swings with the same club) and surfaces practice cues plus a suggested
  drill. Lives in `src/lib/feedback.ts`.
- **Drill library**: seeded library of tempo, contact, path, face, and
  mental drills. Tap a drill to read it and mark it done.
- **Progress**: pure-strike rate, on-line rate, strike mix, ball-flight mix,
  per-club averages (quality, contact, tempo, carry, pure rate).

## Stack

- Expo SDK 52, React Native 0.76, React 18
- expo-router (file-based navigation)
- expo-sqlite (local storage)
- TypeScript

## Project layout

```
app/                       expo-router routes
  _layout.tsx              root stack, opens DB on mount
  (tabs)/
    index.tsx              practice feed
    stats.tsx              progress dashboard
    drills.tsx             drill library
  swing/
    log.tsx                modal: log a swing
    [id].tsx               swing detail + feedback thread
  drill/[id].tsx           drill detail + mark complete

src/
  db/
    client.ts              expo-sqlite wrapper + migrations + seed
    types.ts               domain types (Swing, Drill, etc.)
  lib/
    feedback.ts            heuristic feedback engine
    stats.ts               stats aggregations
  components/              reusable UI (Button, Chip, SwingCard, …)
  theme.ts                 colors, spacing, type
```

## Running

```bash
npm install
npm start        # then press i / a / w
```

Open the iOS / Android simulator or a physical device via Expo Go.

## Tests

```bash
npm run typecheck
node --test test/feedback.test.mjs
```

## Roadmap

- Video capture per swing (expo-camera) and swing replay
- Practice sessions: start/end timer, group swings into a session
- Course mode: GPS rangefinder, scorecard, handicap calc
- Cloud sync + friends feed (Supabase)

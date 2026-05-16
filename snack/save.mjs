// Posts the Snack single-file build to Snack's save API.
// On success prints the hashId — the URL is https://snack.expo.dev/<hashId>.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');

const deps = {
  'expo-image-picker': '*',
  'expo-video': '*',
  'expo-video-thumbnails': '*',
  'expo-status-bar': '*',
  'react-native-svg': '*',
  'react-native-webview': '*',
};

const payload = {
  manifest: {
    name: 'CaddyAI',
    description: 'On-device golf swing analysis (MediaPipe pose, no API).',
    slug: 'caddyai',
    sdkVersion: '54.0.0',
    dependencies: deps,
  },
  code: {
    'App.js': { contents: code, type: 'CODE' },
  },
  dependencies: Object.fromEntries(
    Object.entries(deps).map(([k, v]) => [k, { version: v }])
  ),
};

const res = await fetch('https://exp.host/--/api/v2/snack/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log('status:', res.status);
console.log('body:', text);

try {
  const parsed = JSON.parse(text);
  if (parsed.hashId) {
    console.log('\nURL: https://snack.expo.dev/' + parsed.hashId);
  }
} catch {}

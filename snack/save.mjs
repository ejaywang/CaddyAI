// Posts the Snack single-file build to Snack's save API.
// On success prints the URL.

import fs from 'node:fs';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');

const payload = {
  manifest: {
    name: 'CaddyAI',
    description: 'Golf swing tracking + practice feedback (local-only, SQLite).',
    slug: 'caddyai',
    sdkVersion: '54.0.0',
    dependencies: {
      'expo-sqlite': '*',
      'expo-status-bar': '*',
    },
  },
  code: {
    'App.js': { contents: code, type: 'CODE' },
  },
  dependencies: {
    'expo-sqlite': { version: '*' },
    'expo-status-bar': { version: '*' },
  },
};

const res = await fetch('https://exp.host/--/api/v2/snack/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log('status:', res.status);
console.log('body:', text);

// Posts the Snack single-file build to Snack's save API.
// On success prints the URL.

import fs from 'node:fs';

const code = fs.readFileSync('/tmp/snack-App.js', 'utf8');

const payload = {
  manifest: {
    name: 'CaddyAI',
    description: 'Golf swing tracking + practice feedback (local-only, SQLite).',
    slug: 'caddyai',
    sdkVersion: '52.0.0',
    dependencies: {
      'expo-sqlite': '~15.0.3',
      'expo-status-bar': '~2.0.0',
    },
  },
  code: {
    'App.js': { contents: code, type: 'CODE' },
  },
  dependencies: {
    'expo-sqlite': { version: '~15.0.3' },
    'expo-status-bar': { version: '~2.0.0' },
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

// Pure-logic tests for the feedback engine. Runs with `node --test`.
// We import the .ts source via tsx-style register, but since the engine
// has no external deps, we re-export it as plain JS here for the test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestFeedback } from './_feedback.mjs';

const baseSwing = {
  id: 'a',
  session_id: null,
  created_at: 1,
  club: '7I',
  shot_type: 'full',
  target_distance: 150,
  carry_distance: 145,
  outcome: 'pure',
  ball_flight: 'straight',
  self_rating: 4,
  tempo: 4,
  contact: 4,
  notes: null,
  video_uri: null,
};

test('great swing produces a mental-cue suggestion', () => {
  const out = suggestFeedback(baseSwing, []);
  const hasMental = out.some((o) => o.focus === 'mental');
  assert.equal(hasMental, true);
});

test('slice produces face-focused feedback with a drill', () => {
  const swing = { ...baseSwing, ball_flight: 'slice', outcome: 'push', self_rating: 2 };
  const out = suggestFeedback(swing, []);
  const face = out.find((o) => o.focus === 'face');
  assert.ok(face, 'expected face feedback');
  assert.match(face.text.toLowerCase(), /slice|face/);
});

test('thin strike suggests a contact drill', () => {
  const swing = { ...baseSwing, outcome: 'thin', contact: 2, self_rating: 2 };
  const out = suggestFeedback(swing, []);
  const contact = out.find((o) => o.focus === 'contact');
  assert.ok(contact, 'expected contact feedback');
  assert.ok(contact.drillName, 'should recommend a drill');
});

test('repeated same flight over recent swings is flagged as a trend', () => {
  const current = { ...baseSwing, ball_flight: 'slice', outcome: 'pure' };
  const recent = [
    { ...baseSwing, id: 'b', ball_flight: 'slice', outcome: 'pure' },
    { ...baseSwing, id: 'c', ball_flight: 'slice', outcome: 'thin' },
    { ...baseSwing, id: 'd', ball_flight: 'slice', outcome: 'pure' },
  ];
  const out = suggestFeedback(current, recent);
  const trend = out.find((o) => o.text.includes('SLICE'));
  assert.ok(trend, 'expected trend feedback');
});

test('rough trend (low ratings) suggests reset and mental drill', () => {
  const current = { ...baseSwing, self_rating: 1, contact: 1, tempo: 2, outcome: 'thin' };
  const recent = [
    { ...baseSwing, id: 'b', self_rating: 2, outcome: 'pure', ball_flight: 'draw' },
    { ...baseSwing, id: 'c', self_rating: 1, outcome: 'fat', ball_flight: 'straight' },
    { ...baseSwing, id: 'd', self_rating: 2, outcome: 'thin', ball_flight: 'fade' },
  ];
  const out = suggestFeedback(current, recent);
  const mental = out.find((o) => o.focus === 'mental');
  assert.ok(mental, 'expected mental reset cue');
});

test('intentional draw/fade does not produce a flight remedial', () => {
  const swing = { ...baseSwing, ball_flight: 'draw' };
  const out = suggestFeedback(swing, []);
  const faceItems = out.filter((o) => o.focus === 'face' && o.text.toLowerCase().includes('grip'));
  assert.equal(faceItems.length, 0);
});

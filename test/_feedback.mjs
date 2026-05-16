// Plain-JS mirror of src/lib/feedback.ts so node --test can exercise the
// pure heuristic logic without a TS toolchain. Keep in sync with the TS
// source — both files are simple enough that a behavior change is obvious.

export function suggestFeedback(swing, recent) {
  const out = [];

  out.push(...flightFeedback(swing.outcome, swing.ball_flight));

  if (swing.contact <= 2) {
    out.push({
      text: 'Contact felt off — focus on a steady head and centered strike.',
      drillName: 'Towel under armpit',
      focus: 'contact',
    });
  }

  if (swing.tempo <= 2) {
    out.push({
      text: 'Tempo was rushed. Slow the transition and let the club fall.',
      drillName: 'Pause at the top',
      focus: 'tempo',
    });
  }

  const trend = analyzeTrend(swing, recent);
  if (trend) out.push(trend);

  if (swing.self_rating >= 4 && swing.contact >= 4 && swing.tempo >= 4) {
    out.push({
      text: 'Great swing — bottle the feeling. Replay it mentally before the next one.',
      focus: 'mental',
    });
  }

  return dedupe(out);
}

function flightFeedback(outcome, flight) {
  const out = [];

  switch (outcome) {
    case 'thin':
      out.push({
        text: 'Thin strike — likely standing up through impact. Keep chest covering the ball.',
        drillName: 'Towel under armpit',
        focus: 'contact',
      });
      break;
    case 'fat':
      out.push({
        text: 'Hit it fat — weight may be hanging back. Get pressure into the lead side earlier.',
        drillName: 'Feet-together swings',
        focus: 'contact',
      });
      break;
    case 'toe':
      out.push({
        text: 'Toe strike — stand a touch closer or extend through impact.',
        drillName: 'Gate drill',
        focus: 'path',
      });
      break;
    case 'heel':
      out.push({
        text: 'Heel strike — early extension or hands too close. Maintain posture.',
        drillName: 'Gate drill',
        focus: 'path',
      });
      break;
    case 'pull':
      out.push({
        text: 'Pulled it — path going left. Feel the trail shoulder working down, not out.',
        drillName: 'Gate drill',
        focus: 'path',
      });
      break;
    case 'push':
      out.push({
        text: 'Pushed it — path going right. Check setup alignment and rotate through.',
        drillName: 'Gate drill',
        focus: 'path',
      });
      break;
  }

  switch (flight) {
    case 'slice':
      out.push({
        text: 'Slice shape — face open relative to path. Strengthen lead-hand grip slightly.',
        drillName: 'Split-grip swings',
        focus: 'face',
      });
      break;
    case 'hook':
      out.push({
        text: 'Hook shape — face closed at impact. Hold off rotation through the strike.',
        drillName: 'Split-grip swings',
        focus: 'face',
      });
      break;
    case 'fade':
    case 'draw':
      break;
    case 'straight':
      out.push({
        text: 'Straight ball flight — face and path matched up. Keep that grip pressure.',
        focus: 'face',
      });
      break;
  }

  return out;
}

function analyzeTrend(current, recent) {
  const sameClub = recent.filter((s) => s.id !== current.id && s.club === current.club);
  if (sameClub.length < 3) return null;

  const last3 = sameClub.slice(0, 3);
  const avgRating = last3.reduce((sum, s) => sum + s.self_rating, 0) / last3.length;
  const repeatedFlight =
    last3.every((s) => s.ball_flight === current.ball_flight) &&
    current.ball_flight !== 'straight';

  if (repeatedFlight) {
    return {
      text: `${current.ball_flight.toUpperCase()} shape is repeating with your ${current.club}. Treat it as the shot — own it, or do a path/face drill.`,
      drillName:
        current.ball_flight === 'slice' || current.ball_flight === 'hook'
          ? 'Split-grip swings'
          : 'Gate drill',
      focus: 'face',
    };
  }

  if (avgRating < 2.5) {
    return {
      text: `Last few ${current.club} swings have been rough. Step off, reset breathing, restart with a half-swing.`,
      drillName: 'One-breath routine',
      focus: 'mental',
    };
  }

  return null;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    out.push(item);
  }
  return out;
}

import type { Swing } from '../db/types';

export type ClubStats = {
  club: string;
  count: number;
  avgRating: number;
  avgContact: number;
  avgTempo: number;
  avgCarry: number | null;
  carrySamples: number;
  pureRate: number; // share of swings rated 4+
};

export function clubStats(swings: Swing[]): ClubStats[] {
  const byClub = new Map<string, Swing[]>();
  for (const s of swings) {
    const arr = byClub.get(s.club) ?? [];
    arr.push(s);
    byClub.set(s.club, arr);
  }
  const out: ClubStats[] = [];
  for (const [club, list] of byClub) {
    const ratings = list.map((s) => s.self_rating);
    const contacts = list.map((s) => s.contact);
    const tempos = list.map((s) => s.tempo);
    const carries = list
      .map((s) => s.carry_distance)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    out.push({
      club,
      count: list.length,
      avgRating: avg(ratings),
      avgContact: avg(contacts),
      avgTempo: avg(tempos),
      avgCarry: carries.length ? avg(carries) : null,
      carrySamples: carries.length,
      pureRate: list.filter((s) => s.self_rating >= 4).length / list.length,
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

export type StrikeMix = {
  pure: number;
  thin: number;
  fat: number;
  toe: number;
  heel: number;
  pull: number;
  push: number;
};

export function strikeMix(swings: Swing[]): StrikeMix {
  const mix: StrikeMix = { pure: 0, thin: 0, fat: 0, toe: 0, heel: 0, pull: 0, push: 0 };
  for (const s of swings) {
    mix[s.outcome] = (mix[s.outcome] ?? 0) + 1;
  }
  return mix;
}

export type FlightMix = {
  straight: number;
  draw: number;
  fade: number;
  hook: number;
  slice: number;
};

export function flightMix(swings: Swing[]): FlightMix {
  const mix: FlightMix = { straight: 0, draw: 0, fade: 0, hook: 0, slice: 0 };
  for (const s of swings) {
    mix[s.ball_flight] = (mix[s.ball_flight] ?? 0) + 1;
  }
  return mix;
}

export function rollingAverage(swings: Swing[], windowSize = 10): number[] {
  // expects swings in chronological order (oldest first)
  const out: number[] = [];
  for (let i = 0; i < swings.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = swings.slice(start, i + 1);
    out.push(avg(slice.map((s) => s.self_rating)));
  }
  return out;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

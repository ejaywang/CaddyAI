export type Club =
  | 'Driver'
  | '3W'
  | '5W'
  | 'Hybrid'
  | '3I'
  | '4I'
  | '5I'
  | '6I'
  | '7I'
  | '8I'
  | '9I'
  | 'PW'
  | 'GW'
  | 'SW'
  | 'LW'
  | 'Putter';

export const ALL_CLUBS: Club[] = [
  'Driver', '3W', '5W', 'Hybrid',
  '3I', '4I', '5I', '6I', '7I', '8I', '9I',
  'PW', 'GW', 'SW', 'LW', 'Putter',
];

export type ShotType = 'full' | 'punch' | 'chip' | 'pitch' | 'putt';
export const ALL_SHOT_TYPES: ShotType[] = ['full', 'punch', 'chip', 'pitch', 'putt'];

export type Outcome =
  | 'pure'
  | 'thin'
  | 'fat'
  | 'toe'
  | 'heel'
  | 'pull'
  | 'push';
export const ALL_OUTCOMES: Outcome[] = ['pure', 'thin', 'fat', 'toe', 'heel', 'pull', 'push'];

export type BallFlight = 'straight' | 'draw' | 'fade' | 'hook' | 'slice';
export const ALL_BALL_FLIGHTS: BallFlight[] = ['straight', 'draw', 'fade', 'hook', 'slice'];

export type Session = {
  id: string;
  started_at: number;
  ended_at: number | null;
  location: string | null;
  notes: string | null;
};

export type Swing = {
  id: string;
  session_id: string | null;
  created_at: number;
  club: Club;
  shot_type: ShotType;
  target_distance: number | null;
  carry_distance: number | null;
  outcome: Outcome;
  ball_flight: BallFlight;
  self_rating: number; // 1-5
  tempo: number; // 1-5
  contact: number; // 1-5
  notes: string | null;
  video_uri: string | null;
};

export type Feedback = {
  id: string;
  swing_id: string;
  created_at: number;
  source: 'auto' | 'self' | 'coach';
  text: string;
};

export type Drill = {
  id: string;
  name: string;
  focus: 'tempo' | 'contact' | 'path' | 'face' | 'mental';
  description: string;
};

export type DrillCompletion = {
  id: string;
  drill_id: string;
  completed_at: number;
  notes: string | null;
};

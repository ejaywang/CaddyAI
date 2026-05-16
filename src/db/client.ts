import * as SQLite from 'expo-sqlite';
import type {
  Drill,
  DrillCompletion,
  Feedback,
  Session,
  Swing,
} from './types';

const DB_NAME = 'caddyai.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`PRAGMA journal_mode = WAL;`);
      await migrate(db);
      await seedDrillsIfEmpty(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      location TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS swings (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      created_at INTEGER NOT NULL,
      club TEXT NOT NULL,
      shot_type TEXT NOT NULL,
      target_distance INTEGER,
      carry_distance INTEGER,
      outcome TEXT NOT NULL,
      ball_flight TEXT NOT NULL,
      self_rating INTEGER NOT NULL,
      tempo INTEGER NOT NULL,
      contact INTEGER NOT NULL,
      notes TEXT,
      video_uri TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_swings_created_at ON swings(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_swings_club ON swings(club);

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      swing_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      text TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_swing ON feedback(swing_id);

    CREATE TABLE IF NOT EXISTS drills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      focus TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drill_completions (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      notes TEXT
    );
  `);
}

async function seedDrillsIfEmpty(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM drills');
  if (row && row.c > 0) return;

  const seeds: Omit<Drill, 'id'>[] = [
    {
      name: 'Three-count tempo',
      focus: 'tempo',
      description:
        'Count "one-two" on the backswing, "three" through impact. 10 reps with a 7-iron to reset rhythm.',
    },
    {
      name: 'Towel under armpit',
      focus: 'contact',
      description:
        'Pinch a towel between your lead arm and chest. Make half-swings without dropping it to groove connection.',
    },
    {
      name: 'Split-grip swings',
      focus: 'face',
      description:
        'Grip with hands an inch apart. Swing slowly to feel how the lead hand controls face rotation.',
    },
    {
      name: 'Gate drill',
      focus: 'path',
      description:
        'Place two tees just wider than the clubhead, forming a gate around the ball. Swing through without clipping either tee.',
    },
    {
      name: 'Eyes closed putts',
      focus: 'contact',
      description:
        'Hit 10 lag putts with eyes closed. Calls attention to feel and centered strike.',
    },
    {
      name: 'Pause at the top',
      focus: 'tempo',
      description:
        'Pause for 1 second at the top of the backswing before transitioning down. Forces sequencing.',
    },
    {
      name: 'One-breath routine',
      focus: 'mental',
      description:
        'Before each swing, take one full breath in and out. Anchors focus and resets between shots.',
    },
    {
      name: 'Feet-together swings',
      focus: 'tempo',
      description:
        'Take 8-iron, set feet together, swing 60%. Trains balance and a smoother transition.',
    },
  ];

  for (const drill of seeds) {
    await db.runAsync(
      `INSERT INTO drills (id, name, focus, description) VALUES (?, ?, ?, ?)`,
      [genId(), drill.name, drill.focus, drill.description]
    );
  }
}

export function genId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

// ---------- Sessions ----------

export async function startSession(location?: string): Promise<Session> {
  const db = await getDb();
  const id = genId();
  const started_at = Date.now();
  await db.runAsync(
    `INSERT INTO sessions (id, started_at, ended_at, location, notes) VALUES (?, ?, NULL, ?, NULL)`,
    [id, started_at, location ?? null]
  );
  return { id, started_at, ended_at: null, location: location ?? null, notes: null };
}

export async function endSession(id: string, notes?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sessions SET ended_at = ?, notes = ? WHERE id = ?`,
    [Date.now(), notes ?? null, id]
  );
}

export async function getActiveSession(): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Session>(
    `SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
  );
  return row ?? null;
}

export async function listSessions(limit = 30): Promise<Session[]> {
  const db = await getDb();
  return db.getAllAsync<Session>(
    `SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?`,
    [limit]
  );
}

// ---------- Swings ----------

export async function insertSwing(swing: Omit<Swing, 'id' | 'created_at'>): Promise<Swing> {
  const db = await getDb();
  const id = genId();
  const created_at = Date.now();
  await db.runAsync(
    `INSERT INTO swings (
      id, session_id, created_at, club, shot_type,
      target_distance, carry_distance, outcome, ball_flight,
      self_rating, tempo, contact, notes, video_uri
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      swing.session_id,
      created_at,
      swing.club,
      swing.shot_type,
      swing.target_distance,
      swing.carry_distance,
      swing.outcome,
      swing.ball_flight,
      swing.self_rating,
      swing.tempo,
      swing.contact,
      swing.notes,
      swing.video_uri,
    ]
  );
  return { id, created_at, ...swing };
}

export async function listSwings(limit = 50): Promise<Swing[]> {
  const db = await getDb();
  return db.getAllAsync<Swing>(
    `SELECT * FROM swings ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function getSwing(id: string): Promise<Swing | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Swing>(`SELECT * FROM swings WHERE id = ?`, [id]);
  return row ?? null;
}

export async function recentSwingsByClub(club: string, limit = 10): Promise<Swing[]> {
  const db = await getDb();
  return db.getAllAsync<Swing>(
    `SELECT * FROM swings WHERE club = ? ORDER BY created_at DESC LIMIT ?`,
    [club, limit]
  );
}

export async function deleteSwing(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM feedback WHERE swing_id = ?`, [id]);
  await db.runAsync(`DELETE FROM swings WHERE id = ?`, [id]);
}

// ---------- Feedback ----------

export async function insertFeedback(f: Omit<Feedback, 'id' | 'created_at'>): Promise<Feedback> {
  const db = await getDb();
  const id = genId();
  const created_at = Date.now();
  await db.runAsync(
    `INSERT INTO feedback (id, swing_id, created_at, source, text) VALUES (?, ?, ?, ?, ?)`,
    [id, f.swing_id, created_at, f.source, f.text]
  );
  return { id, created_at, ...f };
}

export async function listFeedbackForSwing(swing_id: string): Promise<Feedback[]> {
  const db = await getDb();
  return db.getAllAsync<Feedback>(
    `SELECT * FROM feedback WHERE swing_id = ? ORDER BY created_at ASC`,
    [swing_id]
  );
}

// ---------- Drills ----------

export async function listDrills(): Promise<Drill[]> {
  const db = await getDb();
  return db.getAllAsync<Drill>(`SELECT * FROM drills ORDER BY focus, name`);
}

export async function getDrill(id: string): Promise<Drill | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Drill>(`SELECT * FROM drills WHERE id = ?`, [id]);
  return row ?? null;
}

export async function findDrillByName(name: string): Promise<Drill | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Drill>(`SELECT * FROM drills WHERE name = ?`, [name]);
  return row ?? null;
}

export async function completeDrill(drill_id: string, notes?: string): Promise<DrillCompletion> {
  const db = await getDb();
  const id = genId();
  const completed_at = Date.now();
  await db.runAsync(
    `INSERT INTO drill_completions (id, drill_id, completed_at, notes) VALUES (?, ?, ?, ?)`,
    [id, drill_id, completed_at, notes ?? null]
  );
  return { id, drill_id, completed_at, notes: notes ?? null };
}

export async function listDrillCompletions(limit = 50): Promise<DrillCompletion[]> {
  const db = await getDb();
  return db.getAllAsync<DrillCompletion>(
    `SELECT * FROM drill_completions ORDER BY completed_at DESC LIMIT ?`,
    [limit]
  );
}

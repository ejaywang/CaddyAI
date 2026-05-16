// CaddyAI - Snack single-file build
// Source of truth lives in the multi-file repo; this is a flattened
// version that fits Snack's single-entrypoint model.

import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ---------- theme ----------
const C = {
  bg: '#0B1A14',
  surface: '#13261E',
  border: '#26473A',
  text: '#E8F2EC',
  dim: '#8FA89B',
  primary: '#4ADE80',
  warn: '#E9A23B',
  bad: '#E5715C',
};

// ---------- domain ----------
const CLUBS = ['Driver','3W','5W','Hybrid','3I','4I','5I','6I','7I','8I','9I','PW','GW','SW','LW','Putter'];
const OUTCOMES = ['pure','thin','fat','toe','heel','pull','push'];
const FLIGHTS = ['straight','draw','fade','hook','slice'];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------- DB ----------
let _db = null;
async function db() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('caddyai.db');
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS swings (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      club TEXT NOT NULL,
      outcome TEXT NOT NULL,
      ball_flight TEXT NOT NULL,
      self_rating INTEGER NOT NULL,
      tempo INTEGER NOT NULL,
      contact INTEGER NOT NULL,
      carry_distance INTEGER,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      swing_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      text TEXT NOT NULL
    );
  `);
  return _db;
}

async function insertSwing(s) {
  const d = await db();
  const id = genId();
  const created_at = Date.now();
  await d.runAsync(
    `INSERT INTO swings (id, created_at, club, outcome, ball_flight, self_rating, tempo, contact, carry_distance, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, created_at, s.club, s.outcome, s.ball_flight, s.self_rating, s.tempo, s.contact, s.carry_distance, s.notes]
  );
  return { id, created_at, ...s };
}

async function listSwings(limit = 50) {
  const d = await db();
  return d.getAllAsync(`SELECT * FROM swings ORDER BY created_at DESC LIMIT ?`, [limit]);
}

async function recentByClub(club, limit = 10) {
  const d = await db();
  return d.getAllAsync(`SELECT * FROM swings WHERE club = ? ORDER BY created_at DESC LIMIT ?`, [club, limit]);
}

async function listFeedback(swing_id) {
  const d = await db();
  return d.getAllAsync(`SELECT * FROM feedback WHERE swing_id = ? ORDER BY created_at`, [swing_id]);
}

async function insertFeedback(f) {
  const d = await db();
  const id = genId();
  const created_at = Date.now();
  await d.runAsync(
    `INSERT INTO feedback (id, swing_id, created_at, source, text) VALUES (?, ?, ?, ?, ?)`,
    [id, f.swing_id, created_at, f.source, f.text]
  );
  return { id, created_at, ...f };
}

// ---------- feedback engine ----------
function suggestFeedback(swing, recent) {
  const out = [];
  switch (swing.outcome) {
    case 'thin': out.push('Thin strike — cover the ball with your chest through impact. Drill: towel under armpit.'); break;
    case 'fat': out.push('Fat strike — shift pressure to your lead side earlier. Drill: feet-together swings.'); break;
    case 'toe': out.push('Toe strike — stand a touch closer, extend through. Drill: gate drill.'); break;
    case 'heel': out.push('Heel strike — maintain posture, avoid early extension. Drill: gate drill.'); break;
    case 'pull': out.push('Pulled it — trail shoulder going out. Drill: gate drill.'); break;
    case 'push': out.push('Pushed it — check alignment, rotate through. Drill: gate drill.'); break;
  }
  if (swing.ball_flight === 'slice') out.push('Slice — face open to path. Strengthen lead-hand grip. Drill: split-grip swings.');
  if (swing.ball_flight === 'hook') out.push('Hook — face closed at impact. Hold off rotation. Drill: split-grip swings.');
  if (swing.ball_flight === 'straight') out.push('Straight flight — face and path matched. Bottle this grip pressure.');
  if (swing.contact <= 2) out.push('Contact felt off — steady head, centered strike. Drill: towel under armpit.');
  if (swing.tempo <= 2) out.push('Tempo rushed — slow the transition, let the club fall. Drill: pause at the top.');

  const sameClub = recent.filter((r) => r.id !== swing.id && r.club === swing.club);
  if (sameClub.length >= 3) {
    const last3 = sameClub.slice(0, 3);
    const repeated = last3.every((r) => r.ball_flight === swing.ball_flight) && swing.ball_flight !== 'straight';
    const avg = last3.reduce((a, b) => a + b.self_rating, 0) / 3;
    if (repeated) {
      out.push(`${swing.ball_flight.toUpperCase()} shape is repeating with your ${swing.club}. Own it or do a path/face drill.`);
    } else if (avg < 2.5) {
      out.push(`Last few ${swing.club} swings rough. Step off, reset breathing, half-swing restart.`);
    }
  }
  if (swing.self_rating >= 4 && swing.contact >= 4 && swing.tempo >= 4) {
    out.push('Great swing — replay it mentally before the next one.');
  }
  return [...new Set(out)];
}

// ---------- UI helpers ----------
function Chip({ label, selected, onPress, tone = 'default' }) {
  const c = tone === 'good' ? C.primary : tone === 'bad' ? C.bad : tone === 'warn' ? C.warn : C.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? c : C.border,
          backgroundColor: selected ? c + '22' : C.surface,
        },
      ]}
    >
      <Text style={{ color: selected ? c : C.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Stars({ value, onChange, label }) {
  return (
    <View style={styles.starsRow}>
      <Text style={{ color: C.dim, fontSize: 13 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
            <View
              style={{
                width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                borderColor: n <= value ? C.primary : C.border,
                backgroundColor: n <= value ? C.primary : 'transparent',
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- app ----------
export default function App() {
  const [tab, setTab] = useState('feed');
  const [swings, setSwings] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [expandedFb, setExpandedFb] = useState([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listSwings(100);
    setSwings(rows);
  }, []);

  useEffect(() => {
    (async () => {
      await db();
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const onSaved = async () => {
    await refresh();
    setTab('feed');
  };

  const openSwing = async (s) => {
    if (expanded === s.id) {
      setExpanded(null);
      setExpandedFb([]);
      return;
    }
    setExpanded(s.id);
    setExpandedFb(await listFeedback(s.id));
  };

  if (!ready) {
    return <View style={styles.loading}><StatusBar style="light" /></View>;
  }

  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>CaddyAI</Text>
        <View style={styles.tabs}>
          <TabBtn label="Feed" active={tab === 'feed'} onPress={() => setTab('feed')} />
          <TabBtn label="Log" active={tab === 'log'} onPress={() => setTab('log')} />
        </View>
      </View>
      {tab === 'feed' ? (
        <FeedView swings={swings} expanded={expanded} expandedFb={expandedFb} onOpen={openSwing} />
      ) : (
        <LogView onSaved={onSaved} />
      )}
    </View>
  );
}

function TabBtn({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={{ color: active ? '#03130B' : C.dim, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function FeedView({ swings, expanded, expandedFb, onOpen }) {
  const today = swings.filter((s) => isToday(s.created_at));
  const pure = today.filter((s) => s.outcome === 'pure').length;
  const pureRate = today.length ? Math.round((pure / today.length) * 100) : 0;
  const avgQ = today.length ? (today.reduce((a, b) => a + b.self_rating, 0) / today.length).toFixed(1) : '—';

  return (
    <FlatList
      data={swings}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.subtitle}>{today.length} swing{today.length === 1 ? '' : 's'} today</Text>
          <View style={styles.statsRow}>
            <Tile label="Quality" value={String(avgQ)} hint="today /5" />
            <Tile label="Pure rate" value={today.length ? pureRate + '%' : '—'} hint={today.length ? pure + '/' + today.length : 'no data'} />
          </View>
          <Text style={styles.section}>Recent swings</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={{ color: C.text, fontWeight: '600' }}>No swings yet.</Text>
          <Text style={{ color: C.dim, marginTop: 8 }}>Tap “Log” to record your first one. The feedback engine will give you a practice cue.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <SwingItem swing={item} expanded={expanded === item.id} feedback={expanded === item.id ? expandedFb : []} onPress={() => onOpen(item)} />
      )}
    />
  );
}

function SwingItem({ swing, expanded, feedback, onPress }) {
  const flightTone = ['straight','draw','fade'].includes(swing.ball_flight) ? C.primary : C.warn;
  const outcomeTone = swing.outcome === 'pure' ? C.primary : C.warn;
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.club}>{swing.club}</Text>
        <Text style={{ color: C.dim, fontSize: 12 }}>{formatTime(swing.created_at)}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
        <Tag label={swing.outcome.toUpperCase()} color={outcomeTone} />
        <Tag label={swing.ball_flight.toUpperCase()} color={flightTone} />
        {swing.carry_distance ? <Tag label={swing.carry_distance + 'y'} color={C.dim} /> : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Metric label="Quality" value={swing.self_rating} />
        <Metric label="Contact" value={swing.contact} />
        <Metric label="Tempo" value={swing.tempo} />
      </View>
      {swing.notes ? <Text style={styles.notes}>{swing.notes}</Text> : null}
      {expanded ? (
        <View style={styles.fbBox}>
          {feedback.length === 0 ? (
            <Text style={{ color: C.dim, fontStyle: 'italic' }}>No feedback yet.</Text>
          ) : feedback.map((f) => (
            <View key={f.id} style={styles.fbItem}>
              <Text style={{ color: C.primary, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{f.source.toUpperCase()}</Text>
              <Text style={{ color: C.text, fontSize: 13, lineHeight: 18 }}>{f.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function LogView({ onSaved }) {
  const [club, setClub] = useState('7I');
  const [outcome, setOutcome] = useState('pure');
  const [flight, setFlight] = useState('straight');
  const [quality, setQuality] = useState(3);
  const [contact, setContact] = useState(3);
  const [tempo, setTempo] = useState(3);
  const [carry, setCarry] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const swing = await insertSwing({
        club, outcome, ball_flight: flight,
        self_rating: quality, contact, tempo,
        carry_distance: carry ? parseInt(carry, 10) : null,
        notes: notes.trim() || null,
      });
      const recent = await recentByClub(club, 10);
      const fb = suggestFeedback(swing, recent);
      for (const t of fb) {
        await insertFeedback({ swing_id: swing.id, source: 'auto', text: t });
      }
      setQuality(3); setContact(3); setTempo(3); setCarry(''); setNotes('');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Field label="Club">
        <Row>{CLUBS.map((c) => <Chip key={c} label={c} selected={club === c} onPress={() => setClub(c)} />)}</Row>
      </Field>
      <Field label="Strike">
        <Row>{OUTCOMES.map((o) => <Chip key={o} label={o} selected={outcome === o} tone={o === 'pure' ? 'good' : 'warn'} onPress={() => setOutcome(o)} />)}</Row>
      </Field>
      <Field label="Ball flight">
        <Row>{FLIGHTS.map((f) => <Chip key={f} label={f} selected={flight === f} tone={f === 'hook' || f === 'slice' ? 'bad' : 'good'} onPress={() => setFlight(f)} />)}</Row>
      </Field>
      <Field label="Ratings">
        <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16 }}>
          <Stars label="Quality" value={quality} onChange={setQuality} />
          <Stars label="Contact" value={contact} onChange={setContact} />
          <Stars label="Tempo" value={tempo} onChange={setTempo} />
        </View>
      </Field>
      <Field label="Carry distance (yards)">
        <TextInput
          keyboardType="number-pad"
          value={carry}
          onChangeText={(v) => setCarry(v.replace(/[^0-9]/g, ''))}
          placeholder="—"
          placeholderTextColor={C.dim}
          style={styles.input}
        />
      </Field>
      <Field label="Notes">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="What did you feel?"
          placeholderTextColor={C.dim}
          style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
        />
      </Field>
      <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
        <Text style={{ color: '#03130B', fontWeight: '700', fontSize: 15 }}>{saving ? 'Saving…' : 'Save swing'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ children }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>;
}

function Tile({ label, value, hint }) {
  return (
    <View style={styles.tile}>
      <Text style={{ color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', marginTop: 8 }}>{value}</Text>
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{hint}</Text>
    </View>
  );
}

function Tag({ label, color }) {
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: color + '66', backgroundColor: color + '14', marginRight: 8 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{value}/5</Text>
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function isToday(ts) {
  const d = new Date(ts), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg, paddingTop: 50 },
  loading: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { color: C.text, fontSize: 24, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginTop: 12, gap: 8 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tabBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  subtitle: { color: C.dim, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  tile: { flex: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  section: { color: C.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  empty: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24 },
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  club: { color: C.text, fontSize: 18, fontWeight: '700' },
  notes: { color: C.dim, fontSize: 13, marginTop: 12, fontStyle: 'italic' },
  fbBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  fbItem: { backgroundColor: C.bg, borderRadius: 8, padding: 12, marginBottom: 8 },
  fieldLabel: { color: C.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  input: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.text, padding: 12, fontSize: 14 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
});

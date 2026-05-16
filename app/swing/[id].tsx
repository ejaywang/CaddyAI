import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { SwingCard } from '../../src/components/SwingCard';
import {
  deleteSwing,
  findDrillByName,
  getSwing,
  insertFeedback,
  listFeedbackForSwing,
} from '../../src/db/client';
import type { Feedback, Swing } from '../../src/db/types';
import { colors, radius, spacing } from '../../src/theme';

export default function SwingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [swing, setSwing] = useState<Swing | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      const s = await getSwing(id);
      const f = await listFeedbackForSwing(id);
      if (cancelled) return;
      setSwing(s);
      setFeedback(f);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const addNote = async () => {
    if (!swing || !note.trim()) return;
    const f = await insertFeedback({
      swing_id: swing.id,
      source: 'self',
      text: note.trim(),
    });
    setFeedback((prev) => [...prev, f]);
    setNote('');
  };

  const onDelete = () => {
    if (!swing) return;
    Alert.alert('Delete swing', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSwing(swing.id);
          router.back();
        },
      },
    ]);
  };

  const tryOpenDrill = async (drillName: string) => {
    const drill = await findDrillByName(drillName);
    if (drill) router.push(`/drill/${drill.id}`);
  };

  if (!swing) {
    return (
      <View style={[styles.container, { padding: spacing.lg }]}>
        <Text style={{ color: colors.textDim }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
    >
      <SwingCard swing={swing} />

      <Text style={styles.sectionTitle}>Feedback</Text>
      {feedback.length === 0 ? (
        <Text style={styles.empty}>No feedback yet.</Text>
      ) : (
        feedback.map((f) => (
          <FeedbackItem key={f.id} item={f} onDrillPress={tryOpenDrill} />
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Add a note</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="What did you take away from this swing?"
        placeholderTextColor={colors.textDim}
        multiline
        style={styles.input}
      />
      <View style={{ height: spacing.sm }} />
      <Button label="Add note" onPress={addNote} disabled={!note.trim()} fullWidth />

      <View style={{ height: spacing.xl }} />
      <Button label="Delete swing" variant="danger" onPress={onDelete} fullWidth />
    </ScrollView>
  );
}

function FeedbackItem({
  item,
  onDrillPress,
}: {
  item: Feedback;
  onDrillPress: (name: string) => void;
}) {
  const drillMatch = item.text.match(/Drill: ([^→\n]+)$/);
  const drillName = drillMatch?.[1]?.trim();
  const baseText = drillName ? item.text.replace(/→ Drill: [^→\n]+$/, '').trim() : item.text;

  const sourceColor =
    item.source === 'auto' ? colors.primary : item.source === 'coach' ? colors.accent : colors.textDim;

  return (
    <View style={styles.feedback}>
      <View style={styles.feedbackHeader}>
        <Text style={[styles.feedbackSource, { color: sourceColor }]}>
          {item.source.toUpperCase()}
        </Text>
        <Text style={styles.feedbackTime}>{formatTime(item.created_at)}</Text>
      </View>
      <Text style={styles.feedbackText}>{baseText}</Text>
      {drillName ? (
        <Text style={styles.drillLink} onPress={() => onDrillPress(drillName)}>
          → Drill: {drillName}
        </Text>
      ) : null}
    </View>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  empty: { color: colors.textDim, fontStyle: 'italic' },
  feedback: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  feedbackSource: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  feedbackTime: { color: colors.textDim, fontSize: 11 },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  drillLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

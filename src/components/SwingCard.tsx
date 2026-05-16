import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Swing } from '../db/types';
import { colors, radius, spacing } from '../theme';

type Props = {
  swing: Swing;
  onPress?: () => void;
};

export function SwingCard({ swing, onPress }: Props) {
  const flightTone =
    swing.ball_flight === 'straight' || swing.ball_flight === 'draw' || swing.ball_flight === 'fade'
      ? colors.good
      : colors.warning;
  const outcomeTone = swing.outcome === 'pure' ? colors.good : colors.warning;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.club}>{swing.club}</Text>
        <Text style={styles.time}>{formatTime(swing.created_at)}</Text>
      </View>

      <View style={styles.row}>
        <Tag label={swing.outcome.toUpperCase()} color={outcomeTone} />
        <Tag label={swing.ball_flight.toUpperCase()} color={flightTone} />
        {swing.carry_distance ? (
          <Tag label={`${swing.carry_distance}y`} color={colors.textDim} />
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Quality" value={swing.self_rating} />
        <Metric label="Contact" value={swing.contact} />
        <Metric label="Tempo" value={swing.tempo} />
      </View>

      {swing.notes ? (
        <Text numberOfLines={2} style={styles.notes}>
          {swing.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color + '66', backgroundColor: color + '14' }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}/5</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isToday) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  club: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  time: {
    color: colors.textDim,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  metricLabel: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  notes: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
});

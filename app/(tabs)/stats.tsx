import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatTile } from '../../src/components/StatTile';
import { listSwings } from '../../src/db/client';
import type { Swing } from '../../src/db/types';
import { clubStats, flightMix, strikeMix } from '../../src/lib/stats';
import { colors, radius, spacing } from '../../src/theme';

export default function StatsScreen() {
  const [swings, setSwings] = useState<Swing[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listSwings(500).then((rows) => {
        if (!cancelled) setSwings(rows);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const sMix = strikeMix(swings);
  const fMix = flightMix(swings);
  const clubs = clubStats(swings);
  const total = swings.length;

  const pureRate = total ? Math.round((sMix.pure / total) * 100) : 0;
  const straightRate = total
    ? Math.round(((fMix.straight + fMix.draw + fMix.fade) / total) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.h1}>Progress</Text>
        <Text style={styles.subtitle}>{total} swing{total === 1 ? '' : 's'} tracked</Text>

        <View style={styles.row}>
          <StatTile
            label="Pure rate"
            value={total ? `${pureRate}%` : '—'}
            hint="strikes called pure"
            tone={pureRate >= 50 ? 'good' : 'default'}
          />
          <View style={{ width: spacing.md }} />
          <StatTile
            label="On-line"
            value={total ? `${straightRate}%` : '—'}
            hint="not hook/slice"
            tone={straightRate >= 60 ? 'good' : 'default'}
          />
        </View>

        <View style={{ height: spacing.xl }} />
        <Text style={styles.section}>Strike mix</Text>
        <DistroBar
          items={[
            { label: 'Pure', count: sMix.pure, color: colors.good },
            { label: 'Thin', count: sMix.thin, color: colors.warning },
            { label: 'Fat', count: sMix.fat, color: colors.warning },
            { label: 'Toe', count: sMix.toe, color: colors.danger },
            { label: 'Heel', count: sMix.heel, color: colors.danger },
            { label: 'Pull', count: sMix.pull, color: colors.warning },
            { label: 'Push', count: sMix.push, color: colors.warning },
          ]}
          total={total}
        />

        <View style={{ height: spacing.xl }} />
        <Text style={styles.section}>Ball flight mix</Text>
        <DistroBar
          items={[
            { label: 'Straight', count: fMix.straight, color: colors.good },
            { label: 'Draw', count: fMix.draw, color: colors.good },
            { label: 'Fade', count: fMix.fade, color: colors.good },
            { label: 'Hook', count: fMix.hook, color: colors.danger },
            { label: 'Slice', count: fMix.slice, color: colors.danger },
          ]}
          total={total}
        />

        <View style={{ height: spacing.xl }} />
        <Text style={styles.section}>By club</Text>
        {clubs.length === 0 ? (
          <Text style={styles.empty}>No swings logged yet.</Text>
        ) : (
          clubs.map((c) => (
            <View key={c.club} style={styles.clubRow}>
              <View style={styles.clubHeader}>
                <Text style={styles.clubName}>{c.club}</Text>
                <Text style={styles.clubCount}>{c.count} swing{c.count === 1 ? '' : 's'}</Text>
              </View>
              <View style={styles.clubMetrics}>
                <ClubMetric label="Quality" value={c.avgRating.toFixed(1)} />
                <ClubMetric label="Contact" value={c.avgContact.toFixed(1)} />
                <ClubMetric label="Tempo" value={c.avgTempo.toFixed(1)} />
                <ClubMetric
                  label="Carry"
                  value={c.avgCarry ? `${Math.round(c.avgCarry)}y` : '—'}
                />
                <ClubMetric
                  label="Pure"
                  value={`${Math.round(c.pureRate * 100)}%`}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DistroBar({
  items,
  total,
}: {
  items: { label: string; count: number; color: string }[];
  total: number;
}) {
  if (total === 0) {
    return <Text style={styles.empty}>No data yet.</Text>;
  }
  return (
    <View>
      <View style={styles.bar}>
        {items.map((it) => {
          const w = (it.count / total) * 100;
          if (w === 0) return null;
          return (
            <View
              key={it.label}
              style={{ width: `${w}%`, backgroundColor: it.color, height: 14 }}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {items.map((it) => (
          <View key={it.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: it.color }]} />
            <Text style={styles.legendLabel}>
              {it.label} {it.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ClubMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.clubMetricValue}>{value}</Text>
      <Text style={styles.clubMetricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 32, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textDim, marginTop: 4, marginBottom: spacing.lg },
  section: {
    color: colors.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row' },
  empty: {
    color: colors.textDim,
    fontStyle: 'italic',
  },
  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
    marginBottom: spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: { color: colors.text, fontSize: 12 },
  clubRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  clubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  clubName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  clubCount: { color: colors.textDim, fontSize: 12 },
  clubMetrics: { flexDirection: 'row' },
  clubMetricValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  clubMetricLabel: { color: colors.textDim, fontSize: 11, marginTop: 2 },
});

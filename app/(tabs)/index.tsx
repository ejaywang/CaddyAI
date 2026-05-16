import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { StatTile } from '../../src/components/StatTile';
import { SwingCard } from '../../src/components/SwingCard';
import { listSwings } from '../../src/db/client';
import type { Swing } from '../../src/db/types';
import { strikeMix } from '../../src/lib/stats';
import { colors, spacing } from '../../src/theme';

export default function FeedScreen() {
  const [swings, setSwings] = useState<Swing[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listSwings(60).then((rows) => {
        if (!cancelled) setSwings(rows);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const today = swings.filter((s) => isToday(s.created_at));
  const todayMix = strikeMix(today);
  const pureRate = today.length
    ? Math.round((todayMix.pure / today.length) * 100)
    : 0;
  const avgQuality = today.length
    ? (today.reduce((sum, s) => sum + s.self_rating, 0) / today.length).toFixed(1)
    : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={swings}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.h1}>Practice</Text>
            <Text style={styles.subtitle}>
              {today.length} swing{today.length === 1 ? '' : 's'} logged today
            </Text>

            <View style={styles.statsRow}>
              <StatTile
                label="Quality"
                value={String(avgQuality)}
                hint="today, /5"
                tone={typeof avgQuality === 'string' && parseFloat(avgQuality) >= 3.5 ? 'good' : 'default'}
              />
              <View style={{ width: spacing.md }} />
              <StatTile
                label="Pure rate"
                value={today.length ? `${pureRate}%` : '—'}
                hint={today.length ? `${todayMix.pure}/${today.length} pure` : 'no data'}
                tone={pureRate >= 50 ? 'good' : 'default'}
              />
            </View>

            <View style={{ height: spacing.lg }} />
            <Text style={styles.section}>Recent swings</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SwingCard swing={item} onPress={() => router.push(`/swing/${item.id}`)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No swings yet.</Text>
            <Text style={styles.emptyBody}>
              Tap “Log swing” to record one. Each entry generates practice feedback you can act on.
            </Text>
          </View>
        }
      />

      <View style={styles.fab}>
        <Button label="Log swing" onPress={() => router.push('/swing/log')} fullWidth />
      </View>
    </SafeAreaView>
  );
}

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  h1: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    color: colors.textDim,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
  },
  section: {
    color: colors.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  emptyBody: {
    color: colors.textDim,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
});

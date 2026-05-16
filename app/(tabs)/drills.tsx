import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listDrillCompletions, listDrills } from '../../src/db/client';
import type { Drill, DrillCompletion } from '../../src/db/types';
import { colors, radius, spacing } from '../../src/theme';

const FOCUS_COLORS: Record<Drill['focus'], string> = {
  tempo: '#7BC8F6',
  contact: '#F5C451',
  path: '#B084F0',
  face: '#E5715C',
  mental: '#4ADE80',
};

export default function DrillsScreen() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [completions, setCompletions] = useState<DrillCompletion[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listDrills(), listDrillCompletions(200)]).then(([d, c]) => {
        if (cancelled) return;
        setDrills(d);
        setCompletions(c);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const completionsByDrill = new Map<string, number>();
  for (const c of completions) {
    completionsByDrill.set(c.drill_id, (completionsByDrill.get(c.drill_id) ?? 0) + 1);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={drills}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        ListHeaderComponent={
          <View>
            <Text style={styles.h1}>Drills</Text>
            <Text style={styles.subtitle}>
              {completions.length} drill{completions.length === 1 ? '' : 's'} completed
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const count = completionsByDrill.get(item.id) ?? 0;
          return (
            <Pressable
              onPress={() => router.push(`/drill/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.focusPill,
                    { backgroundColor: FOCUS_COLORS[item.focus] + '22', borderColor: FOCUS_COLORS[item.focus] },
                  ]}
                >
                  <Text style={[styles.focusText, { color: FOCUS_COLORS[item.focus] }]}>
                    {item.focus.toUpperCase()}
                  </Text>
                </View>
                {count > 0 ? (
                  <Text style={styles.completedCount}>{count}×</Text>
                ) : null}
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 32, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textDim, marginTop: 4, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  focusPill: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  focusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  completedCount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  desc: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
});

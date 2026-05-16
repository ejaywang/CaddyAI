import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { completeDrill, getDrill } from '../../src/db/client';
import type { Drill } from '../../src/db/types';
import { colors, radius, spacing } from '../../src/theme';

export default function DrillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDrill(id).then(setDrill);
  }, [id]);

  const onComplete = async () => {
    if (!drill) return;
    await completeDrill(drill.id, note.trim() || undefined);
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  if (!drill) {
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
      <View style={styles.card}>
        <Text style={styles.focus}>{drill.focus.toUpperCase()}</Text>
        <Text style={styles.name}>{drill.name}</Text>
        <Text style={styles.description}>{drill.description}</Text>
      </View>

      <Text style={styles.sectionTitle}>Mark as done</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional note about how it went…"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        multiline
      />
      <View style={{ height: spacing.md }} />
      <Button
        label={saved ? 'Saved ✓' : 'Complete drill'}
        onPress={onComplete}
        disabled={saved}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  focus: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  description: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
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

import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'bad';
};

export function StatTile({ label, value, hint, tone = 'default' }: Props) {
  const color =
    tone === 'good' ? colors.good : tone === 'bad' ? colors.danger : colors.text;
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});

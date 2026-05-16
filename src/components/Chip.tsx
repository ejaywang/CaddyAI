import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'good' | 'bad' | 'warn';
};

export function Chip({ label, selected, onPress, tone = 'default' }: Props) {
  const toneColor =
    tone === 'good'
      ? colors.good
      : tone === 'bad'
        ? colors.danger
        : tone === 'warn'
          ? colors.warning
          : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? toneColor : colors.border,
          backgroundColor: selected ? toneColor + '22' : colors.surface,
        },
        pressed && onPress && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.label, { color: selected ? toneColor : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});

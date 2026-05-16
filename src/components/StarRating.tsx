import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  max?: number;
};

export function StarRating({ value, onChange, label, max = 5 }: Props) {
  return (
    <View style={styles.row}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.dots}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const filled = n <= value;
          return (
            <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: filled ? colors.primary : 'transparent',
                    borderColor: filled ? colors.primary : colors.border,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.textDim,
    fontSize: 13,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
});

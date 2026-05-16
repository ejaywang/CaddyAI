import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  fullWidth?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, fullWidth }: Props) {
  const style = variantStyle(variant, !!disabled);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        style.container,
        fullWidth && { alignSelf: 'stretch' },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <View>
        <Text style={[styles.label, style.label]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function variantStyle(v: Variant, disabled: boolean) {
  if (disabled) {
    return {
      container: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      label: { color: colors.textDim },
    };
  }
  switch (v) {
    case 'primary':
      return {
        container: { backgroundColor: colors.primary, borderColor: colors.primary },
        label: { color: '#03130B' },
      };
    case 'secondary':
      return {
        container: { backgroundColor: colors.surface, borderColor: colors.border },
        label: { color: colors.text },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent', borderColor: 'transparent' },
        label: { color: colors.primary },
      };
    case 'danger':
      return {
        container: { backgroundColor: 'transparent', borderColor: colors.danger },
        label: { color: colors.danger },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    fontSize: 15,
  },
});

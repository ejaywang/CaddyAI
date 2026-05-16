export const colors = {
  bg: '#0B1A14',
  surface: '#13261E',
  surfaceAlt: '#1B3327',
  border: '#26473A',
  text: '#E8F2EC',
  textDim: '#8FA89B',
  primary: '#4ADE80',
  primaryDim: '#1E4D33',
  accent: '#F5C451',
  danger: '#E5715C',
  warning: '#E9A23B',
  good: '#4ADE80',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const type = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  small: { fontSize: 12, color: colors.textDim },
  mono: { fontSize: 13, color: colors.text, fontFamily: 'Menlo' },
};

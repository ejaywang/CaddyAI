import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { StarRating } from '../../src/components/StarRating';
import { insertFeedback, insertSwing, recentSwingsByClub } from '../../src/db/client';
import {
  ALL_BALL_FLIGHTS,
  ALL_CLUBS,
  ALL_OUTCOMES,
  ALL_SHOT_TYPES,
  type BallFlight,
  type Club,
  type Outcome,
  type ShotType,
} from '../../src/db/types';
import { suggestFeedback } from '../../src/lib/feedback';
import { colors, radius, spacing } from '../../src/theme';

export default function LogSwingScreen() {
  const router = useRouter();
  const [club, setClub] = useState<Club>('7I');
  const [shotType, setShotType] = useState<ShotType>('full');
  const [outcome, setOutcome] = useState<Outcome>('pure');
  const [flight, setFlight] = useState<BallFlight>('straight');
  const [quality, setQuality] = useState(3);
  const [contact, setContact] = useState(3);
  const [tempo, setTempo] = useState(3);
  const [target, setTarget] = useState('');
  const [carry, setCarry] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const swing = await insertSwing({
        session_id: null,
        club,
        shot_type: shotType,
        target_distance: target ? parseInt(target, 10) : null,
        carry_distance: carry ? parseInt(carry, 10) : null,
        outcome,
        ball_flight: flight,
        self_rating: quality,
        tempo,
        contact,
        notes: notes.trim() || null,
        video_uri: null,
      });

      const recent = await recentSwingsByClub(club, 10);
      const suggestions = suggestFeedback(swing, recent);
      for (const s of suggestions) {
        await insertFeedback({
          swing_id: swing.id,
          source: 'auto',
          text: s.drillName ? `${s.text} → Drill: ${s.drillName}` : s.text,
        });
      }

      router.replace(`/swing/${swing.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      <Section title="Club">
        <ChipRow>
          {ALL_CLUBS.map((c) => (
            <Chip key={c} label={c} selected={club === c} onPress={() => setClub(c)} />
          ))}
        </ChipRow>
      </Section>

      <Section title="Shot type">
        <ChipRow>
          {ALL_SHOT_TYPES.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={shotType === s}
              onPress={() => setShotType(s)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title="Strike">
        <ChipRow>
          {ALL_OUTCOMES.map((o) => (
            <Chip
              key={o}
              label={o}
              selected={outcome === o}
              tone={o === 'pure' ? 'good' : 'warn'}
              onPress={() => setOutcome(o)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title="Ball flight">
        <ChipRow>
          {ALL_BALL_FLIGHTS.map((f) => (
            <Chip
              key={f}
              label={f}
              selected={flight === f}
              tone={f === 'hook' || f === 'slice' ? 'bad' : 'good'}
              onPress={() => setFlight(f)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title="Ratings">
        <View style={styles.ratingsBox}>
          <StarRating label="Quality" value={quality} onChange={setQuality} />
          <StarRating label="Contact" value={contact} onChange={setContact} />
          <StarRating label="Tempo" value={tempo} onChange={setTempo} />
        </View>
      </Section>

      <Section title="Distance (yards)">
        <View style={{ flexDirection: 'row' }}>
          <NumberField label="Target" value={target} onChange={setTarget} />
          <View style={{ width: spacing.md }} />
          <NumberField label="Carry" value={carry} onChange={setCarry} />
        </View>
      </Section>

      <Section title="Notes">
        <TextInput
          style={styles.notes}
          placeholder="What did you feel? What were you working on?"
          placeholderTextColor={colors.textDim}
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </Section>

      <View style={{ height: spacing.lg }} />
      <Button label={saving ? 'Saving…' : 'Save swing'} onPress={onSave} disabled={saving} fullWidth />
      <View style={{ height: spacing.sm }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} fullWidth />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
        style={styles.numberInput}
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  ratingsBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  fieldLabel: {
    color: colors.textDim,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  numberInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  notes: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    padding: spacing.md,
    minHeight: 90,
    textAlignVertical: 'top',
  },
});

import { Pressable, View, StyleSheet } from 'react-native';
import { Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { MOODS, type MoodValue } from './moods';

interface MoodPickerProps {
  value: MoodValue | null;
  onSelect: (v: MoodValue) => void;
}

/**
 * The skin-feel diary row: four quiet single-select chips. A subjective
 * wellness check-in (how the user's skin FEELS), stored on-device. No clinical claim.
 */
export function MoodPicker({ value, onSelect }: MoodPickerProps) {
  return (
    <View className="flex-row justify-between">
      {MOODS.map((m) => {
        const active = value === m.value;
        return (
          <Pressable
            key={m.value}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(m.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Caption
              numberOfLines={1}
              style={{ fontSize: 14, color: active ? palette.white : palette.inkSoft }}
            >
              {m.label}
            </Caption>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    height: 48,
    marginHorizontal: 3,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(138,131,120,0.14)',
  },
  chipActive: { backgroundColor: palette.dark, borderColor: palette.dark },
});

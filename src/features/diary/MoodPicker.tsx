import { Pressable, View, StyleSheet } from 'react-native';
import { Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { MOODS, type MoodValue } from './moods';

interface MoodPickerProps {
  value: MoodValue | null;
  onSelect: (v: MoodValue) => void;
}

/**
 * The skin-feel diary row: five drawn faces from "Bad" to "Awesome". A subjective
 * wellness check-in (how the user's skin FEELS), stored on-device. No clinical claim.
 */
export function MoodPicker({ value, onSelect }: MoodPickerProps) {
  return (
    <View className="flex-row justify-between">
      {MOODS.map((m, i) => {
        const active = value === m.value;
        const color = active ? palette.mauve600 : palette.inkSoft;
        return (
          <Pressable
            key={m.value}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(m.value)}
            style={styles.col}
          >
            <View style={[styles.bubble, active && styles.bubbleActive]}>
              <Face idx={i} color={color} />
            </View>
            <Caption
              numberOfLines={1}
              style={{ fontSize: 10, color: active ? palette.mauve600 : palette.inkMuted }}
            >
              {m.label}
            </Caption>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A minimal face whose mouth curves from frown (idx 0) to smile (idx 4). */
function Face({ idx, color, size = 30 }: { idx: number; color: string; size?: number }) {
  const mw = size * 0.34;
  const eye = <View style={{ width: size * 0.09, height: size * 0.09, borderRadius: 99, backgroundColor: color }} />;
  let mouth: React.ReactNode;
  if (idx <= 1) {
    // frown — an upward-opening arc
    mouth = (
      <View
        style={{
          width: mw,
          height: mw * 0.5,
          borderColor: color,
          borderTopWidth: 2,
          borderTopLeftRadius: mw,
          borderTopRightRadius: mw,
        }}
      />
    );
  } else if (idx === 2) {
    mouth = <View style={{ width: mw, height: 2, borderRadius: 2, backgroundColor: color }} />;
  } else {
    // smile — a downward-opening arc
    mouth = (
      <View
        style={{
          width: mw,
          height: mw * 0.5,
          borderColor: color,
          borderBottomWidth: 2,
          borderBottomLeftRadius: mw,
          borderBottomRightRadius: mw,
        }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', gap: size * 0.1 }}>
      <View style={{ flexDirection: 'row', gap: size * 0.2 }}>
        {eye}
        {eye}
      </View>
      {mouth}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, alignItems: 'center', gap: 6 },
  bubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  bubbleActive: {
    backgroundColor: 'rgba(124,77,139,0.12)',
    borderColor: palette.mauve400,
  },
});

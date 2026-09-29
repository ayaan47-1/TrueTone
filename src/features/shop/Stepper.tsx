// src/features/shop/Stepper.tsx
// Quantity stepper from the v3 kit (Stepper3): − value + in a hairline pill.
import { Text, View } from 'react-native';
import { PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { PlusGlyph } from './shop-icons';

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Lowest value the − button reaches (0 lets the bag remove a line). */
  min?: number;
  /** Noun for the accessibility labels, e.g. "Quantity". */
  label: string;
  small?: boolean;
}

export function Stepper({ value, onChange, min = 1, label, small = false }: StepperProps) {
  const size = small ? 28 : 36;
  const noun = label.toLowerCase();
  const button = (minus: boolean) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${minus ? 'Decrease' : 'Increase'} ${noun}`}
      onPress={() => onChange(minus ? Math.max(min, value - 1) : value + 1)}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <PlusGlyph color={palette.ink} size={small ? 10 : 12} minus={minus} />
    </PressableScale>
  );
  return (
    <View
      accessibilityLabel={`${label} ${value}`}
      className="flex-row items-center rounded-full border border-ink-faint/40 bg-white/60 p-0.5"
      style={{ gap: small ? 4 : 10 }}
    >
      {button(true)}
      <Text className="min-w-[16px] text-center font-body-semibold text-[15px] text-ink">{value}</Text>
      {button(false)}
    </View>
  );
}

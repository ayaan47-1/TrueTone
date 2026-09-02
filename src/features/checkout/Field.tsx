// src/features/checkout/Field.tsx
// A themed single-line text input for the checkout SHELL's shipping form. Presentation
// only — plain RN TextInput in the Mist palette. Used for non-sensitive address fields;
// it is NEVER used to collect payment credentials (see CheckoutScreen's payment section,
// which is an explicit non-editable demo).
import { View, TextInput, type TextInputProps } from 'react-native';
import { Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';

interface FieldProps extends TextInputProps {
  label: string;
}

export function Field({ label, ...rest }: FieldProps) {
  return (
    <View className="gap-1.5">
      <Caption className="text-ink-soft">{label}</Caption>
      <TextInput
        placeholderTextColor={palette.inkFaint}
        className="min-h-[48px] rounded-2xl border border-ink-faint/30 bg-white/60 px-4 py-3 font-body text-[15px] text-ink"
        {...rest}
      />
    </View>
  );
}

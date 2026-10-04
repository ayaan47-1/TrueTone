// src/features/checkout/Field.tsx
// A themed single-line text input for the checkout shipping form. It is never used to
// collect payment credentials; Stripe's native PaymentSheet owns those fields.
import { View, TextInput, type TextInputProps } from 'react-native';
import { Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Field({ label, error, testID, ...rest }: FieldProps) {
  return (
    <View className="gap-1.5">
      <Caption className="text-ink-soft">{label}</Caption>
      <TextInput
        testID={testID}
        placeholderTextColor={palette.inkFaint}
        className={
          error
            ? 'min-h-[48px] rounded-2xl border border-red-600 bg-white/60 px-4 py-3 font-body text-[15px] text-ink'
            : 'min-h-[48px] rounded-2xl border border-ink-faint/30 bg-white/60 px-4 py-3 font-body text-[15px] text-ink'
        }
        {...rest}
      />
      {error ? (
        <Caption className="text-red-600" testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Caption>
      ) : null}
    </View>
  );
}

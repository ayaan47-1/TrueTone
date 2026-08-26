import { TextInput, View, type TextInputProps } from 'react-native';
import { palette } from '../../theme/tokens';
import { Body, Caption } from './Typography';

export interface TextFieldProps {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  label?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  error?: string;
}

/** Themed single-line text input, controlled by the caller. */
export function TextField({
  value,
  onChangeText,
  placeholder,
  label,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  error,
}: TextFieldProps) {
  return (
    <View className="flex-col">
      {label ? <Body className="mb-1.5">{label}</Body> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.inkFaint}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        className={
          error
            ? 'rounded-xl border px-4 py-3 border-red-600 text-ink'
            : 'rounded-xl border px-4 py-3 border-ink-faint text-ink'
        }
      />
      {error ? <Caption className="mt-1 text-red-600">{error}</Caption> : null}
    </View>
  );
}

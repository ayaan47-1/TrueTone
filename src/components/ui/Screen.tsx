import type { ReactNode } from 'react';
import { View, ScrollView, type ViewStyle, type StyleProp } from 'react-native';
import { MistBackground } from './MistBackground';
import { useInsets } from './use-insets';

interface ScreenProps {
  children: ReactNode;
  /** Tailwind classes for the content container. */
  className?: string;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Apply safe-area top padding (default true). */
  edges?: { top?: boolean; bottom?: boolean };
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Standard page chrome for the "Mist" system: the gradient-mesh atmosphere plus
 * safe-area-aware padding. Most screens render their content directly inside.
 */
export function Screen({ children, className, scroll = true, edges, contentStyle }: ScreenProps) {
  const insets = useInsets();
  const pad = {
    paddingTop: (edges?.top ?? true) ? insets.top : 0,
    paddingBottom: (edges?.bottom ?? true) ? insets.bottom : 0,
  };

  if (scroll) {
    return (
      <MistBackground>
        <ScrollView
          className={className}
          contentContainerStyle={[pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </MistBackground>
    );
  }

  return (
    <MistBackground>
      <View style={[{ flex: 1 }, pad, contentStyle]} className={className}>
        {children}
      </View>
    </MistBackground>
  );
}

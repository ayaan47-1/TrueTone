import type { ReactNode } from 'react';
import { View, ScrollView, type ViewStyle, type StyleProp } from 'react-native';
import { MistBackground } from './MistBackground';
import { useInsets } from './use-insets';

interface ScreenProps {
  children: ReactNode;
  /** Tailwind classes for the centered content column (e.g. horizontal padding). */
  className?: string;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Apply safe-area padding on each edge (default both true). */
  edges?: { top?: boolean; bottom?: boolean };
  /** Extra padding ABOVE the safe-area top inset. */
  topGap?: number;
  /** Extra padding BELOW the safe-area bottom inset (e.g. TAB_BAR_CLEARANCE). */
  bottomGap?: number;
  /** Max content width; content is centered and capped on large/unfolded screens. */
  maxWidth?: number;
  /** Extra container styles. Avoid setting paddingTop/Bottom here — use the gap props. */
  contentStyle?: StyleProp<ViewStyle>;
}

const DEFAULT_MAX_WIDTH = 560;

/**
 * Extra top padding a pushed screen should reserve so its first element clears the root
 * Stack's TRANSPARENT floating header (the back button) instead of rendering under it.
 * Single source of truth -- pass as `topGap={HEADER_CLEARANCE}` on any header-bearing screen
 * (tab screens set their own smaller topGap; they have no floating header). Mirrors
 * TAB_BAR_CLEARANCE for the bottom edge. */
export const HEADER_CLEARANCE = 56;

/**
 * Standard page chrome for the "Mist" system: the gradient-mesh atmosphere, plus
 * safe-area-aware padding that callers cannot accidentally clobber, plus a centered
 * content column that caps its width on large/unfolded (foldable) screens.
 *
 * Safe-area insets are applied ADDITIVELY with `topGap`/`bottomGap` so edge-to-edge
 * content (mandatory on Android SDK 56) never slips under the status/navigation bars.
 */
export function Screen({
  children,
  className,
  scroll = true,
  edges,
  topGap = 0,
  bottomGap = 0,
  maxWidth = DEFAULT_MAX_WIDTH,
  contentStyle,
}: ScreenProps) {
  const insets = useInsets();
  const paddingTop = ((edges?.top ?? true) ? insets.top : 0) + topGap;
  const paddingBottom = ((edges?.bottom ?? true) ? insets.bottom : 0) + bottomGap;

  const column = (
    <View
      className={className}
      style={{ width: '100%', maxWidth, alignSelf: 'center', flexGrow: 1 }}
    >
      {children}
    </View>
  );

  if (scroll) {
    return (
      <MistBackground>
        <ScrollView
          contentContainerStyle={[{ paddingTop, paddingBottom, flexGrow: 1 }, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {column}
        </ScrollView>
      </MistBackground>
    );
  }

  return (
    <MistBackground>
      <View style={[{ flex: 1, paddingTop, paddingBottom }, contentStyle]}>{column}</View>
    </MistBackground>
  );
}

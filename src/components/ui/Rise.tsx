// Entrance primitive: content fades in while rising a short distance, optionally staggered.
//
// Named `Rise` rather than `FadeInUp` because Reanimated already exports a `FadeInUp` layout
// animation (which this wraps) — sharing the name would be a footgun at import sites.
//
// Uses Reanimated's layout animations, the same mechanism as GlassSheet, so the work runs on the
// UI thread. Only opacity/transform animate — never blur or layout — which keeps it cheap on
// large screens like the Fold.
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { DURATION, ENTER_OFFSET, staggerDelay, useCalm } from '../../theme/motion';

interface RiseProps {
  children: ReactNode;
  /** Position in a staggered group; later items enter slightly later. Defaults to 0 (no delay). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

export function Rise({ children, index = 0, style }: RiseProps) {
  const calm = useCalm();
  const delayMs = staggerDelay(index);

  // Reduced motion: render the final state immediately, with no `entering` animation attached.
  if (calm) {
    return (
      <Animated.View testID="rise" style={style}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      testID="rise"
      style={style}
      entering={FadeInUp.duration(DURATION.base).delay(delayMs).withInitialValues({
        transform: [{ translateY: ENTER_OFFSET }],
      })}
    >
      {children}
    </Animated.View>
  );
}

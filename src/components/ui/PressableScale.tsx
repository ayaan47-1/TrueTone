// Press primitive: a drop-in Pressable that dips slightly while held, then springs back.
//
// Makes taps feel responsive without being playful — the spring is damped so it settles with no
// visible bounce. Scale only (a transform), so it stays on the UI thread and costs nothing.
import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING, useCalm } from '../../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** How far the target dips while held. Deliberately subtle. */
const PRESSED_SCALE = 0.98;

interface PressableScaleProps extends PressableProps {
  children?: ReactNode;
}

export function PressableScale({ children, onPressIn, onPressOut, style, ...rest }: PressableScaleProps) {
  const calm = useCalm();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Reduced motion: identical press behaviour, no scaling.
  if (calm) {
    return (
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} style={style} {...rest}>
        {children}
      </Pressable>
    );
  }

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        scale.value = withSpring(PRESSED_SCALE, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      style={[animatedStyle, style as never]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

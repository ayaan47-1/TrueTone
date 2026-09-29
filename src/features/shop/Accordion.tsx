// src/features/shop/Accordion.tsx
// Disclosure row from the v3 product page (Accordion3): hairline top border, title + chevron.
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { DURATION } from '../../theme/motion';
import { ChevronGlyph } from './shop-icons';

interface AccordionProps {
  title: string;
  initiallyOpen?: boolean;
  children: ReactNode;
}

export function Accordion({ title, initiallyOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View className="border-t border-ink-faint/25">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        className="min-h-[48px] flex-row items-center justify-between py-4 pr-1"
      >
        <Text className="font-body-semibold text-[15px] text-ink">{title}</Text>
        <ChevronGlyph color={palette.ink} dir={open ? 'up' : 'down'} />
      </PressableScale>
      {open ? (
        <Animated.View entering={FadeIn.duration(DURATION.base)} className="pb-4">
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

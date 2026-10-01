// src/features/foryou/HomeHeader.tsx
// For You header (video t-01): the truetone lockup, then avatar initial + "Hi, <name>" +
// date, with notifications and bag icon buttons. No unread dot on the bell: we have no
// notifications feed, so a dot would signal something that is not there.
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Caption, GlassSurface, PressableScale } from '../../components/ui';
import { glass, palette, shadeGradient } from '../../theme/tokens';
import { BagButton } from '../shop/ShopGrid';
import { BellGlyph } from './home-icons';
import { HOME_LOCKUP } from './home-photos';

/** "ayaan" -> "Ayaan"; blank or missing -> undefined (caller shows a neutral greeting). */
export function greetingName(username: string | null | undefined): string | undefined {
  const trimmed = username?.trim();
  if (!trimmed) return undefined;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

interface HomeHeaderProps {
  name?: string;
  dateLabel: string;
  /** Post-scan, the avatar wears the warm shade gradient (as in the kit). */
  scanned: boolean;
  onBell: () => void;
  onBag: () => void;
}

export function HomeHeader({ name, dateLabel, scanned, onBell, onBag }: HomeHeaderProps) {
  const initial = (name ?? 'T').charAt(0).toUpperCase();
  return (
    <View>
      <View className="mb-3.5 items-center">
        <Image
          testID="home-lockup"
          source={HOME_LOCKUP}
          accessibilityLabel="truetone"
          resizeMode="contain"
          style={{ height: 38, width: 86 }}
        />
      </View>
      <View className="flex-row items-center gap-3">
        <Avatar initial={initial} scanned={scanned} />
        <View className="min-w-0 flex-1">
          <Text className="font-display text-[17px] text-ink">{name ? `Hi, ${name}` : 'Hi there'}</Text>
          <Caption className="text-[13px] text-ink-muted">{dateLabel}</Caption>
        </View>
        <BellButton onPress={onBell} />
        <BagButton onPress={onBag} />
      </View>
    </View>
  );
}

function Avatar({ initial, scanned }: { initial: string; scanned: boolean }) {
  const letter = <Text className="font-display text-[16px] text-mauve-700">{initial}</Text>;
  if (!scanned) {
    return <View className="h-11 w-11 items-center justify-center rounded-full bg-mist-300">{letter}</View>;
  }
  return (
    <LinearGradient
      colors={[...shadeGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
    >
      {letter}
    </LinearGradient>
  );
}

function BellButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      onPress={onPress}
      className="h-11 w-11 rounded-full"
    >
      <GlassSurface
        interactive
        intensity={0}
        style={{ flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        fallbackStyle={{ backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge }}
      >
        <BellGlyph color={palette.ink} size={19} />
      </GlassSurface>
    </PressableScale>
  );
}

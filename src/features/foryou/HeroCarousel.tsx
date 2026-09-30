// src/features/foryou/HeroCarousel.tsx
// The For You hero (video t-01, kit HeroCarousel3): three swipeable photo slides with page
// dots — the shade slide, "Finish your look", and the TRUE15 promo. Compliance:
// • the promo carries "Demo promo — no purchases in this build." (v3-demo-content-ruling §3);
// • the shade slide names the shade and a pick count only, never a numeric fit (§4);
// • pre-scan copy makes no timing claim. Photos are bundled locally (home-photos.ts).
import { useRef, useState, type ReactNode } from 'react';
import {
  ImageBackground,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '../../components/ui';
import { palette, softShadow } from '../../theme/tokens';
import { HERO_PHOTOS } from './home-photos';

export const DEMO_PROMO_LABEL = 'Demo promo — no purchases in this build.';

const HEIGHT = 188;
const SLIDES = 3;

interface HeroCarouselProps {
  /** The derived shade word (post-scan only). */
  shadeName?: string;
  /** How many ranked picks the shade produced (post-scan only). */
  pickCount?: number;
  onScan: () => void;
  onShop: () => void;
}

export function HeroCarousel({ shadeName, pickCount, onScan, onShop }: HeroCarouselProps) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const goTo = (i: number): void => {
    setIndex(i);
    scroller.current?.scrollTo({ x: i * width, animated: true });
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="overflow-hidden rounded-[28px]"
      style={[{ height: HEIGHT }, softShadow]}
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSettle}
      >
        <ShadeSlide width={width} shadeName={shadeName} pickCount={pickCount} onScan={onScan} onShop={onShop} />
        <LookSlide width={width} onShop={onShop} />
        <PromoSlide width={width} />
      </ScrollView>
      <Dots index={index} dark={index === 0} onSelect={goTo} />
    </View>
  );
}

interface SlideProps {
  width: number;
  photo: ImageSourcePropType;
  wash: readonly [string, string, string];
  testID: string;
  children: ReactNode;
}

function Slide({ width, photo, wash, testID, children }: SlideProps) {
  return (
    <ImageBackground
      testID={testID}
      source={photo}
      resizeMode="cover"
      style={{ width: width || 1, height: HEIGHT }}
    >
      <LinearGradient
        colors={[...wash]}
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1, padding: 22 }}
      >
        {children}
      </LinearGradient>
    </ImageBackground>
  );
}

function Pill({ label, onPress, dark = false }: { label: string; onPress: () => void; dark?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`mt-3.5 self-start rounded-full px-[18px] py-2.5 ${dark ? 'bg-ink' : 'bg-white'}`}
    >
      <Text className={`font-body-semibold text-[13px] ${dark ? 'text-white' : 'text-ink'}`}>{label}</Text>
    </PressableScale>
  );
}

const eyebrow = 'font-body-semibold text-[10.5px] uppercase tracking-[1.6px]';
const title = 'mt-2 font-display text-[23px] leading-[28px] tracking-[-0.5px]';

interface ShadeSlideProps extends Omit<HeroCarouselProps, 'shadeName'> {
  width: number;
  shadeName?: string;
}

function ShadeSlide({ width, shadeName, pickCount, onScan, onShop }: ShadeSlideProps) {
  const sub = shadeName
    ? pickCount
      ? `${pickCount} picks ranked for your tone.`
      : 'Picks ranked for your tone.'
    : 'One selfie, read on your phone.';
  return (
    <Slide
      testID="hero-slide-shade"
      width={width}
      photo={HERO_PHOTOS.scan}
      wash={['rgba(20,24,22,0.86)', 'rgba(20,24,22,0.55)', 'rgba(20,24,22,0.05)']}
    >
      <Text className={`${eyebrow} text-white/60`}>{shadeName ? 'Your shade' : 'Shade match'}</Text>
      <Text className={`${title} max-w-[210px] text-white`}>
        {shadeName ? `${shadeName} is your match` : 'Find your true shade'}
      </Text>
      <Text className="mt-1.5 max-w-[200px] font-body text-[13px] leading-[19px] text-white/70">{sub}</Text>
      {shadeName ? <Pill label="See my matches" onPress={onShop} /> : <Pill label="Start scan" onPress={onScan} />}
    </Slide>
  );
}

function LookSlide({ width, onShop }: { width: number; onShop: () => void }) {
  return (
    <Slide
      testID="hero-slide-look"
      width={width}
      photo={HERO_PHOTOS.look}
      wash={['rgba(250,247,242,0.96)', 'rgba(250,247,242,0.8)', 'rgba(250,247,242,0)']}
    >
      <Text className={`${eyebrow} text-sage`}>Finish your look</Text>
      <Text className={`${title} max-w-[180px] text-ink`}>Your base, complete</Text>
      <Text className="mt-1.5 max-w-[170px] font-body text-[13px] leading-[19px] text-ink-soft">
        Tint, blush and brow, picked to go together.
      </Text>
      <Pill label="Shop the set" onPress={onShop} dark />
    </Slide>
  );
}

function PromoSlide({ width }: { width: number }) {
  return (
    <Slide
      testID="hero-slide-promo"
      width={width}
      photo={HERO_PHOTOS.promo}
      wash={['rgba(248,238,231,0.97)', 'rgba(248,238,231,0.85)', 'rgba(248,238,231,0)']}
    >
      <Text
        className="font-display text-[34px] leading-[38px] tracking-[-1px]"
        style={{ color: palette.clayInk }}
      >
        15% off
      </Text>
      <Text className="mt-0.5 font-body text-[14px] text-ink">your first matched bag</Text>
      <View
        className="mt-3.5 flex-row items-center gap-2 self-start rounded-xl bg-white/50 px-3 py-2"
        style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.clay }}
      >
        <Text className="font-body-bold text-[13px] tracking-[1px]" style={{ color: palette.clayInk }}>
          TRUE15
        </Text>
      </View>
      <Text className="mt-2 max-w-[190px] font-body text-[11px] leading-[14px] text-ink-soft">
        {DEMO_PROMO_LABEL}
      </Text>
    </Slide>
  );
}

function Dots({ index, dark, onSelect }: { index: number; dark: boolean; onSelect: (i: number) => void }) {
  const on = dark ? palette.white : palette.ink;
  const off = dark ? 'rgba(255,255,255,0.35)' : 'rgba(34,31,26,0.2)';
  return (
    <View className="absolute bottom-3.5 right-5 flex-row gap-[5px]">
      {Array.from({ length: SLIDES }, (_, d) => (
        <PressableScale
          key={d}
          testID={`hero-dot-${d}`}
          accessibilityRole="button"
          accessibilityLabel={`Slide ${d + 1} of ${SLIDES}`}
          accessibilityState={{ selected: d === index }}
          hitSlop={8}
          onPress={() => onSelect(d)}
          style={{ width: d === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: d === index ? on : off }}
        />
      ))}
    </View>
  );
}

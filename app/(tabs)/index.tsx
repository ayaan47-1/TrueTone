import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  Display,
  Caption,
  Disclaimer,
  TAB_BAR_CLEARANCE,
  Rise,
} from '../../src/components/ui';
import { BagButton } from '../../src/features/shop/ShopGrid';
import { Categories, HeroCard, HomeSearch, QuickActions } from '../../src/features/foryou/HomeV3Parts';
import { AffirmationCard } from '../../src/features/today/AffirmationCard';
import { usePersonalization } from '../../src/features/session/personalization';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';
import { DEMO_MODE } from '../../src/lib/supabase';
import {
  resolveForYouProfile,
  pickedForYourShade,
  featuredProducts,
} from '../../src/features/foryou/for-you-profile';
import { ProductRail } from '../../src/features/foryou/ProductRail';
import { RoutineSummaryWidget } from '../../src/features/routine/components/RoutineSummaryWidget';

/**
 * For You — the app home (Quiet Glass v3): greeting + bag, a search entry, a static shade
 * hero, quick actions, category shortcuts, then the affirmation, routine and two product
 * rails (ranked picks for the current shade and a diverse featured set).
 */
export default function TodayScreen() {
  const router = useRouter();
  const { hasScanned, currentShade } = usePersonalization();

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const prefs = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
  const forYouProfile = resolveForYouProfile(hasScanned, currentShade, prefs, DEMO_MODE);
  const yourPicks = forYouProfile ? pickedForYourShade(forYouProfile) : [];
  const featured = featuredProducts();

  return (
    <Screen className="px-6" topGap={22} bottomGap={TAB_BAR_CLEARANCE}>
      <Rise>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-1">
            <Caption className="text-[14px] text-ink-muted">{dateLabel}</Caption>
            <Display className="text-[30px] leading-[36px]">{greeting}</Display>
          </View>
          <BagButton onPress={() => router.push('/bag')} />
        </View>
        <View className="mt-[18px]">
          <HomeSearch onOpen={() => router.push('/shop')} />
        </View>
        <View className="mt-[18px]">
          <HeroCard
            shadeName={hasScanned ? currentShade?.shadeName : undefined}
            onScan={() => router.push('/scan-gate')}
            onShop={() => router.push('/shop')}
          />
        </View>
        <View className="mt-[18px]">
          <QuickActions onGo={(path) => router.push(path)} />
        </View>
        <View className="mt-[30px] gap-3">
          <Text className="font-display text-[18px] text-ink">Categories</Text>
          <Categories onGo={(path) => router.push(path)} />
        </View>
      </Rise>

      <Rise index={1}>
        <View className="mt-7">
          <AffirmationCard />
        </View>
      </Rise>

      <Rise index={2}>
        <View className="mt-7">
          <RoutineSummaryWidget />
        </View>
      </Rise>

      <Rise index={3}>
        <View className="mt-9 gap-8">
          {forYouProfile ? (
            <ProductRail
              title="Your products"
              subtitle="Picked for your shade"
              products={yourPicks}
              profile={forYouProfile}
            />
          ) : null}
          <ProductRail
            title="Featured products"
            subtitle="A range from fair to deep"
            products={featured}
          />
        </View>
      </Rise>

      <Rise index={4}>
        <View className="mt-6"><Disclaimer /></View>
      </Rise>
    </Screen>
  );
}

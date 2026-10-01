import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Disclaimer, tabBarClearance, Rise } from '../../src/components/ui';
import { Categories, HomeSearch, QuickActions, SectionHead } from '../../src/features/foryou/HomeV3Parts';
import { HomeHeader } from '../../src/features/foryou/HomeHeader';
import { HeroCarousel } from '../../src/features/foryou/HeroCarousel';
import { TodaysRoutineCard } from '../../src/features/foryou/TodaysRoutineCard';
import { RunningLowCard } from '../../src/features/foryou/RunningLowCard';
import { SeasonalSheet } from '../../src/features/foryou/SeasonalSheet';
import { useGreetingName } from '../../src/features/foryou/use-greeting-name';
import { usePersonalization } from '../../src/features/session/personalization';
import { useProfile } from '../../src/lib/profile-context';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';
import { DEMO_MODE } from '../../src/lib/supabase';
import {
  resolveForYouProfile,
  pickedForYourShade,
  featuredProducts,
} from '../../src/features/foryou/for-you-profile';
import { ProductRail } from '../../src/features/foryou/ProductRail';

/**
 * For You — the app home, matched to the designer's v3 walkthrough (t-01..t-03, t-06):
 * lockup + "Hi, <name>" header with bell and bag, search + sort/filter, the photo hero
 * carousel, four quick actions, photo categories, the shade picks rail, then today's
 * routine and running low (both on sample data, see home-sample-data.ts).
 */
export default function TodayScreen() {
  const router = useRouter();
  const { hasScanned, currentShade } = usePersonalization();
  const { userId } = useProfile();
  const name = useGreetingName(userId);
  const [seasonalOpen, setSeasonalOpen] = useState(false);

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const prefs = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
  const forYouProfile = resolveForYouProfile(hasScanned, currentShade, prefs, DEMO_MODE);
  const picks = forYouProfile ? pickedForYourShade(forYouProfile) : featuredProducts();
  const shadeName = hasScanned ? currentShade?.shadeName : undefined;
  const go = (path: string): void => router.push(path);

  return (
    <View style={{ flex: 1 }}>
      <Screen className="px-6" topGap={12} bottomGap={tabBarClearance()}>
        <Rise>
          <HomeHeader
            name={name}
            dateLabel={dateLabel}
            scanned={hasScanned}
            onBell={() => go('/you')}
            onBag={() => go('/bag')}
          />
          <View className="mt-[18px]">
            <HomeSearch onOpen={() => go('/shop?focus=1')} onFilter={() => go('/shop?filter=1')} />
          </View>
          <View className="mt-[18px]">
            <HeroCarousel
              shadeName={shadeName}
              pickCount={shadeName ? picks.length : undefined}
              onScan={() => go('/scan-gate')}
              onShop={() => go('/shop')}
            />
          </View>
          <View className="mt-[18px]">
            <QuickActions onGo={go} onSeasonal={() => setSeasonalOpen(true)} />
          </View>
          <View className="mt-[30px]">
            <SectionHead title="Categories" onAction={() => go('/shop')} />
            <Categories onGo={go} />
          </View>
        </Rise>

        <Rise index={1}>
          <View className="mt-[30px]">
            <ProductRail
              title={forYouProfile ? 'Picked for your shade' : 'Featured'}
              subtitle={
                forYouProfile
                  ? `Ranked for ${currentShade?.shadeName ?? 'your shade'}`
                  : 'A range from fair to deep'
              }
              products={picks}
              profile={forYouProfile ?? undefined}
              onSeeAll={() => go('/shop')}
            />
          </View>
        </Rise>

        <Rise index={2}>
          <View className="mt-[22px]">
            <TodaysRoutineCard />
          </View>
          <View className="mt-3.5">
            <RunningLowCard />
          </View>
        </Rise>

        <Rise index={3}>
          <View className="mt-6"><Disclaimer /></View>
        </Rise>
      </Screen>
      {seasonalOpen ? (
        <SeasonalSheet
          onClose={() => setSeasonalOpen(false)}
          onScan={() => {
            setSeasonalOpen(false);
            go('/scan-gate');
          }}
        />
      ) : null}
    </View>
  );
}

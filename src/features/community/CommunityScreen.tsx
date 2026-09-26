// src/features/community/CommunityScreen.tsx
// Community tab body -- Routines and Feed/Videos, both from local seed data
// (community-seed.ts, no network, no backend table yet). Public seam: no props --
// `app/(tabs)/community.tsx` (Commerce-owned) renders this directly.
import { useState } from 'react';
import { View } from 'react-native';
import { Display, PressableScale, Caption, Screen, TAB_BAR_CLEARANCE, Rise } from '../../components/ui';
import { SEED_POSTS, SEED_ROUTINES } from './community-seed';
import { useCommunityFeed } from './use-community-feed';
import { usePublishedRoutines } from '../routine/use-published-routines';
import { PostCard } from './components/PostCard';
import { RoutineCard } from './components/RoutineCard';
import { ProductTagDrawer } from './components/ProductTagDrawer';
import type { CommunityTab } from './community-types';

const TABS: readonly { key: CommunityTab; label: string }[] = [
  { key: 'routines', label: 'Routines' },
  { key: 'feed', label: 'Feed' },
];

export function CommunityScreen() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('feed');
  const [drawerProductIds, setDrawerProductIds] = useState<readonly string[] | null>(null);
  const { engagementFor, toggleLike, toggleSave, registerShare } = useCommunityFeed(SEED_POSTS);
  // User-published routines (Task 13) surface ahead of the seeded ones in the Routines tab.
  const publishedRoutines = usePublishedRoutines();
  const routines = [...publishedRoutines, ...SEED_ROUTINES];

  return (
    <Screen className="px-6" topGap={32} bottomGap={TAB_BAR_CLEARANCE}>
      <Rise>
        <View className="items-center mt-3 mb-6">
          <Display className="text-[28px]">Community</Display>
        </View>
      </Rise>

      <Rise index={1}>
        <View className="flex-row justify-center gap-2 mb-5" accessibilityRole="tablist">
          {TABS.map((tab) => (
            <PressableScale
              key={tab.key}
              testID={`community-tab-${tab.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
              onPress={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full ${activeTab === tab.key ? 'bg-ink' : 'bg-mist-300'}`}
            >
              <Caption className={activeTab === tab.key ? 'text-white font-body-semibold' : 'text-ink-soft'}>
                {tab.label}
              </Caption>
            </PressableScale>
          ))}
        </View>
      </Rise>

      <View className="gap-4">
        {activeTab === 'routines'
          ? routines.map((routine, index) => (
              <Rise key={routine.id} index={index + 2}>
                <RoutineCard
                  routine={routine}
                  onShopTheLook={() => setDrawerProductIds(routine.taggedProductIds)}
                />
              </Rise>
            ))
          : SEED_POSTS.map((post, index) => (
              <Rise key={post.id} index={index + 2}>
                <PostCard
                  post={post}
                  engagement={engagementFor(post.id)}
                  onToggleLike={() => toggleLike(post.id)}
                  onToggleSave={() => toggleSave(post.id)}
                  onShare={() => registerShare(post.id)}
                  onShopTheLook={() => setDrawerProductIds(post.taggedProductIds)}
                />
              </Rise>
            ))}
      </View>

      {drawerProductIds ? (
        <ProductTagDrawer productIds={drawerProductIds} onClose={() => setDrawerProductIds(null)} />
      ) : null}
    </Screen>
  );
}

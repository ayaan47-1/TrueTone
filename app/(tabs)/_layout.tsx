import { Tabs, useRouter } from 'expo-router';
import { GlassTabBar, type TabKey } from '../../src/components/ui';

// The exact tab-bar props type, derived from Tabs (avoids importing
// @react-navigation/bottom-tabs types directly, which aren't resolvable here).
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

// Land on Shop (the primary/home destination) when the group is entered, rather than the
// default `index` route. expo-router reads initialRouteName from this exported settings object.
export const unstable_settings = { initialRouteName: 'shop' };

/**
 * Main app shell: four tabbed destinations (Shop / Today / Trend / You) plus a center
 * "Shade match" action that opens the pre-camera scan gate (`/scan-gate`, the on-device
 * privacy screen) BEFORE the full-screen camera route, which lives OUTSIDE the tab
 * navigator (capture is a focused, chrome-free flow). Shop is primary/home. The 18+ age
 * gate + biometric consent are enforced UPSTREAM by the root layout's Guard (CLAUDE.md
 * §1) — this group only renders once those boot gates have cleared, so the camera can
 * never mount for a user who has not passed them.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="trend" options={{ title: 'Trend' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}

/** Adapts React Navigation's tab state onto the presentational GlassTabBar. */
function TabBar({ state, navigation }: TabBarProps) {
  const router = useRouter();
  const activeKey = state.routes[state.index]?.name ?? 'shop';

  const onSelect = (key: TabKey) => {
    const route = state.routes.find((r) => r.name === key);
    if (!route) return;
    const focused = state.routes[state.index]?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <GlassTabBar
      activeKey={activeKey}
      onSelect={onSelect}
      // Route the floating "Shade match" button to the pre-camera scan gate (`/scan-gate`),
      // the on-device-privacy screen that precedes capture. The 18+ age gate + biometric
      // consent are already enforced upstream by the root Guard before this group renders
      // (CLAUDE.md §1). Never push '/scan' (the camera) directly from here.
      onScanPress={() => router.push('/scan-gate')}
    />
  );
}

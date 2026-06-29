import { Tabs, useRouter } from 'expo-router';
import { GlassTabBar, type TabKey } from '../../src/components/ui';

// The exact tab-bar props type, derived from Tabs (avoids importing
// @react-navigation/bottom-tabs types directly, which aren't resolvable here).
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Main app shell: four tabbed destinations (Today / Routine / Trend / You) plus a
 * center "Scan" action that pushes the full-screen camera route, which lives
 * OUTSIDE the tab navigator (capture is a focused, chrome-free flow). The gate
 * logic in the root layout still owns access; this group only renders once `home`.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="routine" options={{ title: 'Routine' }} />
      <Tabs.Screen name="trend" options={{ title: 'Trend' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}

/** Adapts React Navigation's tab state onto the presentational GlassTabBar. */
function TabBar({ state, navigation }: TabBarProps) {
  const router = useRouter();
  const activeKey = state.routes[state.index]?.name ?? 'index';

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
      onScanPress={() => router.push('/scan')}
    />
  );
}

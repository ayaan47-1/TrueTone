import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { SFSymbol } from 'sf-symbols-typescript';
import { GlassTabBar, type TabKey } from '../../src/components/ui';
import { hasLiquidGlass } from '../../src/components/ui/liquid-glass';
import { palette } from '../../src/theme/tokens';

// The exact tab-bar props type, derived from Tabs (avoids importing
// @react-navigation/bottom-tabs types directly, which aren't resolvable here).
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

// Land on Shop (the primary/home destination) when the group is entered, rather than the
// default `index` route. expo-router reads initialRouteName from this exported settings object.
export const unstable_settings = { initialRouteName: 'shop' };

/**
 * Main app shell: four tabbed destinations (Shop · For You · Community · Account). The
 * shade-match ("Shade match") scan entry is NOT a tab — it lives as a small icon in the
 * For You header, which pushes the pre-camera scan gate (`/scan-gate`, the on-device
 * privacy screen) BEFORE the full-screen camera route (capture lives OUTSIDE the tab
 * navigator, as a focused, chrome-free flow). Shop is primary/home. The 18+ age gate +
 * biometric consent are enforced UPSTREAM by the root layout's Guard (CLAUDE.md §1) —
 * this group only renders once those boot gates have cleared, so the camera can never
 * mount for a user who has not passed them.
 */
export default function TabsLayout() {
  return hasLiquidGlass() ? <NativeTabsLayout /> : <FloatingTabsLayout />;
}

// Bar order, left→right. SF Symbols echo the Quiet Glass glyphs in tab-icons.tsx
// (bag · sun ring · two people · person); the filled variant marks the selected tab.
const NATIVE_TABS: readonly { name: TabKey; label: string; sf: SFSymbol; sfSelected: SFSymbol }[] = [
  { name: 'shop', label: 'Shop', sf: 'bag', sfSelected: 'bag.fill' },
  { name: 'index', label: 'For You', sf: 'sun.max', sfSelected: 'sun.max.fill' },
  { name: 'community', label: 'Community', sf: 'person.2', sfSelected: 'person.2.fill' },
  { name: 'you', label: 'Account', sf: 'person.crop.circle', sfSelected: 'person.crop.circle.fill' },
];

/**
 * iOS 26+: the system UITabBar, so the bar IS Apple's Liquid Glass (lensing, morphing,
 * minimize-on-scroll) rather than an imitation. Screens keep their own manual insets
 * (`tabBarClearance()`), so automatic scroll-view insets are disabled to avoid doubling.
 */
function NativeTabsLayout() {
  return (
    <NativeTabs tintColor={palette.sage}>
      {NATIVE_TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.name} disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon sf={{ default: t.sf, selected: t.sfSelected }} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

/** iOS < 26, Android, web: the Quiet Glass floating blur bar. */
function FloatingTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
      <Tabs.Screen name="index" options={{ title: 'For You' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="you" options={{ title: 'Account' }} />
    </Tabs>
  );
}

/** Adapts React Navigation's tab state onto the presentational GlassTabBar. */
function TabBar({ state, navigation }: TabBarProps) {
  const activeKey = state.routes[state.index]?.name ?? 'shop';

  const onSelect = (key: TabKey) => {
    const route = state.routes.find((r) => r.name === key);
    if (!route) return;
    const focused = state.routes[state.index]?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return <GlassTabBar activeKey={activeKey} onSelect={onSelect} />;
}

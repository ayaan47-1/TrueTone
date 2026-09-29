import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, tabBarClearance } from '../../src/components/ui';
import { ShopGrid } from '../../src/features/shop/ShopGrid';
import { useMatchProfile } from '../../src/features/shop/use-match-profile';
import { FILTERS, type Filter } from '../../src/content/makeup-vocab';

const isFilter = (v: unknown): v is Filter => typeof v === 'string' && (FILTERS as readonly string[]).includes(v);

/** Shop tab: the v3 grid. Tiles open the product sheet; the bag button opens the bag.
 *  `?focus=1` (from the home search bar) opens with the search field focused. */
export default function ShopScreen() {
  const router = useRouter();
  const { cat, focus } = useLocalSearchParams<{ cat?: string; focus?: string }>();
  const { profile } = useMatchProfile();
  const initialFilter = isFilter(cat) ? cat : 'all';

  return (
    <Screen className="px-6" topGap={12} bottomGap={tabBarClearance()}>
      <ShopGrid
        key={`${initialFilter}:${focus ?? ''}`}
        initialFilter={initialFilter}
        autoFocusSearch={focus === '1'}
        profile={profile}
        onOpen={(id) => router.push(`/product/${id}`)}
        onScan={() => router.push('/scan-gate')}
        onBag={() => router.push('/bag')}
      />
    </Screen>
  );
}

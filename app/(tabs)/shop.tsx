import { useRouter } from 'expo-router';
import { Screen, TAB_BAR_CLEARANCE } from '../../src/components/ui';
import { ShopGrid } from '../../src/features/shop/ShopGrid';
import { useMatchProfile } from '../../src/features/shop/use-match-profile';

/** Shop tab: the v3 grid. Tiles open the product sheet; the bag button opens the bag. */
export default function ShopScreen() {
  const router = useRouter();
  const { profile } = useMatchProfile();

  return (
    <Screen className="px-6" topGap={12} bottomGap={TAB_BAR_CLEARANCE}>
      <ShopGrid
        profile={profile}
        onOpen={(id) => router.push(`/product/${id}`)}
        onScan={() => router.push('/scan-gate')}
        onBag={() => router.push('/bag')}
      />
    </Screen>
  );
}

import { useRouter } from 'expo-router';
import { Screen, tabBarClearance } from '../../src/components/ui';
import { ShopifyShopScreen } from '../../src/features/commerce/shopify/ui/ShopifyShopScreen';

/** Shop tab: the v3 grid. Tiles open the product sheet; the bag button opens the bag.
 *  `?focus=1` (from the home search bar) opens with the search field focused. */
export default function ShopScreen() {
  const router = useRouter();

  return (
    <Screen className="px-6" topGap={12} bottomGap={tabBarClearance()}>
      <ShopifyShopScreen
        onOpen={(handle) => router.push(`/shop-product/${handle}`)}
        onBag={() => router.push('/shop-bag')}
      />
    </Screen>
  );
}

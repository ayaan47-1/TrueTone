// app/bag.tsx
// Bag route (root Stack, own header). Thin wrapper over the v3 BagScreen.
import { useRouter } from 'expo-router';
import { BagScreen } from '../src/features/checkout/BagScreen';
import { catalogueIsDemo } from '../src/features/match/product-catalog';
import { ShopifyBagScreen } from '../src/features/commerce/shopify/ui/ShopifyBagScreen';

export default function BagRoute() {
  const router = useRouter();
  if (!catalogueIsDemo) return <ShopifyBagScreen onShop={() => router.replace('/shop')} />;
  return (
    <BagScreen
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/shop'))}
      onShop={() => router.push('/shop')}
      onCheckout={() => router.push('/checkout')}
    />
  );
}

import { useRouter } from 'expo-router';
import { MistBackground } from '../src/components/ui';
import { ShopifyBagScreen } from '../src/features/commerce/shopify/ui/ShopifyBagScreen';

export default function ShopifyBagRoute() {
  const router = useRouter();
  return (
    <MistBackground>
      <ShopifyBagScreen onShop={() => router.replace('/shop')} />
    </MistBackground>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui';
import { ShopifyProductScreen } from '../../src/features/commerce/shopify/ui/ShopifyProductScreen';

export default function ShopifyProductRoute() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const backToShop = (): void => (router.canGoBack() ? router.back() : router.replace('/shop'));
  return (
    <Screen topGap={0} bottomGap={0} scroll={false}>
      <ShopifyProductScreen handle={String(handle ?? '')} onBack={backToShop} onAdded={() => router.push('/shop-bag')} />
    </Screen>
  );
}

// app/bag.tsx
// Bag route (root Stack, own header). Thin wrapper over the v3 BagScreen.
import { useRouter } from 'expo-router';
import { BagScreen } from '../src/features/checkout/BagScreen';

export default function BagRoute() {
  const router = useRouter();
  return (
    <BagScreen
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/shop'))}
      onShop={() => router.push('/shop')}
      onCheckout={() => router.push('/checkout')}
    />
  );
}

// app/product/[id].tsx
// Product sheet route (presented modally from the root Stack). Thin wrapper over ProductDetail.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProductDetail } from '../../src/features/shop/ProductDetail';
import { useMatchProfile } from '../../src/features/shop/use-match-profile';

export default function ProductRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, shadeName } = useMatchProfile();

  return (
    <ProductDetail
      productId={String(id ?? '')}
      profile={profile}
      shadeName={shadeName}
      onScan={() => router.push('/scan-gate')}
      onAdded={() => router.back()}
    />
  );
}

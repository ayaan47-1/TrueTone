// app/product/[id].tsx
// Product sheet route (presented modally from the root Stack). Thin wrapper over ProductDetail.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProductDetail } from '../../src/features/shop/ProductDetail';
import { useMatchProfile } from '../../src/features/shop/use-match-profile';
import { View } from 'react-native';
import { PrimaryButton } from '../../src/components/ui';

export default function ProductRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, shadeName } = useMatchProfile();
  const close = (): void => (router.canGoBack() ? router.back() : router.replace('/shop'));

  return (
    <View style={{flex:1}}>
    <ProductDetail
      productId={String(id ?? '')}
      profile={profile}
      shadeName={shadeName}
      onScan={() => router.push('/scan-gate')}
      onAdded={close}
      onClose={close}
    />
    {/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id??'') ? <PrimaryButton label="How did this shade look?" variant="ghost" onPress={()=>router.push({pathname:'/shade-feedback',params:{variant:id}})} /> : null}
    </View>
  );
}

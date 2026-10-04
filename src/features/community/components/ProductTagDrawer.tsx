// src/features/community/components/ProductTagDrawer.tsx
// "Shop the look" bottom drawer -- resolves a post/routine's taggedProductIds against the
// EXISTING shop catalog (src/features/match/product-catalog) rather than a second,
// Community-only product list. Each row opens the product page (app/product/[id]), which
// owns the add-to-bag action; no cart wiring here.
import { View } from 'react-native';
import { GlassSheet, Body, Caption, PressableScale, Subheading } from '../../../components/ui';
import { catalog } from '../../match/product-catalog';

interface ProductTagDrawerProps {
  productIds: readonly string[];
  onClose: () => void;
  onOpenProduct: (productId: string) => void;
}

export function ProductTagDrawer({ productIds, onClose, onOpenProduct }: ProductTagDrawerProps) {
  const products = catalog.filter((product) => productIds.includes(product.id));

  return (
    <GlassSheet align="bottom" onClose={onClose} className="px-6 py-6">
      <Subheading className="mb-4">Shop the look</Subheading>
      {products.length === 0 ? (
        <Body className="text-ink-muted">No tagged products for this one.</Body>
      ) : (
        <View className="gap-3">
          {products.map((product) => (
            <PressableScale
              key={product.id}
              testID={`tagged-product-${product.id}`}
              accessibilityRole="button"
              accessibilityLabel={`View ${product.name}`}
              onPress={() => onOpenProduct(product.id)}
              className="flex-row items-center gap-3 min-h-[44px]"
            >
              <View
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: product.color ?? '#EBE2D3' }}
              />
              <View className="flex-1">
                <Body className="text-ink">{product.name}</Body>
                {product.shadeName ? <Caption className="text-ink-soft">{product.shadeName}</Caption> : null}
              </View>
              <Caption className="text-ink font-body-semibold">{`$${product.price}`}</Caption>
            </PressableScale>
          ))}
        </View>
      )}
    </GlassSheet>
  );
}

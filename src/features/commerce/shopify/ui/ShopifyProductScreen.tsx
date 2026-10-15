import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Body, Caption, Display, GlassCard, PrimaryButton, Subheading } from '../../../../components/ui';
import { formatMoney } from '../money';
import { pickPurchasableVariant } from '../product-mapper';
import { hasAcceptedShopPrivacy } from '../shop-privacy';
import { shopifyStore, useShopifyStore } from '../shopify-store';

interface Props {
  readonly handle: string;
  readonly onBack: () => void;
  readonly onAdded: () => void;
}

export function ShopifyProductScreen({ handle, onBack, onAdded }: Props) {
  const privacyAccepted = hasAcceptedShopPrivacy();
  const { products, loadingProducts, loadingCart, error } = useShopifyStore();
  const product = useMemo(() => products.find((item) => item.handle === handle), [handle, products]);
  const variant = product ? pickPurchasableVariant(product) : null;
  const [quantity] = useState(1);

  useEffect(() => {
    if (privacyAccepted && !product) void shopifyStore.loadProduct(handle);
  }, [handle, privacyAccepted, product]);

  if (!privacyAccepted) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Subheading>Open Shop first</Subheading>
        <Body className="mt-2 text-center">Review the Shop privacy notice before products load.</Body>
        <PrimaryButton className="mt-5" label="Back to shop" onPress={onBack} />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Subheading>{loadingProducts ? 'Loading product…' : 'Product unavailable'}</Subheading>
        {error ? <Body className="mt-2 text-center">{error}</Body> : null}
        <PrimaryButton className="mt-5" label="Back to shop" onPress={onBack} />
      </View>
    );
  }

  const add = async (): Promise<void> => {
    if (variant && (await shopifyStore.addToCart(variant.id, quantity))) onAdded();
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
      {product.featuredImage ? (
        <Image
          source={{ uri: product.featuredImage.url }}
          accessibilityLabel={product.featuredImage.altText ?? product.title}
          resizeMode="cover"
          style={{ width: '100%', height: 360 }}
        />
      ) : null}
      <View className="px-6 py-6">
        <Caption>{product.vendor}</Caption>
        <Display className="mt-1 text-[34px]">{product.title}</Display>
        {variant ? <Subheading className="mt-3">{formatMoney(variant.price)}</Subheading> : null}
        {product.description ? (
          <GlassCard radius={22} className="mt-5 px-5 py-4"><Body>{product.description}</Body></GlassCard>
        ) : null}
        {error ? <Body className="mt-4">{error}</Body> : null}
        <PrimaryButton
          className="mt-6"
          label={variant ? `Add to Shopify bag · ${formatMoney(variant.price)}` : 'Unavailable'}
          disabled={!variant || loadingCart}
          onPress={() => void add()}
        />
        <PrimaryButton className="mt-3" label="Back to shop" variant="glass" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

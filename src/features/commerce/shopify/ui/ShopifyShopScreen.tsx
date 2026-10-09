import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Body, Caption, Display, GlassCard, PrimaryButton, Subheading } from '../../../../components/ui';
import { formatMoney } from '../money';
import { acceptShopPrivacy, __resetShopPrivacyForTests, hasAcceptedShopPrivacy } from '../shop-privacy';
import { shopifyStore, useShopifyStore } from '../shopify-store';
import type { ShopifyProduct } from '../types';

interface Props {
  readonly onOpen: (handle: string) => void;
  readonly onBag: () => void;
}

export function ShopifyShopScreen({ onOpen, onBag }: Props) {
  const [accepted, setAccepted] = useState(hasAcceptedShopPrivacy());
  const { products, cart, loadingProducts, error } = useShopifyStore();

  useEffect(() => {
    if (accepted) void shopifyStore.loadProducts();
  }, [accepted]);

  if (!accepted) {
    return (
      <View className="flex-1 justify-center py-8">
        <GlassCard radius={28} className="px-6 py-7">
          <Display className="text-[30px]">Shop privacy</Display>
          <Body className="mt-3">
            The Shop connects to Shopify to load products and guest checkout. TrueTone does not send your scan,
            skin read, match reasons, profile, or routines.
          </Body>
          <Body className="mt-3">Analytics, preference, marketing, and data-sale consent stay off.</Body>
          <PrimaryButton
            className="mt-6"
            label="Continue to shop"
            onPress={() => {
              acceptShopPrivacy();
              setAccepted(true);
            }}
          />
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row items-center justify-between py-3">
        <Display>Shop</Display>
        <Pressable accessibilityRole="button" accessibilityLabel="Shopify bag" onPress={onBag}>
          <Text className="font-body-semibold text-[15px] text-ink">Bag ({cart?.totalQuantity ?? 0})</Text>
        </Pressable>
      </View>
      <Caption className="mb-4">Products and checkout are provided by Shopify.</Caption>
      {loadingProducts ? <Body>Loading products…</Body> : null}
      {error ? (
        <GlassCard radius={22} className="px-5 py-5">
          <Subheading>Shop unavailable</Subheading>
          <Body className="mt-2">{error}</Body>
          <PrimaryButton className="mt-4" label="Try again" onPress={() => void shopifyStore.loadProducts()} />
        </GlassCard>
      ) : null}
      <View className="gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onOpen={onOpen} />
        ))}
      </View>
    </ScrollView>
  );
}

function ProductCard({ product, onOpen }: { readonly product: ShopifyProduct; readonly onOpen: (handle: string) => void }) {
  const price = product.variants[0]?.price;
  return (
    <Pressable
      testID={`shopify-product-${product.handle}`}
      accessibilityRole="button"
      accessibilityLabel={`View ${product.title}`}
      onPress={() => onOpen(product.handle)}
    >
      <GlassCard radius={24} className="overflow-hidden">
        {product.featuredImage ? (
          <Image
            source={{ uri: product.featuredImage.url }}
            accessibilityLabel={product.featuredImage.altText ?? product.title}
            resizeMode="cover"
            style={{ width: '100%', height: 220 }}
          />
        ) : (
          <View className="h-[220px] items-center justify-center bg-mist-100"><Body>Product image unavailable</Body></View>
        )}
        <View className="px-5 py-4">
          <Caption>{product.vendor}</Caption>
          <Subheading className="mt-1">{product.title}</Subheading>
          {price ? <Body className="mt-2">{formatMoney(price)}</Body> : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

export function __resetShopDisclosureForTests(): void {
  __resetShopPrivacyForTests();
}

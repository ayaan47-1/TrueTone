import { useEffect, useState } from 'react';
import { SUPABASE_OFFLINE } from '../../../../lib/supabase';
import { ShopOfflineNotice } from './ShopOfflineNotice';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Body, Caption, Display, GlassCard, PrimaryButton, Subheading } from '../../../../components/ui';
import { formatMoney } from '../money';
import { acceptShopPrivacy, __resetShopPrivacyForTests, hasAcceptedShopPrivacy } from '../shop-privacy';
import { shopifyStore, useShopifyStore } from '../shopify-store';
import type { ShopifyProduct } from '../types';

interface Props {
  readonly onOpen: (handle: string) => void;
  readonly onBag: () => void;
  readonly onDecline: () => void;
}

// Camera build (Dwight FAIL on PR #60): no store reads, no Shopify requests, no checkout sheet.
export function ShopifyShopScreen(props: Props) {
  if (SUPABASE_OFFLINE) return <ShopOfflineNotice />;
  return <ShopifyShopScreenOnline {...props} />;
}

function ShopifyShopScreenOnline({ onOpen, onBag, onDecline }: Props) {
  const [accepted, setAccepted] = useState(hasAcceptedShopPrivacy());
  const { products, cart, loadingProducts, error, catalogStatus, catalogUpdatedAt } = useShopifyStore();

  useEffect(() => {
    if (accepted) void shopifyStore.loadProducts();
  }, [accepted]);

  if (!accepted) {
    return (
      <View className="flex-1 justify-center py-8">
        <GlassCard radius={28} className="px-6 py-7">
          <Display className="text-[30px]">Shop powered by Shopify</Display>
          <Body className="mt-3">The Shop is separate from your skin read.</Body>
          <Body className="mt-3">
            When you enter the Shop, Shopify may receive device and network information, cookie or similar
            identifiers, pages and products viewed, cart activity, and privacy choices.
          </Body>
          <Body className="mt-3">
            If you check out, Shopify and the named supplier receive the items you order and the contact, payment,
            shipping, and return information needed to complete it.
          </Body>
          <Body className="mt-3">
            We do not send them your photo, scan, cosmetic scores, skin-type label, routine, chat, or why a product
            was suggested. Non-essential analytics, marketing, and data sharing are off by default.
          </Body>
          <PrimaryButton
            className="mt-6"
            label="Continue to shop"
            onPress={() => {
              acceptShopPrivacy();
              setAccepted(true);
            }}
          />
          <PrimaryButton className="mt-3" label="Not now" variant="ghost" onPress={onDecline} />
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
      {catalogStatus === 'cached' && catalogUpdatedAt ? (
        <GlassCard radius={22} className="mb-4 px-5 py-4">
          <Subheading>Offline products · Last updated {formatCachedTime(catalogUpdatedAt)}</Subheading>
          <Body className="mt-2">Prices and availability may have changed. Adding to bag and checkout are unavailable.</Body>
          <PrimaryButton className="mt-4" label="Try again" onPress={() => void shopifyStore.loadProducts()} />
        </GlassCard>
      ) : null}
      {error && catalogStatus !== 'cached' ? (
        <GlassCard radius={22} className="px-5 py-5">
          <Subheading>Shop unavailable</Subheading>
          <Body className="mt-2">{error}</Body>
          <PrimaryButton className="mt-4" label="Try again" onPress={() => void shopifyStore.loadProducts()} />
        </GlassCard>
      ) : null}
      {!loadingProducts && !error && catalogStatus === 'live' && products.length === 0 ? (
        <GlassCard radius={22} className="px-5 py-5">
          <Subheading>No products available</Subheading>
          <Body className="mt-2">The Shopify collection is empty right now.</Body>
          <PrimaryButton className="mt-4" label="Refresh" onPress={() => void shopifyStore.loadProducts()} />
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

function formatCachedTime(updatedAt: number): string {
  return new Date(updatedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
            accessibilityLabel={`Product photo, ${product.title}`}
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

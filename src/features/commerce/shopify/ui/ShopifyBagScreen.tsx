import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Body, Caption, Display, GlassCard, PrimaryButton, Subheading } from '../../../../components/ui';
import { catalog } from '../../../match/product-catalog';
import { ProductArt } from '../../../shop/ProductArt';
import { REVIEWED_MATCH_MAP } from '../match-map';
import { formatMoney } from '../money';
import { hasAcceptedShopPrivacy } from '../shop-privacy';
import { shopifyStore, useShopifyStore } from '../shopify-store';
import { usePresentCheckout } from '../use-present-checkout';

interface Props {
  readonly onShop: () => void;
}

export function ShopifyBagScreen({ onShop }: Props) {
  const privacyAccepted = hasAcceptedShopPrivacy();
  const { cart, loadingCart, error } = useShopifyStore();
  const present = usePresentCheckout();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (privacyAccepted) void shopifyStore.loadCart();
  }, [privacyAccepted]);

  if (!privacyAccepted) {
    return (
      <View className="flex-1 items-center justify-center px-7">
        <Display className="text-center">Open Shop first</Display>
        <Body className="mt-3 text-center">Review the Shop privacy notice before your Shopify bag loads.</Body>
        <PrimaryButton className="mt-6" label="Back to shop" onPress={onShop} />
      </View>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-7">
        <Display className="text-center">Your Shopify bag is empty</Display>
        {loadingCart ? <Body className="mt-3">Loading bag…</Body> : null}
        {error ? <Body className="mt-3 text-center">{error}</Body> : null}
        <PrimaryButton className="mt-6" label="Start shopping" onPress={onShop} />
      </View>
    );
  }

  const checkout = async (): Promise<void> => {
    setCheckoutError(null);
    try {
      const freshCart = await shopifyStore.refreshCart();
      if (!freshCart) throw new Error('Cart refresh failed');
      await present(freshCart.checkoutUrl);
    } catch {
      setCheckoutError('Checkout could not open. Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 42 }}>
      <Display>Shopify bag</Display>
      <Caption className="mb-5 mt-1">Guest checkout only</Caption>
      <View className="gap-3">
        {cart.lines.map((line) => (
          <GlassCard key={line.id} radius={22} className="flex-row items-center gap-4 px-4 py-4">
            <LocalProductArt shopifyProductId={line.merchandise.product.id} title={line.merchandise.product.title} />
            <View className="flex-1">
              <Caption>{line.merchandise.product.vendor}</Caption>
              <Subheading className="mt-1">{line.merchandise.product.title}</Subheading>
              <Body className="mt-1">{formatMoney(line.merchandise.price)} · Qty {line.quantity}</Body>
              <View className="mt-3 flex-row gap-3">
                <Text
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${line.merchandise.product.title}`}
                  onPress={() => void shopifyStore.updateLine(line.id, line.quantity - 1)}
                  className="font-body-semibold text-brand-greenDark"
                >Decrease</Text>
                <Text
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${line.merchandise.product.title}`}
                  onPress={() => void shopifyStore.updateLine(line.id, line.quantity + 1)}
                  className="font-body-semibold text-brand-greenDark"
                >Increase</Text>
              </View>
            </View>
          </GlassCard>
        ))}
      </View>
      <GlassCard radius={22} className="mt-5 px-5 py-4">
        <View className="flex-row justify-between"><Subheading>Subtotal</Subheading><Subheading>{formatMoney(cart.subtotal)}</Subheading></View>
      </GlassCard>
      {checkoutError ? <Body className="mt-4">{checkoutError}</Body> : null}
      <PrimaryButton className="mt-5" label={`Guest checkout · ${formatMoney(cart.subtotal)}`} onPress={() => void checkout()} />
      <PrimaryButton className="mt-3" label="Keep shopping" variant="glass" onPress={onShop} />
    </ScrollView>
  );
}

/** Deliberately local: Bag never requests or renders remote Shopify media. */
function LocalProductArt({ shopifyProductId, title }: { readonly shopifyProductId: string; readonly title: string }) {
  const localId = REVIEWED_MATCH_MAP.find((entry) => entry.shopifyProductId === shopifyProductId)?.localProductId;
  const localProduct = catalog.find((product) => product.id === localId);
  if (localProduct) return <View className="h-[72px] w-[72px]"><ProductArt product={localProduct} height={72} radius={18} /></View>;
  return (
    <View className="h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-brand-tint px-2">
      <Text numberOfLines={2} className="text-center font-body-semibold text-[10px] text-brand-greenDark">{title}</Text>
    </View>
  );
}

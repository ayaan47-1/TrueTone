// src/features/checkout/CheckoutScreen.tsx
// The Stripe checkout for the physical makeup bag.
// Uses native PaymentSheet via @stripe/stripe-react-native to keep raw card data out of the app.
// Fallback demo banner is removed; this is a real checkout flow (for physical goods only).
import { useRef, useState } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../../lib/supabase';
import {
  Screen,
  HEADER_CLEARANCE,
  GlassCard,
  Display,
  Heading,
  Subheading,
  Body,
  Caption,
  Eyebrow,
  PrimaryButton,
} from '../../components/ui';
import { bag, useBag, bagCount, bagSubtotal, lineKey, type BagState } from './bag-store';
import { Field } from './Field';
import { orderHistory } from './order-history-store';
import {
  EMPTY_SHIPPING_ADDRESS,
  SHIPPING_ADDRESS_LIMITS,
  getShippingAddressErrors,
  shippingAddressSchema,
  type ShippingAddressDraft,
  type ShippingAddressField,
} from '../../../supabase/functions/_shared/checkout/shipping-address';

/** A short human-readable pseudo order number (display only — not a real order). */
function makeOrderNumber(): string {
  return `TT-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function CheckoutScreen() {
  const router = useRouter();
  const state = useBag();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [placed, setPlaced] = useState<{ orderNo: string; total: number; items: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressDraft>({
    ...EMPTY_SHIPPING_ADDRESS,
  });
  const [touched, setTouched] = useState<Partial<Record<ShippingAddressField, boolean>>>({});
  // State updates land a render late, so a fast second tap would still see loading=false;
  // the ref blocks it synchronously (each tap creates a PaymentIntent + a pending order).
  const inFlight = useRef(false);
  const parsedAddress = shippingAddressSchema.safeParse(shippingAddress);
  const addressErrors = getShippingAddressErrors(shippingAddress);

  if (placed) return <Confirmation orderNo={placed.orderNo} onDone={() => router.replace('/')} />;

  if (bagCount(state) === 0) return <EmptyBag onBrowse={() => router.replace('/')} />;

  const placeOrder = async (): Promise<void> => {
    if (inFlight.current) return;
    const address = shippingAddressSchema.safeParse(shippingAddress);
    if (!address.success) {
      setTouched(Object.fromEntries(Object.keys(shippingAddress).map((key) => [key, true])));
      return;
    }
    inFlight.current = true;
    setLoading(true);
    try {
      // 1. Create PaymentIntent via edge function
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          items: state.lines,
          shippingAddress: address.data,
        },
      });

      if (error || !data?.paymentIntent) {
        throw new Error(error?.message || 'Failed to initialize payment');
      }

      // 2. Initialize PaymentSheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'TrueTone',
        paymentIntentClientSecret: data.paymentIntent,
        customerEphemeralKeySecret: data.ephemeralKey,
        customerId: data.customer,
        allowsDelayedPaymentMethods: true,
      });
      if (initError) throw new Error(initError.message);

      // 3. Present PaymentSheet
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') throw new Error(presentError.message);
        return; // User canceled
      }

      // Success
      setPlaced({ orderNo: makeOrderNumber(), total: bagSubtotal(state), items: bagCount(state) });
      void orderHistory.record(state.lines.map((l) => l.product.id));
      bag.clear();
    } catch (e) {
      Alert.alert('Payment Error', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const updateAddress = (field: ShippingAddressField, value: string): void => {
    setShippingAddress((current) => ({ ...current, [field]: value }));
  };

  const touchAddress = (field: ShippingAddressField): void => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const fieldError = (field: ShippingAddressField): string | undefined =>
    touched[field] ? addressErrors[field] : undefined;

  return (
    <Screen className="gap-6 px-6" topGap={HEADER_CLEARANCE} bottomGap={32}>
      <View className="gap-1">
        <Eyebrow>Checkout</Eyebrow>
        <Display>Review your order</Display>
      </View>

      <OrderSummary state={state} />

      <View className="gap-3">
        <Subheading>Shipping address</Subheading>
        <GlassCard className="gap-3 p-4" flat>
          <Field
            label="Full name"
            placeholder="Jordan Rivera"
            autoComplete="name"
            value={shippingAddress.name}
            onChangeText={(value) => updateAddress('name', value)}
            onBlur={() => touchAddress('name')}
            error={fieldError('name')}
            maxLength={SHIPPING_ADDRESS_LIMITS.name}
            testID="shipping-full-name"
          />
          <Field
            label="Address line 1"
            placeholder="123 Maple Street"
            autoComplete="address-line1"
            value={shippingAddress.line1}
            onChangeText={(value) => updateAddress('line1', value)}
            onBlur={() => touchAddress('line1')}
            error={fieldError('line1')}
            maxLength={SHIPPING_ADDRESS_LIMITS.line1}
            testID="shipping-line1"
          />
          <Field
            label="Address line 2 (optional)"
            placeholder="Apartment, suite, etc."
            autoComplete="address-line2"
            value={shippingAddress.line2}
            onChangeText={(value) => updateAddress('line2', value)}
            onBlur={() => touchAddress('line2')}
            error={fieldError('line2')}
            maxLength={SHIPPING_ADDRESS_LIMITS.line2}
            testID="shipping-line2"
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="City"
                placeholder="Chicago"
                autoComplete="postal-address-locality"
                value={shippingAddress.city}
                onChangeText={(value) => updateAddress('city', value)}
                onBlur={() => touchAddress('city')}
                error={fieldError('city')}
                maxLength={SHIPPING_ADDRESS_LIMITS.city}
                testID="shipping-city"
              />
            </View>
            <View className="w-24">
              <Field
                label="State"
                placeholder="IL"
                autoComplete="postal-address-region"
                autoCapitalize="characters"
                value={shippingAddress.state}
                onChangeText={(value) => updateAddress('state', value.toUpperCase())}
                onBlur={() => touchAddress('state')}
                error={fieldError('state')}
                maxLength={SHIPPING_ADDRESS_LIMITS.state}
                testID="shipping-state"
              />
            </View>
          </View>
          <Field
            label="ZIP code"
            placeholder="60601"
            autoComplete="postal-code"
            keyboardType="numbers-and-punctuation"
            value={shippingAddress.postalCode}
            onChangeText={(value) => updateAddress('postalCode', value)}
            onBlur={() => touchAddress('postalCode')}
            error={fieldError('postalCode')}
            maxLength={SHIPPING_ADDRESS_LIMITS.postalCode}
            testID="shipping-postal-code"
          />
          <Field
            label="Country"
            placeholder="US"
            autoComplete="country"
            autoCapitalize="characters"
            value={shippingAddress.country}
            onChangeText={(value) => updateAddress('country', value.toUpperCase())}
            onBlur={() => touchAddress('country')}
            error={fieldError('country')}
            maxLength={SHIPPING_ADDRESS_LIMITS.country}
            testID="shipping-country"
          />
        </GlassCard>
      </View>

      <PrimaryButton
        label={loading ? 'Processing...' : 'Pay securely with Stripe'}
        fullWidth
        disabled={loading || !parsedAddress.success}
        onPress={placeOrder}
        testID="place-order"
      />

      <Caption className="text-center text-ink-faint">
        This is a secure checkout. Your payment details are encrypted.
      </Caption>
    </Screen>
  );
}

/** Order summary — one row per bag line, then a subtotal. */
function OrderSummary({ state }: { state: BagState }) {
  return (
    <View className="gap-3">
      <Subheading>Order summary</Subheading>
      <GlassCard className="gap-3 p-4" flat>
        {state.lines.map((line) => (
          <View
            key={lineKey(line)}
            className="flex-row items-start justify-between gap-3"
            testID={`summary-${lineKey(line)}`}
          >
            <View className="flex-1">
              <Body className="text-ink">{line.product.name}</Body>
              <Caption className="text-ink-soft">
                {shadeLabel(line) ? `${shadeLabel(line)} · ` : ''}Qty {line.qty}
              </Caption>
            </View>
            <Body className="text-ink-soft">${line.product.price * line.qty}</Body>
          </View>
        ))}
        <View className="h-px bg-ink-faint/30" />
        <View className="flex-row items-center justify-between">
          <Body className="font-body-semibold text-ink">Subtotal</Body>
          <Heading testID="subtotal">${bagSubtotal(state)}</Heading>
        </View>
      </GlassCard>
    </View>
  );
}

/** Post-"Place order" confirmation state. */
function Confirmation({ orderNo, onDone }: { orderNo: string; onDone: () => void }) {
  return (
    <Screen className="gap-6 px-6" topGap={HEADER_CLEARANCE} bottomGap={32}>
      <View className="flex-1 items-center justify-center gap-4 py-16">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-green">
          <Display className="text-white">✓</Display>
        </View>
        <Heading className="text-center">Order placed</Heading>
        <Body className="text-center text-ink-soft">
          Thanks! Your order is being processed.
        </Body>
        <GlassCard className="items-center gap-1 px-6 py-4" flat>
          <Caption className="text-ink-soft">Order number</Caption>
          <Heading testID="order-number">{orderNo}</Heading>
        </GlassCard>
      </View>
      <PrimaryButton label="Back to shop" fullWidth onPress={onDone} testID="confirm-done" />
    </Screen>
  );
}

/** Shown when checkout is reached with an empty bag. */
function EmptyBag({ onBrowse }: { onBrowse: () => void }) {
  return (
    <Screen className="gap-6 px-6" topGap={HEADER_CLEARANCE} bottomGap={32}>
      <View className="flex-1 items-center justify-center gap-4 py-16">
        <Heading className="text-center">Your bag is empty</Heading>
        <Body className="text-center text-ink-soft">
          Add a shade from the shop to start a checkout.
        </Body>
      </View>
      <PrimaryButton label="Browse the shop" fullWidth onPress={onBrowse} testID="browse-shop" />
    </Screen>
  );
}

/** The shade the user picked on the product page, else the product's default shade. */
function shadeLabel(line: BagState['lines'][number]): string | undefined {
  return line.shade ?? line.product.shadeName;
}

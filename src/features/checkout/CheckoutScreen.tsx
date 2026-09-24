// src/features/checkout/CheckoutScreen.tsx
// The Stripe checkout for the physical makeup bag.
// Uses native PaymentSheet via @stripe/stripe-react-native to keep raw card data out of the app.
// Server-side pricing computes amounts from the trusted product catalog.
import { useState, useRef } from 'react';
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
import { bag, useBag, bagCount, bagSubtotal, type BagState } from './bag-store';
import { Field } from './Field';

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
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
  });
  const shippingRef = useRef(shippingAddress);
  shippingRef.current = shippingAddress;

  const updateShipping = (key: keyof typeof shippingAddress, value: string) => {
    shippingRef.current = { ...shippingRef.current, [key]: value };
    setShippingAddress((s) => ({ ...s, [key]: value }));
  };

  if (placed) return <Confirmation orderNo={placed.orderNo} onDone={() => router.replace('/')} />;

  if (bagCount(state) === 0) return <EmptyBag onBrowse={() => router.replace('/')} />;

  const placeOrder = async (): Promise<void> => {
    setLoading(true);
    try {
      const addr = shippingRef.current;
      // 1. Create PaymentIntent via edge function (server computes price from catalog)
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { 
          items: state.lines,
          shippingAddress: addr.name ? addr : null,
        }
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
        return; // User canceled gracefully
      }

      // 4. Success: order placed, clear bag
      bag.clear();
      setLoading(false);
      setPlaced({ orderNo: makeOrderNumber(), total: bagSubtotal(state), items: bagCount(state) });
    } catch (e) {
      setLoading(false);
      Alert.alert('Payment Error', e instanceof Error ? e.message : 'Something went wrong');
    }
  };

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
            onChangeText={(v) => updateShipping('name', v)}
            testID="shipping-name"
          />
          <Field
            label="Address"
            placeholder="123 Maple Street"
            autoComplete="street-address"
            value={shippingAddress.street}
            onChangeText={(v) => updateShipping('street', v)}
            testID="shipping-street"
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="City"
                placeholder="Chicago"
                value={shippingAddress.city}
                onChangeText={(v) => updateShipping('city', v)}
                testID="shipping-city"
              />
            </View>
            <View className="w-24">
              <Field
                label="State"
                placeholder="IL"
                autoCapitalize="characters"
                maxLength={2}
                value={shippingAddress.state}
                onChangeText={(v) => updateShipping('state', v)}
                testID="shipping-state"
              />
            </View>
          </View>
          <Field
            label="ZIP code"
            placeholder="60601"
            keyboardType="number-pad"
            maxLength={5}
            value={shippingAddress.zip}
            onChangeText={(v) => updateShipping('zip', v)}
            testID="shipping-zip"
          />
        </GlassCard>
      </View>

      <PrimaryButton 
        label={loading ? 'Processing...' : 'Pay securely with Stripe'} 
        fullWidth 
        onPress={placeOrder} 
        disabled={loading}
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
            key={line.product.id}
            className="flex-row items-start justify-between gap-3"
            testID={`summary-${line.product.id}`}
          >
            <View className="flex-1">
              <Body className="text-ink">{line.product.name}</Body>
              <Caption className="text-ink-soft">
                {line.product.shadeName ? `${line.product.shadeName} · ` : ''}Qty {line.qty}
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

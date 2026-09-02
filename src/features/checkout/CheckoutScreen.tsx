// src/features/checkout/CheckoutScreen.tsx
// The mock checkout SHELL for the makeup preview. It LOOKS and FLOWS like checkout but
// processes NOTHING: no StoreKit, no PSP, no card capture, no backend (task boundary +
// CLAUDE.md — this is cosmetic-app checkout UI, not a real payment surface).
//
// Flow: order summary (bag line items) -> shipping form -> an explicitly-labelled DEMO
// payment section (no editable card fields) -> "Place order" -> an in-screen confirmation.
// The payment section deliberately renders as a disabled demo so it can never be mistaken
// for real payment collection.
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
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
  const [placed, setPlaced] = useState<{ orderNo: string; total: number; items: number } | null>(
    null,
  );

  if (placed) return <Confirmation orderNo={placed.orderNo} onDone={() => router.replace('/')} />;

  if (bagCount(state) === 0) return <EmptyBag onBrowse={() => router.replace('/')} />;

  const placeOrder = (): void => {
    // MOCK: snapshot the totals for the receipt, empty the bag, show confirmation.
    // Nothing is charged, sent, or persisted.
    setPlaced({ orderNo: makeOrderNumber(), total: bagSubtotal(state), items: bagCount(state) });
    bag.clear();
  };

  return (
    <Screen className="gap-6 px-6" bottomGap={32}>
      <View className="gap-1">
        <Eyebrow>Checkout</Eyebrow>
        <Display>Review your order</Display>
      </View>

      <OrderSummary state={state} />

      <View className="gap-3">
        <Subheading>Shipping address</Subheading>
        <GlassCard className="gap-3 p-4" flat>
          <Field label="Full name" placeholder="Jordan Rivera" autoComplete="name" />
          <Field label="Address" placeholder="123 Maple Street" autoComplete="street-address" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="City" placeholder="Chicago" />
            </View>
            <View className="w-24">
              <Field label="State" placeholder="IL" autoCapitalize="characters" maxLength={2} />
            </View>
          </View>
          <Field
            label="ZIP code"
            placeholder="60601"
            keyboardType="number-pad"
            maxLength={5}
          />
        </GlassCard>
      </View>

      <PaymentDemo />

      <PrimaryButton label="Place order" fullWidth onPress={placeOrder} testID="place-order" />

      <Caption className="text-center text-ink-faint">
        This is a preview checkout. No payment is processed and no order is shipped.
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

/**
 * The DEMO payment section. Intentionally NOT a card-capture form: it shows a visible
 * demo banner and a single disabled, non-editable "payment method" row so the screen
 * reads and flows like checkout while collecting no real payment credentials.
 */
function PaymentDemo() {
  return (
    <View className="gap-3">
      <Subheading>Payment</Subheading>
      <GlassCard className="gap-3 p-4" flat>
        <View className="rounded-2xl bg-clay/15 px-4 py-3" testID="demo-payment-banner">
          <Caption className="font-body-semibold text-clay">
            Demo checkout — no real payment is processed
          </Caption>
        </View>
        <View className="flex-row items-center justify-between opacity-50">
          <Body className="text-ink-soft">Payment method</Body>
          <Body className="text-ink-soft">Demo card ···· ···· ···· 0000</Body>
        </View>
        <Caption className="text-ink-faint">
          This preview collects no card details and charges nothing.
        </Caption>
      </GlassCard>
    </View>
  );
}

/** Post-"Place order" confirmation state. */
function Confirmation({ orderNo, onDone }: { orderNo: string; onDone: () => void }) {
  return (
    <Screen className="gap-6 px-6" bottomGap={32}>
      <View className="flex-1 items-center justify-center gap-4 py-16">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-green">
          <Display className="text-white">✓</Display>
        </View>
        <Heading className="text-center">Order placed</Heading>
        <Body className="text-center text-ink-soft">
          Thanks! This was a demo order — nothing was charged and nothing ships.
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
    <Screen className="gap-6 px-6" bottomGap={32}>
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

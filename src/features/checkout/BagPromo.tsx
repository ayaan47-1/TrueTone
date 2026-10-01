// src/features/checkout/BagPromo.tsx
// v3 bag promo + totals (frame t-08): a code field with an Apply → "Applied" state, then a
// card with Subtotal / Discount (15%) / Shipping / Total. DEMO ONLY — the math lives in
// promo.ts; DEMO_PROMO_LABEL sits under the promo field (Dwight's v3 demo-content ruling) and
// DEMO_TOTALS_LABEL + SAMPLE_CATALOG_LABEL close the totals card so shipping is covered too.
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Caption, GlassCard, PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { DEMO_PROMO_LABEL, DEMO_TOTALS_LABEL, SAMPLE_CATALOG_LABEL } from '../shop/sample-content';
import { PROMO_PERCENT, formatCents, isPromoCode, type BagTotals } from './promo';

interface PromoFieldProps {
  applied: boolean;
  onApply: () => void;
}

export function PromoField({ applied, onApply }: PromoFieldProps) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const apply = () => {
    if (isPromoCode(code)) onApply();
    else setInvalid(true);
  };
  return (
    <View>
      <View className="flex-row gap-2.5">
        <TextInput
          accessibilityLabel="Promo code"
          value={code}
          editable={!applied}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Promo code"
          placeholderTextColor={palette.inkSoft}
          onChangeText={(t) => {
            setCode(t);
            setInvalid(false);
          }}
          onSubmitEditing={apply}
          className="flex-1 rounded-[16px] border border-brand-green bg-white/70 px-4 py-3 font-body-semibold text-[15px] text-ink"
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={applied ? 'Promo code applied' : 'Apply promo code'}
          accessibilityState={{ disabled: applied || !code.trim() }}
          disabled={applied || !code.trim()}
          onPress={apply}
          className="min-w-[110px] items-center justify-center rounded-[16px] bg-white/50 px-4"
        >
          <Text className={'font-body-semibold text-[15px] ' + (applied ? 'text-ink-soft' : 'text-ink')}>
            {applied ? 'Applied' : 'Apply'}
          </Text>
        </PressableScale>
      </View>
      {invalid ? <Caption className="mt-1.5">That code isn’t valid.</Caption> : null}
      <Caption className="mt-1.5">{DEMO_PROMO_LABEL}</Caption>
    </View>
  );
}

function Row({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className={`font-body text-[15px] ${tone}`}>{label}</Text>
      <Text className={`font-body text-[15px] ${tone}`}>{value}</Text>
    </View>
  );
}

export function BagSummary({ totals }: { totals: BagTotals }) {
  return (
    <GlassCard testID="bag-summary" radius={22} className="px-[18px] py-3.5">
        <Row label="Subtotal" value={formatCents(totals.subtotalCents)} tone="text-ink-soft" />
        {totals.discountCents ? (
          <Row label={`Discount (${PROMO_PERCENT}%)`} value={`−${formatCents(totals.discountCents)}`} tone="text-brand-greenDark" />
        ) : null}
        <Row label="Shipping" value={totals.shippingCents ? formatCents(totals.shippingCents) : 'Free'} tone="text-ink-soft" />
        {totals.freeShippingGapCents ? (
          <Caption>Add {formatCents(totals.freeShippingGapCents)} more for free shipping</Caption>
        ) : null}
        <View className="mt-2.5 flex-row justify-between border-t border-ink-faint/20 pt-3">
          <Text className="font-display text-[18px] text-ink">Total</Text>
          <Text className="font-display text-[18px] text-ink">{formatCents(totals.totalCents)}</Text>
        </View>
        <Caption className="mt-2.5">{DEMO_TOTALS_LABEL}</Caption>
        <Caption className="mt-1 text-[11px] text-ink-faint">{SAMPLE_CATALOG_LABEL}</Caption>
    </GlassCard>
  );
}

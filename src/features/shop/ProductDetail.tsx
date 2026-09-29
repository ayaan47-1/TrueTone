// src/features/shop/ProductDetail.tsx
// Quiet Glass v3 product page (ProductV3 port): full-bleed drawn art, line + title + price,
// a fit card, a shade picker, quantity, "Why it fits you" / Details / How to use, and a
// pinned "Add to bag · $X" CTA. Consumes only the derived MatchProfile — never the image.
// Left out of the kit on purpose: star ratings + review counts (no real review data), the
// "In stock" pill (no inventory data), the numeric "% fit" and its bar (tiers only), and
// the image-pager dots (there is one drawing, not a gallery).
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Body, Caption, Heading, PressableScale, PrimaryButton } from '../../components/ui';
import { useInsets } from '../../components/ui/use-insets';
import { CameraGlyph } from '../../components/ui/tab-icons';
import { palette } from '../../theme/tokens';
import type { MatchProfile } from '../match/match-types';
import { catalog } from '../match/product-catalog';
import { scoreProduct } from '../match/scoring';
import { fitReason } from '../match/fit-reason';
import { fitTier } from '../match/fit-tier';
import { CATEGORY_LABELS, FINISH_LABELS, FIT_TIER_LABELS } from '../../content/makeup-vocab';
import { bag } from '../checkout/bag-store';
import { ProductArt } from './ProductArt';
import { productLine } from './product-visual';
import { defaultShadeIndex, shadeOptions, type ShadeOption } from './shade-options';
import { Accordion } from './Accordion';
import { Stepper } from './Stepper';
import { CheckGlyph } from './shop-icons';

interface ProductDetailProps {
  productId: string;
  /** Present only after a scan. */
  profile?: MatchProfile;
  /** The user's derived shade label, e.g. "Golden 6W" (post-scan). */
  shadeName?: string;
  onScan: () => void;
  onAdded: () => void;
}

/** Keyed so the shade/qty state resets when the product changes or a scan lands mid-visit. */
export function ProductDetail(props: ProductDetailProps) {
  return <ProductPage key={`${props.productId}:${props.profile?.shade ?? ''}`} {...props} />;
}

function ProductPage({ productId, profile, shadeName, onScan, onAdded }: ProductDetailProps) {
  const product = catalog.find((p) => p.id === productId);
  const insets = useInsets();
  const options = product ? shadeOptions(product, profile) : [];
  const [shade, setShade] = useState(() => defaultShadeIndex(options));
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Heading className="text-center">This product isn’t available</Heading>
        <Body className="mt-2 text-center">Head back to the shop to keep browsing.</Body>
      </View>
    );
  }

  const { line, title } = productLine(product);
  const picked = options[shade];
  const reason = profile ? fitReason(product, profile) : null;

  const add = (): void => {
    bag.add(product, qty, picked?.label);
    onAdded();
  };

  return (
    <View className="flex-1 bg-mist-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}>
        <ProductArt product={product} height={360} radius={0} />
        <View className="-mt-7 rounded-t-[28px] bg-mist-50 px-6 pt-6">
          {line ? <Text className="font-body-semibold text-[11px] uppercase tracking-[1.4px] text-sage">{line}</Text> : null}
          <Heading className="mt-2">{title}</Heading>
          <View className="mt-2.5 flex-row items-center justify-between">
            <Caption>
              {FINISH_LABELS[product.finish]} finish · {CATEGORY_LABELS[product.category]}
            </Caption>
            <Text className="font-display text-[26px] tracking-[-0.5px] text-ink">${product.price}</Text>
          </View>

          {profile && reason ? (
            <View className="mt-5 rounded-card bg-brand-tint px-4 py-3.5">
              <Text testID="fit-tier" className="font-body-bold text-[14px] text-brand-greenDark">
                {FIT_TIER_LABELS[fitTier(scoreProduct(product, profile))]}
                {shadeName ? ` for ${shadeName}` : ''}
              </Text>
              <Text className="mt-1.5 font-body text-[13px] text-brand-greenDark">{reason}</Text>
            </View>
          ) : (
            <ScanPrompt onScan={onScan} />
          )}

          <ShadePicker options={options} selected={shade} onSelect={setShade} scanned={!!profile} />

          <View className="mt-5 flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-ink-soft">Quantity</Text>
            <Stepper value={qty} min={1} onChange={setQty} label="Quantity" />
          </View>

          <View className="mt-5">
            <Accordion title="Why it fits you" initiallyOpen>
              <Body>
                {reason
                  ? `${reason}. Picked using your undertone, depth and the finish you prefer.`
                  : 'Scan your shade to see a personal fit explanation.'}
              </Body>
            </Accordion>
            <Accordion title="Details">
              <Body>
                {FINISH_LABELS[product.finish]} finish. Available in {options.length} {options.length === 1 ? 'shade' : 'shades'}.
              </Body>
            </Accordion>
            <Accordion title="How to use">
              <Body>Warm a small amount between fingertips and press onto skin, starting at the center of the face.</Body>
            </Accordion>
          </View>
        </View>
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-ink-faint/20 bg-mist-50/95 px-5 pt-3"
        style={{ paddingBottom: 16 + insets.bottom }}
      >
        <PrimaryButton label={`Add to bag · $${product.price * qty}`} fullWidth onPress={add} />
      </View>
    </View>
  );
}

function ScanPrompt({ onScan }: { onScan: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Scan to see your fit"
      onPress={onScan}
      className="mt-5 flex-row items-center gap-3 rounded-card bg-mist-300 px-4 py-3.5"
    >
      <CameraGlyph color={palette.mauve700} size={20} />
      <View className="flex-1">
        <Text className="font-body-semibold text-[14px] text-ink">Will this suit you?</Text>
        <Caption className="text-ink-soft">Scan once to see your fit</Caption>
      </View>
      <View className="rounded-full bg-ink px-3.5 py-2">
        <Text className="font-body-semibold text-[12px] text-white">Scan</Text>
      </View>
    </PressableScale>
  );
}

interface ShadePickerProps {
  options: readonly ShadeOption[];
  selected: number;
  onSelect: (i: number) => void;
  scanned: boolean;
}

function ShadePicker({ options, selected, onSelect, scanned }: ShadePickerProps) {
  const picked = options[selected];
  return (
    <View className="mt-6">
      <Text className="font-body text-[14px] text-ink-soft">
        Shade · <Text testID="selected-shade" className="font-body-semibold text-ink">{picked?.label}</Text>
        {picked?.isYourMatch && scanned ? <Text className="font-body-semibold text-sage"> · Your match</Text> : null}
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-3">
        {options.map((o, i) => (
          <PressableScale
            key={o.label}
            accessibilityRole="button"
            accessibilityLabel={`Shade ${o.label}`}
            accessibilityState={{ selected: i === selected }}
            onPress={() => onSelect(i)}
            className="h-12 w-12 items-center justify-center"
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 2,
                borderColor: i === selected ? palette.ink : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: o.color }} />
            </View>
            {o.isYourMatch && scanned ? (
              <View className="absolute right-0 top-0 h-4 w-4 items-center justify-center rounded-full border-2 border-mist-50 bg-sage">
                <CheckGlyph color={palette.white} size={6} />
              </View>
            ) : null}
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

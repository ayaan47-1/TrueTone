// src/features/shop/ProductDetail.tsx
// Quiet Glass v3 product page (ProductV3 port, frames t-11/t-12): photo gallery with page
// dots, floating Back / Share / Save, line + a "Sample" pill (no stock claim; the catalog is sample) + title, a sample
// rating (only behind SAMPLE_RATINGS_ENABLED, with its label) + price, a fit card, a shade
// picker, size chips, quantity, "Why it fits you" / Details / How to use, and a pinned
// "Add to bag · $X" CTA. Consumes only the derived MatchProfile — never the image. Fit is a
// tier word only: no numeric "% fit" and no fit bar (Dwight's ruling, PR #38). The Back
// button floats over the art so the modal always has a visible way out.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, Text, View, type PressableProps } from 'react-native';
import { Body, Caption, GlassSurface, Heading, PressableScale, PrimaryButton, Eyebrow } from '../../components/ui';
import { useInsets } from '../../components/ui/use-insets';
import { hasLiquidGlass } from '../../components/ui/liquid-glass';
import { CameraGlyph } from '../../components/ui/tab-icons';
import { glass, palette, softShadow } from '../../theme/tokens';
import type { MatchProfile } from '../match/match-types';
import { catalog } from '../match/product-catalog';
import { scoreProduct } from '../match/scoring';
import { fitReason } from '../match/fit-reason';
import { fitTier } from '../match/fit-tier';
import { CATEGORY_LABELS, FINISH_LABELS, FIT_TIER_LABELS } from '../../content/makeup-vocab';
import { bag } from '../checkout/bag-store';
import { ProductGallery } from './ProductGallery';
import { HeartButton } from './HeartButton';
import { SampleRatingLine } from './SampleRatingLine';
import { SAMPLE_CATALOG_LABEL, productSizes } from './sample-content';
import { productLine } from './product-visual';
import { defaultShadeIndex, shadeOptions, type ShadeOption } from './shade-options';
import { Accordion } from './Accordion';
import { Stepper } from './Stepper';
import { CheckGlyph, ChevronGlyph } from './shop-icons';

interface ProductDetailProps {
  productId: string;
  /** Present only after a scan. */
  profile?: MatchProfile;
  /** The user's derived shade label, e.g. "Golden 6W" (post-scan). */
  shadeName?: string;
  onScan: () => void;
  onAdded: () => void;
  /** Dismisses the sheet (the floating back button). */
  onClose: () => void;
  /** Sample ratings; defaults to the SAMPLE_RATINGS_ENABLED build flag. */
  showRatings?: boolean;
}

/** Keyed so the shade/qty state resets when the product changes or a scan lands mid-visit. */
export function ProductDetail(props: ProductDetailProps) {
  return <ProductPage key={`${props.productId}:${props.profile?.shade ?? ''}`} {...props} />;
}

function ProductPage({ productId, profile, shadeName, onScan, onAdded, onClose, showRatings }: ProductDetailProps) {
  const product = catalog.find((p) => p.id === productId);
  const insets = useInsets();
  const options = product ? shadeOptions(product, profile) : [];
  const [shade, setShade] = useState(() => defaultShadeIndex(options));
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState(0);

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Heading className="text-center">This product isn’t available</Heading>
        <Body className="mt-2 text-center">Head back to the shop to keep browsing.</Body>
        <BackButton onPress={onClose} top={insets.top + 8} />
      </View>
    );
  }

  const { line, title } = productLine(product);
  const picked = options[shade];
  const reason = profile ? fitReason(product, profile) : null;
  const tier = profile ? fitTier(scoreProduct(product, profile)) : null;
  const sizes = productSizes(product);
  const share = (): void => {
    Share.share({ message: `${product.name} — $${product.price} on TrueTone (sample catalog)` }).catch(() => undefined);
  };

  const add = (): void => {
    bag.add(product, qty, picked?.label);
    onAdded();
  };

  return (
    <View className="flex-1 bg-mist-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}>
        <ProductGallery product={product} height={380} />
        <View className="-mt-7 rounded-t-[28px] bg-mist-50 px-6 pt-6">
          <View className="flex-row items-center justify-between">
            <Eyebrow>{line}</Eyebrow>
            <View className="rounded-full bg-brand-tint px-2.5 py-1">
              <Text className="font-body-semibold text-[11.5px] text-brand-greenDark">Sample</Text>
            </View>
          </View>
          <Heading className="mt-2">{title}</Heading>
          <View className="mt-2.5 flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <SampleRatingLine productId={product.id} enabled={showRatings} size={13} />
              <Caption>
                {FINISH_LABELS[product.finish]} finish · {CATEGORY_LABELS[product.category]}
              </Caption>
            </View>
            <Text className="font-display text-[26px] tracking-[-0.5px] text-ink">${product.price}</Text>
          </View>
          <Caption testID="sample-catalog-label" className="mt-1.5 text-[11px] text-ink-soft">{SAMPLE_CATALOG_LABEL}</Caption>

          {tier && reason ? (
            <View className="mt-5 rounded-card bg-brand-tint px-4 py-3.5">
              <View className="flex-row items-baseline justify-between gap-2">
                <Text testID="fit-tier" className="flex-1 font-body-bold text-[14px] text-brand-greenDark">
                  {FIT_TIER_LABELS[tier]}
                  {shadeName ? ` for ${shadeName}` : ''}
                </Text>
                {tier === 'great' ? (
                  <Text testID="fit-your-match" className="font-body text-[12px] text-brand-greenDark">Your match</Text>
                ) : null}
              </View>
              <Text className="mt-1.5 font-body text-[13px] text-brand-greenDark">{reason}</Text>
            </View>
          ) : (
            <ScanPrompt onScan={onScan} />
          )}

          <ShadePicker options={options} selected={shade} onSelect={setShade} scanned={!!profile} />
          {sizes.length ? <SizePicker sizes={sizes} selected={size} onSelect={setSize} /> : null}

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
      <BackButton onPress={onClose} top={insets.top + 8} />
      <View className="absolute right-5 flex-row gap-2.5" style={{ top: insets.top + 8 }}>
        <FloatingIconButton accessibilityLabel="Share" onPress={share}>
          <Text className="font-body-bold text-[17px] text-ink">↗</Text>
        </FloatingIconButton>
        <View style={[{ borderRadius: 21 }, softShadow]}>
          <HeartButton productId={product.id} name={product.name} size={42} />
        </View>
      </View>
    </View>
  );
}

function SizePicker({ sizes, selected, onSelect }: { sizes: readonly string[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <View className="mt-5">
      <Text className="font-body text-[14px] text-ink-soft">Size</Text>
      <View className="mt-2.5 flex-row gap-2.5">
        {sizes.map((s, i) => {
          const on = i === selected;
          return (
            <PressableScale
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Size ${s}`}
              accessibilityState={{ selected: on }}
              onPress={() => onSelect(i)}
            >
              <View className={'rounded-[14px] border px-[18px] py-[9px] ' + (on ? 'border-ink bg-ink' : 'border-ink-faint bg-transparent')}>
                <Text className={'font-body-semibold text-[13px] ' + (on ? 'text-white' : 'text-ink-soft')}>{s}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** 42px glass circle over the art (kit IconBtn3), for Share. */
function FloatingIconButton({ children, ...rest }: PressableProps & { children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      style={[{ width: 42, height: 42, borderRadius: 21 }, hasLiquidGlass() ? null : { backgroundColor: glass.fillStrong }, softShadow]}
      {...rest}
    >
      <GlassSurface
        interactive
        intensity={0}
        style={{ flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
        fallbackStyle={{ borderWidth: 1, borderColor: glass.edge }}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}

/** Kit IconBtn: a 48px glass circle pinned over the art, outside the scroll so it never scrolls away. */
function BackButton({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      hitSlop={4}
      style={[
        { position: 'absolute', top, left: 20, width: 48, height: 48, borderRadius: 24 },
        // Fallback fill lives on the shadow-bearing view so Android elevation still draws.
        hasLiquidGlass() ? null : { backgroundColor: glass.fillStrong },
        softShadow,
      ]}
    >
      <GlassSurface
        interactive
        intensity={0}
        style={{ flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
        fallbackStyle={{ borderWidth: 1, borderColor: glass.edge }}
      >
        <View style={{ marginLeft: 3 }}>
          <ChevronGlyph color={palette.ink} size={9} dir="left" />
        </View>
      </GlassSurface>
    </Pressable>
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

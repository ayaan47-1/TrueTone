// src/features/shop/SampleRatingLine.tsx
// The kit's Stars3 ("★ 4.8 (320)") — SAMPLE data only. Per Dwight's v3 demo-content ruling it
// renders nothing unless sample ratings are enabled, and then always with the ruled
// "Sample data — not real ratings or reviews." label right beside it.
import { Text, View } from 'react-native';
import { palette } from '../../theme/tokens';
import { SAMPLE_RATINGS_ENABLED, SAMPLE_RATINGS_LABEL, sampleRating } from './sample-content';

interface SampleRatingLineProps {
  productId: string;
  /** Defaults to the build flag; tests and previews may force it. */
  enabled?: boolean;
  size?: number;
}

export function SampleRatingLine({ productId, enabled = SAMPLE_RATINGS_ENABLED, size = 11.5 }: SampleRatingLineProps) {
  if (!enabled) return null;
  const { rating, reviews } = sampleRating(productId);
  return (
    <View testID="sample-rating">
      <View className="flex-row items-center gap-1">
        <Text style={{ fontSize: size, color: palette.clay }}>★</Text>
        <Text className="font-body-semibold text-ink" style={{ fontSize: size }}>{String(rating)}</Text>
        <Text className="font-body text-ink-soft" style={{ fontSize: size }}>{`(${reviews.toLocaleString('en-US')})`}</Text>
      </View>
      <Text className="font-body text-ink-soft" style={{ fontSize: size - 2 }}>{SAMPLE_RATINGS_LABEL}</Text>
    </View>
  );
}

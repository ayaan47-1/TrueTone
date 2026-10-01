// src/features/shop/HeartButton.tsx
// The v3 kit's HeartBtn3: a small white circle with a heart that saves / unsaves a product
// to the in-memory wishlist. Text glyphs (♥ / ♡) keep it asset-free, like the kit's ★.
import { Text, View } from 'react-native';
import { PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { useWishlist, wishlist } from './wishlist-store';

interface HeartButtonProps {
  productId: string;
  /** Product name for the accessibility label. */
  name: string;
  size?: number;
}

export function HeartButton({ productId, name, size = 30 }: HeartButtonProps) {
  const saved = useWishlist().includes(productId);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${name} from saved` : `Save ${name}`}
      accessibilityState={{ selected: saved }}
      onPress={() => wishlist.toggle(productId)}
      hitSlop={6}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.88)',
        }}
      >
        <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62, color: saved ? palette.clay : palette.inkSoft }}>
          {saved ? '♥' : '♡'}
        </Text>
      </View>
    </PressableScale>
  );
}

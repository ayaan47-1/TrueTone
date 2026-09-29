// src/features/community/components/MediaPlaceholder.tsx
// Local media for a post -- a bundled photo when the item has one, otherwise a swatch tile.
// Deliberately never fetches or renders a network image/video: Community's media pipeline
// (upload, storage, playback) doesn't exist yet, so seed posts only use `require()`d assets.
// One item renders full card width (v3 frame t-14); several become a paged carousel.
import { useState } from 'react';
import { Image, ScrollView, View, useWindowDimensions, type DimensionValue } from 'react-native';
import { Caption } from '../../../components/ui';
import type { CommunityMediaItem } from '../community-types';

interface MediaPlaceholderProps {
  media: readonly CommunityMediaItem[];
}

const MEDIA_HEIGHT = 300;

function MediaTile({ item, width }: { item: CommunityMediaItem; width: DimensionValue }) {
  return (
    <View
      testID={`media-tile-${item.id}`}
      style={{ width, height: MEDIA_HEIGHT, backgroundColor: item.swatch }}
      className="rounded-3xl overflow-hidden items-center justify-end p-4"
    >
      {item.image !== undefined ? (
        <Image
          testID={`media-image-${item.id}`}
          source={item.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        />
      ) : null}
      <View className="rounded-full bg-white/70 px-3 py-1">
        <Caption className="text-ink-muted">{item.kind === 'video' ? `▶ ${item.label}` : item.label}</Caption>
      </View>
    </View>
  );
}

export function MediaPlaceholder({ media }: MediaPlaceholderProps) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const tileWidth = Math.min(width - 48, 320);

  if (media.length === 0) return null;
  if (media.length === 1) return <MediaTile item={media[0]} width="100%" />;

  return (
    <View className="gap-2">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / tileWidth);
          setActiveIndex(Math.max(0, Math.min(index, media.length - 1)));
        }}
      >
        {media.map((item) => (
          <MediaTile key={item.id} item={item} width={tileWidth} />
        ))}
      </ScrollView>
      {media.length > 1 ? (
        <View className="flex-row justify-center gap-1.5">
          {media.map((item, index) => (
            <View
              key={item.id}
              testID={`media-dot-${index}`}
              className={`h-1.5 rounded-full ${index === activeIndex ? 'w-4 bg-ink' : 'w-1.5 bg-ink-faint'}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

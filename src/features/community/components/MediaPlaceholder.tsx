// src/features/community/components/MediaPlaceholder.tsx
// Local media carousel for a post -- swatch tiles standing in for real photo/video
// content. Deliberately never fetches or renders a network image/video: Community's
// media pipeline (upload, storage, playback) doesn't exist yet, so this stays a visual
// placeholder rather than a half-working media player.
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Caption } from '../../../components/ui';
import type { CommunityMediaItem } from '../community-types';

interface MediaPlaceholderProps {
  media: readonly CommunityMediaItem[];
}

export function MediaPlaceholder({ media }: MediaPlaceholderProps) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const tileWidth = Math.min(width - 48, 320);

  if (media.length === 0) return null;

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
          <View
            key={item.id}
            testID={`media-tile-${item.id}`}
            style={{ width: tileWidth, height: tileWidth * 1.1, backgroundColor: item.swatch }}
            className="rounded-3xl items-center justify-end p-4"
          >
            <View className="rounded-full bg-white/70 px-3 py-1">
              <Caption>{item.kind === 'video' ? `▶ ${item.label}` : item.label}</Caption>
            </View>
          </View>
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

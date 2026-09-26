// src/features/community/components/EngagementBar.tsx
// Like/save/share row for a post card. Purely presentational + local-callback driven --
// see use-community-feed.ts for where the counts actually live (no backend table yet).
import { View } from 'react-native';
import { Caption, PressableScale } from '../../../components/ui';
import { palette } from '../../../theme/tokens';
import { HeartGlyph, BookmarkGlyph, ShareGlyph } from '../community-icons';
import type { PostEngagement } from '../use-community-feed';

interface EngagementBarProps {
  engagement: PostEngagement;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onShare: () => void;
}

export function EngagementBar({ engagement, onToggleLike, onToggleSave, onShare }: EngagementBarProps) {
  const activeColor = palette.sageInk;
  const idleColor = palette.mauve500;

  return (
    <View className="flex-row items-center gap-5 mt-2">
      <PressableScale
        testID="engagement-like"
        accessibilityRole="button"
        accessibilityLabel={engagement.liked ? 'Unlike' : 'Like'}
        onPress={onToggleLike}
        hitSlop={8}
      >
        <View className="flex-row items-center gap-1.5">
          <HeartGlyph color={engagement.liked ? activeColor : idleColor} filled={engagement.liked} />
          <Caption className="text-ink-soft">{engagement.likeCount}</Caption>
        </View>
      </PressableScale>

      <PressableScale
        testID="engagement-save"
        accessibilityRole="button"
        accessibilityLabel={engagement.saved ? 'Unsave' : 'Save'}
        onPress={onToggleSave}
        hitSlop={8}
      >
        <View className="flex-row items-center gap-1.5">
          <BookmarkGlyph color={engagement.saved ? activeColor : idleColor} filled={engagement.saved} />
          <Caption className="text-ink-soft">{engagement.saveCount}</Caption>
        </View>
      </PressableScale>

      <PressableScale
        testID="engagement-share"
        accessibilityRole="button"
        accessibilityLabel="Share"
        onPress={onShare}
        hitSlop={8}
      >
        <View className="flex-row items-center gap-1.5">
          <ShareGlyph color={idleColor} />
          {engagement.shareCount > 0 ? <Caption className="text-ink-soft">{engagement.shareCount}</Caption> : null}
        </View>
      </PressableScale>
    </View>
  );
}

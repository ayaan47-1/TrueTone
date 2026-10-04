// src/features/community/components/PostCard.tsx
// One Feed/Videos card: creator header, media carousel, caption, engagement bar, and a
// "Shop the look" trigger when the post has tagged products.
import { View } from 'react-native';
import { Body, GlassCard, PressableScale, Caption } from '../../../components/ui';
import { CreatorHeader } from './CreatorHeader';
import { MediaPlaceholder } from './MediaPlaceholder';
import { EngagementBar } from './EngagementBar';
import type { CommunityPost } from '../community-types';
import type { PostEngagement } from '../use-community-feed';

interface PostCardProps {
  post: CommunityPost;
  engagement: PostEngagement;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onShopTheLook: () => void;
  showCounts?: boolean;
}

export function PostCard({ post, engagement, onToggleLike, onToggleSave, onShare, onShopTheLook, showCounts }: PostCardProps) {
  return (
    <GlassCard flat radius={26} className="px-5 py-5 gap-3">
      <CreatorHeader creator={post.creator} color={post.creatorColor} />
      <MediaPlaceholder media={post.media} />
      <Body className="text-ink">{post.caption}</Body>
      {/* Wraps on narrow phones so "Shop the look" drops below rather than clipping like/save. */}
      <View testID="post-actions" className="flex-row flex-wrap items-center justify-between gap-y-1">
        <EngagementBar
          engagement={engagement}
          onToggleLike={onToggleLike}
          onToggleSave={onToggleSave}
          onShare={onShare}
          showCounts={showCounts}
        />
        {post.taggedProductIds.length > 0 ? (
          <PressableScale
            testID="shop-the-look"
            accessibilityRole="button"
            accessibilityLabel="Shop the look"
            onPress={onShopTheLook}
            className="min-h-[44px] justify-center"
          >
            <Caption className="text-sage font-body-semibold">Shop the look</Caption>
          </PressableScale>
        ) : null}
      </View>
    </GlassCard>
  );
}

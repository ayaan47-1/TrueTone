// src/features/community/components/CreatorHeader.tsx
// Creator identity strip for a post/routine card -- avatar + @username. Reuses the
// identity seam's CommunityProfile shape (src/features/identity) so a seeded creator and
// the signed-in user's own Account identity are the same shape. avatarUri is always null
// for seed data (no network media); a local initial-letter placeholder stands in, the same
// avatarUri === null fallback Account already uses.
import { Image, View } from 'react-native';
import { Caption } from '../../../components/ui';
import { palette } from '../../../theme/tokens';
import type { CommunityProfile } from '../../identity/community-profile-types';

interface CreatorHeaderProps {
  creator: CommunityProfile;
  size?: number;
}

const SWATCHES = [palette.sage, palette.mauve500, palette.mauve400] as const;

function swatchFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return SWATCHES[hash % SWATCHES.length];
}

export function CreatorHeader({ creator, size = 32 }: CreatorHeaderProps) {
  return (
    <View className="flex-row items-center gap-2.5">
      {creator.avatarUri ? (
        <Image
          testID="creator-avatar-image"
          source={{ uri: creator.avatarUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          testID="creator-avatar-placeholder"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: swatchFor(creator.userId),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Caption className="text-white font-body-semibold">
            {creator.username.charAt(0).toUpperCase()}
          </Caption>
        </View>
      )}
      <Caption className="text-ink font-body-semibold">{`@${creator.username}`}</Caption>
    </View>
  );
}

// src/features/community/community-types.ts
// Pure shapes for the seeded Community module -- no runtime, no JSX, no network.
// `creator` reuses the identity seam's CommunityProfile (userId/username/avatarUri) so a
// post's creator header is the same shape as the signed-in user's own Account identity
// (src/features/identity). `taggedProductIds` point into the existing shop catalog
// (src/features/match/product-catalog) rather than inventing a second product list.
import type { ImageSourcePropType } from 'react-native';
import type { CommunityProfile } from '../identity/community-profile-types';

export type CommunityTab = 'routines' | 'feed';

/** A local media placeholder tile -- never a network image/video URL (see CommunityScreen). */
export interface CommunityMediaItem {
  id: string;
  kind: 'photo' | 'video';
  /** Display-only caption for the placeholder tile, e.g. a scene label or a duration. */
  label: string;
  /** Background color behind the media (or standing in for it when there is no image). */
  swatch: string;
  /** A bundled local photo (`require(...)`), never a network URL. */
  image?: ImageSourcePropType;
}

export interface CommunityPost {
  id: string;
  creator: CommunityProfile;
  /** Avatar colour for the creator's initial; falls back to a hashed palette swatch. */
  creatorColor?: string;
  caption: string;
  media: readonly CommunityMediaItem[];
  taggedProductIds: readonly string[];
  likeCount: number;
  saveCount: number;
}

export interface CommunityRoutineStep {
  id: string;
  title: string;
  detail: string;
}

export interface CommunityRoutine {
  id: string;
  creator: CommunityProfile;
  creatorColor?: string;
  title: string;
  summary: string;
  steps: readonly CommunityRoutineStep[];
  taggedProductIds: readonly string[];
}

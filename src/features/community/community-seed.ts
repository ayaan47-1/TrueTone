// src/features/community/community-seed.ts
// Local, static seed data for the Community module -- no network fetch, no backend table.
// Product tags point at real ids in the existing shop catalog (src/features/match/product-catalog)
// so "Shop the look" surfaces real, already-scored products instead of a second invented list.
import type { CommunityMediaItem, CommunityPost, CommunityRoutine } from './community-types';
import type { CommunityProfile } from '../identity/community-profile-types';

export const SEED_CREATORS: readonly CommunityProfile[] = [
  { userId: 'seed-maya', username: 'maya_glow', avatarUri: null },
  { userId: 'seed-devon', username: 'devon_edits', avatarUri: null },
  { userId: 'seed-priya', username: 'priya_daily', avatarUri: null },
];

function media(id: string, kind: CommunityMediaItem['kind'], label: string, swatch: string): CommunityMediaItem {
  return { id, kind, label, swatch };
}

export const SEED_POSTS: readonly CommunityPost[] = [
  {
    id: 'post-1',
    creator: SEED_CREATORS[0],
    caption: 'Everyday glow routine in under 5 minutes.',
    media: [
      media('post-1-a', 'video', '0:42 · Morning light', '#EBE2D3'),
      media('post-1-b', 'photo', 'Finished look', '#DED4C4'),
    ],
    taggedProductIds: ['lum-tint-01', 'lum-serum-04'],
    likeCount: 128,
    saveCount: 34,
  },
  {
    id: 'post-2',
    creator: SEED_CREATORS[1],
    caption: 'Full-cover for a long shoot day, no touch-ups needed.',
    media: [media('post-2-a', 'video', '1:10 · Studio light', '#F0E6D8')],
    taggedProductIds: ['sol-full-07'],
    likeCount: 94,
    saveCount: 21,
  },
  {
    id: 'post-3',
    creator: SEED_CREATORS[2],
    caption: 'Second-skin base under everything I wear this week.',
    media: [
      media('post-3-a', 'photo', 'Before', '#E7F1EA'),
      media('post-3-b', 'photo', 'After', '#DED4C4'),
    ],
    taggedProductIds: ['sol-second-05', 'ver-every-09'],
    likeCount: 61,
    saveCount: 12,
  },
];

export const SEED_ROUTINES: readonly CommunityRoutine[] = [
  {
    id: 'routine-1',
    creator: SEED_CREATORS[0],
    title: '3-step weekday base',
    summary: 'Skin tint, spot conceal, set once. Built for a 7am mirror.',
    steps: [
      { id: 'routine-1-s1', title: 'Prep', detail: 'A thin layer of moisturizer, let it sit a minute.' },
      { id: 'routine-1-s2', title: 'Tint', detail: 'Weightless skin tint, buffed with a damp sponge.' },
      { id: 'routine-1-s3', title: 'Set', detail: 'Light pressed powder on the T-zone only.' },
    ],
    taggedProductIds: ['lum-tint-01'],
  },
  {
    id: 'routine-2',
    creator: SEED_CREATORS[2],
    title: 'Long-wear base for 12-hour days',
    summary: 'Second-skin foundation plus an everyday setting step that survives a full shift.',
    steps: [
      { id: 'routine-2-s1', title: 'Base', detail: 'Second-skin foundation, one thin coat.' },
      { id: 'routine-2-s2', title: 'Reinforce', detail: 'Everyday foundation on high-touch areas only.' },
      { id: 'routine-2-s3', title: 'Lock', detail: 'Setting spray, two passes, arm’s length.' },
    ],
    taggedProductIds: ['sol-second-05', 'ver-every-09'],
  },
];

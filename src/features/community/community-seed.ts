// src/features/community/community-seed.ts
// Local, static seed data for the Community module -- no network fetch, no backend table.
// Product tags point at real ids in the existing shop catalog (src/features/match/product-catalog)
// so "Shop the look" surfaces real, already-scored products instead of a second invented list.
import type { CommunityMediaItem, CommunityPost, CommunityRoutine } from './community-types';
import type { CommunityProfile } from '../identity/community-profile-types';

export const SEED_CREATORS: readonly CommunityProfile[] = [
  { userId: 'seed-maya', username: 'maya_glows', avatarUri: null },
  { userId: 'seed-dani', username: 'deepshade_dani', avatarUri: null },
  { userId: 'seed-priya', username: 'priya_daily', avatarUri: null },
  { userId: 'seed-lena', username: 'lena_l', avatarUri: null },
];

function media(
  id: string,
  kind: CommunityMediaItem['kind'],
  label: string,
  swatch: string,
  image?: CommunityMediaItem['image'],
): CommunityMediaItem {
  return image === undefined ? { id, kind, label, swatch } : { id, kind, label, swatch, image };
}

// Content from the designer's v3 walkthrough (frame t-14). Photos are AI/stock sample images
// bundled under assets/photos/community; captions stay about looks and routines -- no
// before/after or "my results" framing (Dwight ruling, v3-demo-content-ruling.md).
export const SEED_POSTS: readonly CommunityPost[] = [
  {
    id: 'post-1',
    creator: SEED_CREATORS[0],
    creatorColor: '#2f7d52',
    caption: 'Five-minute dewy base for warm days. Two layers of tint, pressed in with fingers.',
    media: [media('post-1-a', 'photo', 'Dewy base', '#E9C39A', require('../../../assets/photos/community/post1.jpg'))],
    taggedProductIds: ['lum-tint-01', 'lum-serum-04'],
    likeCount: 128,
    saveCount: 42,
  },
  {
    id: 'post-2',
    creator: SEED_CREATORS[1],
    creatorColor: '#8A8378',
    caption: 'Satin finish, warm-olive. One thin layer, blended out past the jaw.',
    media: [media('post-2-a', 'photo', 'Satin base', '#8A5232', require('../../../assets/photos/community/post2.jpg'))],
    taggedProductIds: ['sol-tint-06', 'mar-airy-16'],
    likeCount: 96,
    saveCount: 31,
  },
];

export const SEED_ROUTINES: readonly CommunityRoutine[] = [
  {
    id: 'routine-v3',
    creator: SEED_CREATORS[3],
    creatorColor: '#A79E91',
    title: 'Weekday soft glam',
    summary: 'Ten minutes, three products, lasts through the afternoon.',
    steps: [
      { id: 'routine-v3-s1', title: 'Prep', detail: 'A light moisturizer, let it settle.' },
      { id: 'routine-v3-s2', title: 'Base', detail: 'Skin tint on the center of the face.' },
      { id: 'routine-v3-s3', title: 'Finish', detail: 'Cream blush, tapped up the cheekbones.' },
    ],
    taggedProductIds: ['lum-tint-01'],
  },
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

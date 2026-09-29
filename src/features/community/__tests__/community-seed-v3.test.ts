// v3 walkthrough (frame t-14): the Feed opens on the designer's two seeded posts, each backed
// by a bundled (never network) photo, with captions about looks/routines only.
import { SEED_POSTS } from '../community-seed';

const [first, second] = SEED_POSTS;

test('the first post is the v3 "Dewy base" look with its counts', () => {
  expect(first.creator.username).toBe('maya_glows');
  expect(first.caption).toBe('Five-minute dewy base for warm days. Two layers of tint, pressed in with fingers.');
  expect(first.media).toHaveLength(1);
  expect(first.media[0].label).toBe('Dewy base');
  expect(first.likeCount).toBe(128);
  expect(first.saveCount).toBe(42);
  expect(first.creatorColor).toBe('#2f7d52');
});

test('the Feed carries exactly the two v3 posts, each with a bundled photo', () => {
  expect(SEED_POSTS).toHaveLength(2);
  expect(second.creator.username).toBe('deepshade_dani');
  for (const post of SEED_POSTS) {
    expect(post.media[0].image).toBeDefined();
    expect(typeof post.media[0].image).not.toBe('string');
  }
});

test('captions describe looks, never a user result or before/after', () => {
  for (const post of SEED_POSTS) {
    const text = `${post.caption} ${post.media.map((m) => m.label).join(' ')}`.toLowerCase();
    expect(text).not.toMatch(/before|after|found my match|results?\b|years of/);
  }
});

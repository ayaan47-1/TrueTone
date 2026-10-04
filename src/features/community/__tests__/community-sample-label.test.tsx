// Dwight's v3 demo-content ruling (2026-09-29), item (b): the Community surface carries the
// sample label once, and fabricated like/save counts render only behind SAMPLE_ENGAGEMENT_ENABLED.
import { render } from '@testing-library/react-native';
import { CommunityScreen } from '../CommunityScreen';
import { EngagementBar } from '../components/EngagementBar';
import { SEED_POSTS } from '../community-seed';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import * as sample from '../../shop/sample-content';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const firstPost = SEED_POSTS[0];

test('the community label uses the exact ruled wording', () => {
  expect(sample.SAMPLE_COMMUNITY_LABEL).toBe('Sample community — demo creators and posts, not real users.');
  expect(findDiseaseTerms(sample.SAMPLE_COMMUNITY_LABEL)).toEqual([]);
});

test('sample engagement counts are on by default (internal build)', () => {
  expect(sample.SAMPLE_ENGAGEMENT_ENABLED).toBe(true);
});

test('the Community screen shows the sample label once', async () => {
  const view = await render(<CommunityScreen />);
  expect(view.getAllByText(sample.SAMPLE_COMMUNITY_LABEL)).toHaveLength(1);
});

test('with sample engagement on, like and save counts render', async () => {
  const view = await render(<CommunityScreen />);
  expect(view.getByText(String(firstPost.likeCount))).toBeTruthy();
  expect(view.getByText(String(firstPost.saveCount))).toBeTruthy();
});

test('with sample engagement off, the icons stay but no counts render', async () => {
  const engagement = { liked: false, saved: false, likeCount: 128, saveCount: 42, shareCount: 0 };
  const noop = () => undefined;
  const view = await render(
    <EngagementBar engagement={engagement} onToggleLike={noop} onToggleSave={noop} onShare={noop} showCounts={false} />,
  );
  expect(view.getByTestId('engagement-like')).toBeTruthy();
  expect(view.getByTestId('engagement-save')).toBeTruthy();
  expect(view.queryByText('128')).toBeNull();
  expect(view.queryByText('42')).toBeNull();
});

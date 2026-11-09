// src/features/foryou/__tests__/RecentMatchesCard.test.tsx
// "Your recent matches" (Dwight ruling §3): a timestamped LOG of past matched shades as words.
// No graph, no number, no change/shift wording, no accuracy claim; empty state when none.
import { render } from '@testing-library/react-native';
import { RecentMatchesCard } from '../RecentMatchesCard';
import type { ShadeMatchEntry } from '../../../lib/scans';

const matches: ShadeMatchEntry[] = [
  { id: 'a', capturedAt: '2026-09-27T15:00:00Z', shade: { depthBand: 'tan', undertone: 'warm', finish: 'satin', shadeName: 'Tan Warm' } },
  { id: 'b', capturedAt: '2026-09-20T15:00:00Z', shade: { depthBand: 'medium', undertone: 'neutral', finish: 'natural', shadeName: 'Medium Neutral' } },
];

test('lists each saved match as words with its date', async () => {
  const view = await render(<RecentMatchesCard state={{ status: 'ready', matches }} />);
  expect(view.getByText('Your recent matches')).toBeTruthy();
  expect(view.getByText('Tan · Warm · Satin')).toBeTruthy();
  expect(view.getByText('Medium · Neutral · Natural')).toBeTruthy();
  expect(view.getByText('Sep 27')).toBeTruthy();
  expect(view.getAllByTestId('recent-match-row')).toHaveLength(2);
});

test('shows at most five matches', async () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ ...matches[0], id: String(i) }));
  const view = await render(<RecentMatchesCard state={{ status: 'ready', matches: many }} />);
  expect(view.getAllByTestId('recent-match-row')).toHaveLength(5);
});

test('shade lines carry no numbers and the card uses no change/accuracy wording', async () => {
  const view = await render(<RecentMatchesCard state={{ status: 'ready', matches }} />);
  const text = JSON.stringify(view.toJSON());
  for (const row of view.getAllByTestId('recent-match-shade')) {
    expect(String(row.props.children)).not.toMatch(/[0-9%]/);
  }
  expect(text).not.toMatch(/chang|shift|warmer|cooler|lighter|darker|accura|confiden|%|trend/i);
});

test('empty state when there are no saved matches', async () => {
  const view = await render(<RecentMatchesCard state={{ status: 'ready', matches: [] }} />);
  expect(view.getByTestId('recent-matches-empty')).toBeTruthy();
  expect(view.queryAllByTestId('recent-match-row')).toHaveLength(0);
});

test('renders nothing while loading and a calm message on error', async () => {
  const loading = await render(<RecentMatchesCard state={{ status: 'loading' }} />);
  expect(loading.queryByText('Your recent matches')).toBeNull();
  const failed = await render(<RecentMatchesCard state={{ status: 'error' }} />);
  expect(failed.getByTestId('recent-matches-error')).toBeTruthy();
});

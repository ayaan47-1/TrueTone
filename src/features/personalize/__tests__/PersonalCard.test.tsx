// src/features/personalize/__tests__/PersonalCard.test.tsx
import { render, screen } from '@testing-library/react-native';
import { PersonalCard } from '../PersonalCard';

describe('PersonalCard', () => {
  test('renders the heading, messages, and relative disclaimer', async () => {
    await render(
      <PersonalCard messages={['The appearance of redness is up compared to your usual — worth a gentle focus.']} />,
    );
    expect(screen.getAllByText(/compared to your usual/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/worth a gentle focus/i)).toBeTruthy();
    expect(screen.getByText(/your own recent scans/i)).toBeTruthy();
  });

  test('renders nothing for an empty message list', async () => {
    await render(<PersonalCard messages={[]} />);
    expect(screen.queryByText(/compared to your usual/i)).toBeNull();
  });

  test('runtime guard drops a message containing a blocked term', async () => {
    await render(
      <PersonalCard messages={['this mentions acne and must not render', 'Texture is down compared to your usual.']} />,
    );
    expect(screen.queryByText(/acne/i)).toBeNull();
    expect(screen.getByText(/texture is down/i)).toBeTruthy();
  });
});

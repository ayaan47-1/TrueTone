// src/features/foryou/__tests__/FindYourShadeCard.test.tsx
// Renders are ASYNC (repo gotcha a): await render, query via `view`.
import { render, fireEvent } from '@testing-library/react-native';
import { FindYourShadeCard } from '../FindYourShadeCard';

describe('FindYourShadeCard', () => {
  test('renders the find-your-shade prompt in the "Your products" slot', async () => {
    const view = await render(<FindYourShadeCard onFindShade={jest.fn()} />);
    // Keeps the section identity so the shelf does not silently vanish.
    expect(view.getByText('Your products')).toBeTruthy();
    expect(view.getByText('Find your shade')).toBeTruthy();
  });

  test('the CTA invokes onFindShade (caller routes to /scan-gate)', async () => {
    const onFindShade = jest.fn();
    const view = await render(<FindYourShadeCard onFindShade={onFindShade} />);
    fireEvent.press(view.getByTestId('find-your-shade-cta'));
    expect(onFindShade).toHaveBeenCalledTimes(1);
  });
});

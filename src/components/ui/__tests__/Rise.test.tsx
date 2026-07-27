import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Rise } from '../Rise';
import * as motion from '../../../theme/motion';

// The Reanimated worklet layer is stubbed under Jest (test/setup.ts), so the animation itself
// can't be observed here. These assert what we control: children always render, and an entrance
// is attached only when motion is allowed. The delay maths is covered by staggerDelay's own tests.

describe('Rise', () => {
  it('renders its children', async () => {
    await render(
      <Rise>
        <Text>hello</Text>
      </Rise>,
    );
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders children at any stagger index', async () => {
    await render(
      <Rise index={40}>
        <Text>late row</Text>
      </Rise>,
    );
    expect(screen.getByText('late row')).toBeTruthy();
  });

  it('attaches an entrance animation', async () => {
    await render(
      <Rise index={2}>
        <Text>row</Text>
      </Rise>,
    );
    expect(screen.getByTestId('rise').props.entering).toBeTruthy();
  });
});

describe('Rise with reduced motion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders children with no entrance animation', async () => {
    // Spy on our own hook rather than re-mocking Reanimated: no module-registry reset, and no
    // risk of booting the worklets native layer that cannot initialise under Jest.
    jest.spyOn(motion, 'useCalm').mockReturnValue(true);
    await render(
      <Rise index={3}>
        <Text>calm</Text>
      </Rise>,
    );
    expect(screen.getByText('calm')).toBeTruthy();
    expect(screen.getByTestId('rise').props.entering).toBeUndefined();
  });
});

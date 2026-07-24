import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PressableScale } from '../PressableScale';
import * as motion from '../../../theme/motion';

// Kept in its own file: the calm branch renders a different tree (plain Pressable rather than the
// animated one), and mounting both variants in one file leaves state that breaks the later query.

describe('PressableScale with reduced motion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('still renders and fires onPress without scaling', async () => {
    // Spy on our own hook rather than re-mocking Reanimated: no module-registry reset, and no
    // risk of booting the worklets native layer that cannot initialise under Jest.
    jest.spyOn(motion, 'useCalm').mockReturnValue(true);
    const onPress = jest.fn();
    await render(
      <PressableScale onPress={onPress}>
        <Text>calm tap</Text>
      </PressableScale>,
    );
    const node = screen.getByText('calm tap');
    await act(async () => {
      fireEvent(node, 'pressIn');
    });
    await act(async () => {
      fireEvent.press(node);
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

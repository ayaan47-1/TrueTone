import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PressableScale } from '../PressableScale';

// RN's Pressability schedules internal state async, so each dispatched press event is flushed
// inside act() — otherwise React logs overlapping-act() warnings for interleaved events.
const flush = async (fn: () => void) => {
  await act(async () => {
    fn();
  });
};

describe('PressableScale', () => {
  it('renders children and fires onPress', async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale onPress={onPress}>
        <Text>tap me</Text>
      </PressableScale>,
    );
    await flush(() => fireEvent.press(screen.getByText('tap me')));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('forwards Pressable props (accessibilityRole, disabled)', async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale onPress={onPress} accessibilityRole="button" disabled>
        <Text>disabled</Text>
      </PressableScale>,
    );
    const node = screen.getByRole('button');
    expect(node).toBeTruthy();
    await flush(() => fireEvent.press(node));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('survives a full press in/out cycle', async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale onPress={onPress}>
        <Text>cycle</Text>
      </PressableScale>,
    );
    const node = screen.getByText('cycle');
    await flush(() => fireEvent(node, 'pressIn'));
    await flush(() => fireEvent(node, 'pressOut'));
    await flush(() => fireEvent.press(node));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

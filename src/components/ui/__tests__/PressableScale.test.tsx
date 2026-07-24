import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PressableScale } from '../PressableScale';
import * as motion from '../../../theme/motion';

describe('PressableScale', () => {
  it('renders children and fires onPress', async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale onPress={onPress}>
        <Text>tap me</Text>
      </PressableScale>,
    );
    fireEvent.press(screen.getByText('tap me'));
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
    fireEvent.press(node);
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
    expect(() => {
      fireEvent(node, 'pressIn');
      fireEvent(node, 'pressOut');
    }).not.toThrow();
    fireEvent.press(node);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

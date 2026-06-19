import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatScreen } from '../ChatScreen';
import { sendChat } from '../../../lib/routine-chat';

jest.mock('../../../lib/routine-chat', () => ({ sendChat: jest.fn() }));

test('sends a message and shows the reply', async () => {
  (sendChat as jest.Mock).mockResolvedValue({ reply: 'The SPF step helps.', referred: false });
  const { getByPlaceholderText, getByText } = await render(<ChatScreen scanId="s1" />);
  await fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText('The SPF step helps.')).toBeTruthy());
});

test('shows a graceful error when the call fails', async () => {
  (sendChat as jest.Mock).mockRejectedValue(new Error('chat-failed'));
  const { getByPlaceholderText, getByText } = await render(<ChatScreen scanId="s1" />);
  await fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'hi');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText(/couldn.t load/i)).toBeTruthy());
});

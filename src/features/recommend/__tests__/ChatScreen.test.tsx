import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatScreen } from '../ChatScreen';
import { sendChat } from '../../../lib/routine-chat';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';

jest.mock('../../../lib/routine-chat', () => ({ sendChat: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

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

test('renders a distinct referral card (not a plain bubble) for a referral reply', async () => {
  (sendChat as jest.Mock).mockResolvedValue({
    reply:
      "I can only describe how skin looks — please see a board-certified dermatologist, who can examine it properly.",
    referred: true,
  });
  const { getByPlaceholderText, getByText, getByTestId } = await render(<ChatScreen scanId="s1" />);
  await fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'is this mole a problem?');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByTestId('referral-card')).toBeTruthy());
  expect(getByText(/isn.t a diagnosis/i)).toBeTruthy();
  expect(getByText(/board-certified dermatologist/i)).toBeTruthy();
});

test('the UI-authored referral heading contains no disease terms', () => {
  expect(findDiseaseTerms("This isn't a diagnosis")).toEqual([]);
});

test('a non-referral reply renders a plain bubble, not the referral card', async () => {
  (sendChat as jest.Mock).mockResolvedValue({ reply: 'The SPF step helps.', referred: false });
  const { getByPlaceholderText, getByText, queryByTestId } = await render(<ChatScreen scanId="s1" />);
  await fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText('The SPF step helps.')).toBeTruthy());
  expect(queryByTestId('referral-card')).toBeNull();
});

test('shows the sending indicator while awaiting and hides it after', async () => {
  let resolveSend!: (v: { reply: string; referred: boolean }) => void;
  (sendChat as jest.Mock).mockReturnValue(new Promise((r) => { resolveSend = r; }));
  const { getByPlaceholderText, getByText, queryByTestId } = await render(<ChatScreen scanId="s1" />);
  await fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  // Do not await — we want to inspect state while the send Promise is still in-flight.
  void fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(queryByTestId('sending-indicator')).toBeTruthy());
  resolveSend({ reply: 'ok', referred: false });
  await waitFor(() => expect(queryByTestId('sending-indicator')).toBeNull());
});

test('strips the UI-only referred flag from the history sent to the backend', async () => {
  (sendChat as jest.Mock)
    .mockResolvedValueOnce({ reply: 'please see a dermatologist', referred: true })
    .mockResolvedValueOnce({ reply: 'the SPF step helps', referred: false });
  const { getByPlaceholderText, getByText } = await render(<ChatScreen scanId="s1" />);
  await fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'is this mole bad?');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText(/isn.t a diagnosis/i)).toBeTruthy());
  await fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect((sendChat as jest.Mock).mock.calls.length).toBe(2));
  const secondCallHistory = (sendChat as jest.Mock).mock.calls[1][2];
  expect(secondCallHistory).toEqual([
    { role: 'user', content: 'is this mole bad?' },
    { role: 'assistant', content: 'please see a dermatologist' },
  ]);
  expect(secondCallHistory.every((t: Record<string, unknown>) => !('referred' in t))).toBe(true);
});

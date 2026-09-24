import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MakeupChatScreen } from '../MakeupChatScreen';
import { sendMakeupChat } from '../../../lib/makeup-chat';
import type { CurrentShade } from '../../session/personalization';
import type { SetupAnswers } from '../../preferences/preferences-types';

jest.mock('../../../lib/makeup-chat', () => ({ sendMakeupChat: jest.fn() }));

const shade: CurrentShade = { shadeName: 'Medium Warm', undertone: 'warm', depth: 6, finish: 'natural' };
const preferences: SetupAnswers = { goals: ['even_base'], coverage: 'everyday', skips: [] };

beforeEach(() => jest.clearAllMocks());

test('sends a message and shows the reply', async () => {
  (sendMakeupChat as jest.Mock).mockResolvedValue({ reply: 'A satin finish suits you.', referred: false });
  const { getByPlaceholderText, getByText } = await render(
    <MakeupChatScreen shade={shade} preferences={preferences} />,
  );
  await fireEvent.changeText(getByPlaceholderText(/ask about your shade/i), 'what finish?');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText('A satin finish suits you.')).toBeTruthy());
});

test('passes the shade and preferences into the transport', async () => {
  (sendMakeupChat as jest.Mock).mockResolvedValue({ reply: 'ok', referred: false });
  const { getByPlaceholderText, getByText } = await render(
    <MakeupChatScreen shade={shade} preferences={preferences} />,
  );
  await fireEvent.changeText(getByPlaceholderText(/ask about your shade/i), 'hi');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect((sendMakeupChat as jest.Mock).mock.calls.length).toBe(1));
  const [sentShade, sentPrefs, sentMessage] = (sendMakeupChat as jest.Mock).mock.calls[0];
  expect(sentShade).toEqual(shade);
  expect(sentPrefs).toEqual(preferences);
  expect(sentMessage).toBe('hi');
});

test('renders a distinct referral card for a referral reply', async () => {
  (sendMakeupChat as jest.Mock).mockResolvedValue({
    reply: 'please see a board-certified dermatologist, who can examine it properly.',
    referred: true,
  });
  const { getByPlaceholderText, getByText, getByTestId } = await render(
    <MakeupChatScreen shade={shade} preferences={preferences} />,
  );
  await fireEvent.changeText(getByPlaceholderText(/ask about your shade/i), 'is this mole a problem?');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByTestId('referral-card')).toBeTruthy());
  expect(getByText(/isn.t a diagnosis/i)).toBeTruthy();
});

test('shows a graceful error when the call fails', async () => {
  (sendMakeupChat as jest.Mock).mockRejectedValue(new Error('chat-failed'));
  const { getByPlaceholderText, getByText } = await render(
    <MakeupChatScreen shade={shade} preferences={preferences} />,
  );
  await fireEvent.changeText(getByPlaceholderText(/ask about your shade/i), 'hi');
  await fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText(/couldn.t load/i)).toBeTruthy());
});

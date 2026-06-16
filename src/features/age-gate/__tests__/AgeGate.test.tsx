import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AgeGate } from '../AgeGate';

const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
jest.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ update: mockUpdate }) } }));
const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

test('passes 18+ by writing only the derived flag; no DOB in any call/log', async () => {
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={jest.fn()} />);
  await fireEvent.changeText(getByTestId('dob-input'), '2000-01-01');
  await fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  const payload = JSON.stringify(mockUpdate.mock.calls);
  expect(payload).toContain('is_18_plus');
  expect(payload).not.toContain('2000-01-01'); // DOB never sent
  expect(JSON.stringify(logSpy.mock.calls)).not.toContain('2000-01-01'); // never logged
});

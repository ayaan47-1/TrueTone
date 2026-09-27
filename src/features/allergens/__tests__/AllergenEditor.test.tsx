import { render, fireEvent, waitFor } from '@testing-library/react-native';
const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
import { AllergenEditor } from '../AllergenEditor';
import { saveAllergenProfile, loadAllergenProfile } from '../allergen-store';
import { emptyProfile, toggleGroup } from '../profile';
import { ALLERGEN_COPY as C } from '../../../content/allergen-copy';

const SecureStore = require('expo-secure-store');
beforeEach(() => { mockRpc.mockReset(); mockRpc.mockResolvedValue({ error: null }); });

async function stored() {
  const r = await loadAllergenProfile('u1');
  return r.status === 'ok' ? r.profile : undefined;
}

test('edits the same stored profile and the change survives a reload', async () => {
  await saveAllergenProfile('u1', toggleGroup(emptyProfile('yes', 't'), 'fragrance'));
  const v = await render(<AllergenEditor userId="u1" />);
  await waitFor(() => expect(v.getByTestId('group-fragrance').props.accessibilityState.selected).toBe(true));
  expect(v.getByText(C.disclaimer)).toBeTruthy();
  await fireEvent.press(v.getByText('Parabens'));
  await fireEvent.press(v.getByText(C.editor.save));
  await waitFor(() => expect(v.getByText(C.editor.saved)).toBeTruthy());
  expect((await stored())?.groups).toEqual(['fragrance', 'parabens']);
  expect(mockRpc).not.toHaveBeenCalled();
  const again = await render(<AllergenEditor userId="u1" />);
  await waitFor(() => expect(again.getByTestId('group-parabens').props.accessibilityState.selected).toBe(true));
});

test('a user who answered No must consent before their first flags are saved (E14)', async () => {
  await saveAllergenProfile('u1', emptyProfile('no', 't'));
  const v = await render(<AllergenEditor userId="u1" />);
  await waitFor(() => expect(v.getByText('Sulfates (SLS, SLES)')).toBeTruthy());
  await fireEvent.press(v.getByText('Sulfates (SLS, SLES)'));
  await fireEvent.press(v.getByText(C.editor.save));
  expect(v.getByText(C.consent.body)).toBeTruthy();
  expect((await stored())?.groups).toEqual([]);
  await fireEvent.press(v.getByTestId('health-consent-check'));
  await fireEvent.press(v.getByTestId('health-consent-submit'));
  await waitFor(() => expect(v.getByText(C.editor.saved)).toBeTruthy());
  expect(await stored()).toMatchObject({ answer: 'yes', groups: ['sulfates'] });
  expect(mockRpc).toHaveBeenCalledWith('record_health_data_consent');
});

test('withdrawing consent deletes the profile and logs the withdrawal', async () => {
  await saveAllergenProfile('u1', toggleGroup(emptyProfile('yes', 't'), 'mit'));
  const v = await render(<AllergenEditor userId="u1" />);
  await waitFor(() => expect(v.getByText(C.editor.withdraw)).toBeTruthy());
  await fireEvent.press(v.getByText(C.editor.withdraw));
  await waitFor(() => expect(SecureStore.__store.has('truetone.allergens.u1.v1')).toBe(false));
  expect(mockRpc).toHaveBeenCalledWith('withdraw_health_data_consent');
  // The screen resets: no flags selected and no Withdraw button (code review M6).
  await waitFor(() => expect(v.queryByText(C.editor.withdraw)).toBeNull());
  expect(v.getByTestId('group-mit').props.accessibilityState.selected).toBe(false);
});

test('a Keychain failure on withdraw shows an error and keeps the flags on screen (H2)', async () => {
  await saveAllergenProfile('u1', toggleGroup(emptyProfile('yes', 't'), 'mit'));
  const v = await render(<AllergenEditor userId="u1" />);
  await waitFor(() => expect(v.getByText(C.editor.withdraw)).toBeTruthy());
  SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('locked'));
  await fireEvent.press(v.getByText(C.editor.withdraw));
  await waitFor(() => expect(v.getByText(C.editor.withdrawFailed)).toBeTruthy());
  expect(mockRpc).toHaveBeenCalledWith('withdraw_health_data_consent');
  expect(v.getByTestId('group-mit').props.accessibilityState.selected).toBe(true);
  expect(v.getByText(C.editor.withdraw)).toBeTruthy();
});

test('a storage read failure shows the C11 banner and offers no save (fails closed)', async () => {
  SecureStore.getItemAsync.mockRejectedValueOnce(new Error('locked'));
  const v = await render(<AllergenEditor userId="u1" />);
  await waitFor(() => expect(v.getByText(C.loadFailed)).toBeTruthy());
  expect(v.queryByText(C.editor.save)).toBeNull();
});

test('a Keychain save failure shows an error, never "Saved" (code review M1)', async () => {
  await saveAllergenProfile('u1', toggleGroup(emptyProfile('yes', 't'), 'fragrance'));
  const v = await render(<AllergenEditor userId="u1" />);
  await waitFor(() => expect(v.getByTestId('group-fragrance').props.accessibilityState.selected).toBe(true));
  await fireEvent.press(v.getByText('Parabens'));
  SecureStore.setItemAsync.mockRejectedValueOnce(new Error('keychain'));
  await fireEvent.press(v.getByText(C.editor.save));
  await waitFor(() => expect(v.getByText(C.saveFailed)).toBeTruthy());
  expect(v.queryByText(C.editor.saved)).toBeNull();
  expect(v.getByTestId('group-parabens').props.accessibilityState.selected).toBe(true);
});

import { render, fireEvent, waitFor } from '@testing-library/react-native';
const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
import { AllergenSetup } from '../AllergenSetup';
import { loadAllergenProfile } from '../allergen-store';
import { ALLERGEN_COPY as C } from '../../../content/allergen-copy';

const SecureStore = require('expo-secure-store');
beforeEach(() => { mockRpc.mockReset(); mockRpc.mockResolvedValue({ error: null }); });

async function stored() {
  const r = await loadAllergenProfile('u1');
  return r.status === 'ok' ? r.profile : undefined;
}

test('asks the optional question with Yes / No / Skip', async () => {
  const v = await render(<AllergenSetup userId="u1" onDone={jest.fn()} />);
  expect(v.getByText(C.setup.title)).toBeTruthy();
  expect(v.getByText(C.setup.subtitle)).toBeTruthy();
  for (const l of [C.setup.yes, C.setup.no, C.setup.skip]) expect(v.getByText(l)).toBeTruthy();
});

test.each([[C.setup.no, 'no'], [C.setup.skip, 'skipped']])(
  '"%s" stores only the answer, writes no receipt and continues', async (label, answer) => {
    const onDone = jest.fn();
    const v = await render(<AllergenSetup userId="u1" onDone={onDone} />);
    await fireEvent.press(v.getByText(label));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(await stored()).toMatchObject({ answer, groups: [], ingredients: [], unresolved: [] });
    expect(mockRpc).not.toHaveBeenCalled();
  },
);

test('"Yes" → pick → consent before anything is saved → saved after consent', async () => {
  const onDone = jest.fn();
  const v = await render(<AllergenSetup userId="u1" onDone={onDone} />);
  await fireEvent.press(v.getByText(C.setup.yes));
  expect(v.getByText(C.disclaimer)).toBeTruthy();
  await fireEvent.press(v.getByText('Fragrance / parfum'));
  await fireEvent.press(v.getByText(C.setup.save));
  expect(v.getByText(C.consent.body)).toBeTruthy();
  expect(SecureStore.__store.size).toBe(0);
  await fireEvent.press(v.getByTestId('health-consent-check'));
  await fireEvent.press(v.getByTestId('health-consent-submit'));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(await stored()).toMatchObject({ answer: 'yes', groups: ['fragrance'] });
});

test('declining consent saves no flags and returns to the question with answer skipped', async () => {
  const onDone = jest.fn();
  const v = await render(<AllergenSetup userId="u1" onDone={onDone} />);
  await fireEvent.press(v.getByText(C.setup.yes));
  await fireEvent.press(v.getByText('Parabens'));
  await fireEvent.press(v.getByText(C.setup.save));
  await fireEvent.press(v.getByText(C.consent.decline));
  await waitFor(() => expect(v.getByText(C.setup.title)).toBeTruthy());
  expect(await stored()).toMatchObject({ answer: 'skipped', groups: [], ingredients: [], unresolved: [] });
  expect(mockRpc).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

test('latex shows a see-a-doctor note and is never selected as a flag', async () => {
  const v = await render(<AllergenSetup userId="u1" onDone={jest.fn()} />);
  await fireEvent.press(v.getByText(C.setup.yes));
  await fireEvent.press(v.getByText('Latex'));
  expect(v.getByText(C.referralNote('Latex'))).toBeTruthy();
  expect(v.getByText(C.setup.save).props).toBeTruthy();
});

test('search adds a dictionary ingredient; unknown names are kept as typed with the C13 note', async () => {
  const v = await render(<AllergenSetup userId="u1" onDone={jest.fn()} />);
  await fireEvent.press(v.getByText(C.setup.yes));
  await fireEvent.changeText(v.getByTestId('allergen-search'), 'linalo');
  await fireEvent.press(v.getByTestId('result-linalool'));
  expect(v.getByTestId('flag-ingredient-linalool')).toBeTruthy();
  await fireEvent.changeText(v.getByTestId('allergen-search'), 'zinc ricinoleate');
  expect(v.getByText(C.searchNoMatch)).toBeTruthy();
  await fireEvent.press(v.getByText(C.addTyped));
  expect(v.getByTestId('flag-unresolved-zinc ricinoleate')).toBeTruthy();
  await fireEvent.changeText(v.getByTestId('allergen-search'), 'eczema');
  await fireEvent.press(v.getByText(C.addTyped));
  expect(v.getByText(C.freeTextRejected)).toBeTruthy();
});

test('a Keychain save failure after consent shows an error and stays on the step (code review M1)', async () => {
  const onDone = jest.fn();
  const v = await render(<AllergenSetup userId="u1" onDone={onDone} />);
  await fireEvent.press(v.getByText(C.setup.yes));
  await fireEvent.press(v.getByText('Fragrance / parfum'));
  await fireEvent.press(v.getByText(C.setup.save));
  await fireEvent.press(v.getByTestId('health-consent-check'));
  SecureStore.setItemAsync.mockRejectedValueOnce(new Error('keychain'));
  await fireEvent.press(v.getByTestId('health-consent-submit'));
  await waitFor(() => expect(v.getByText(C.saveFailed)).toBeTruthy());
  expect(onDone).not.toHaveBeenCalled();
  expect(v.getByTestId('health-consent-submit')).toBeTruthy();
});

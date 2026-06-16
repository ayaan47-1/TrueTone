import * as Localization from 'expo-localization';
import { isUSRegion } from '../region';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));
const mockGetLocales = Localization.getLocales as jest.Mock;

test('US region returns true', () => {
  mockGetLocales.mockReturnValue([{ regionCode: 'US' }]);
  expect(isUSRegion()).toBe(true);
});
test('non-US region returns false', () => {
  mockGetLocales.mockReturnValue([{ regionCode: 'CA' }]);
  expect(isUSRegion()).toBe(false);
});
test('null regionCode returns null (fail closed)', () => {
  mockGetLocales.mockReturnValue([{ regionCode: null }]);
  expect(isUSRegion()).toBeNull();
});
test('no locales returns null (fail closed)', () => {
  mockGetLocales.mockReturnValue([]);
  expect(isUSRegion()).toBeNull();
});

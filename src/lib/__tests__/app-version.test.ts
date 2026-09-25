import { formatVersionLabel, nativeVersionLabel } from '../app-version';

describe('formatVersionLabel', () => {
  it('combines version and build as "Version X (Y)"', () => {
    expect(formatVersionLabel('1.0.0', '2')).toBe('Version 1.0.0 (2)');
  });

  it('omits the build suffix when the build number is absent', () => {
    expect(formatVersionLabel('1.2.3', null)).toBe('Version 1.2.3');
  });

  it('treats an empty-string build as absent', () => {
    expect(formatVersionLabel('1.2.3', '')).toBe('Version 1.2.3');
  });

  it('returns null when the version is unavailable (nothing to show)', () => {
    expect(formatVersionLabel(null, '2')).toBeNull();
    expect(formatVersionLabel(null, null)).toBeNull();
    expect(formatVersionLabel('', '2')).toBeNull();
  });
});

describe('nativeVersionLabel', () => {
  it('reads the installed binary version + build from expo-application', () => {
    jest.resetModules();
    jest.doMock('expo-application', () => ({
      nativeApplicationVersion: '1.0.0',
      nativeBuildVersion: '2',
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { nativeVersionLabel: read } = require('../app-version');
    expect(read()).toBe('Version 1.0.0 (2)');
  });

  it('returns null when the native module reports no version (e.g. Expo Go)', () => {
    jest.resetModules();
    jest.doMock('expo-application', () => ({
      nativeApplicationVersion: null,
      nativeBuildVersion: null,
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { nativeVersionLabel: read } = require('../app-version');
    expect(read()).toBeNull();
  });
});

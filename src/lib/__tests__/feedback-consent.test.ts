const mockFlags = { demo: false, camera: false };
const mockBootstrap = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));
jest.mock('../auth', () => ({ bootstrapSession: () => mockBootstrap() }));
jest.mock('../supabase', () => ({
  get DEMO_MODE() { return mockFlags.demo; },
  get CAMERA_DEMO() { return mockFlags.camera; },
  supabase: { from: (table: string) => mockFrom(table) },
}));
import { readFeedbackConsent } from '../feedback-consent';
import { cameraDemoReset, cameraDemoSetIs18, cameraDemoSetConsent } from '../camera-demo-profile';

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags.demo = false; mockFlags.camera = false;
  mockBootstrap.mockResolvedValue('owner');
  cameraDemoReset();
});

test.each([
  [{ is_18_plus: true, consent_active: true }, 'active'],
  [{ is_18_plus: true, consent_active: false }, 'inactive'],
  [{ is_18_plus: false, consent_active: true }, 'inactive'],
  [{ consent_active: true }, 'unknown'],
  [null, 'unknown'],
])('only fresh complete profile flags confirm consent: %j', async (data, expected) => {
  mockSingle.mockResolvedValue({ data, error: null });
  expect(await readFeedbackConsent()).toBe(expected);
  expect(mockFrom).toHaveBeenCalledWith('profiles');
  expect(mockSelect).toHaveBeenCalledWith('is_18_plus, consent_active');
  expect(mockEq).toHaveBeenCalledWith('id', 'owner');
});

test('authentication and profile errors fail closed', async () => {
  mockBootstrap.mockRejectedValueOnce(new Error('offline'));
  expect(await readFeedbackConsent()).toBe('unknown');
  mockSingle.mockResolvedValue({ data: { is_18_plus: true, consent_active: true }, error: { message: 'unavailable' } });
  expect(await readFeedbackConsent()).toBe('unknown');
});

test('camera mode uses current local flags without network, and plain demo never confirms consent', async () => {
  mockFlags.camera = true;
  expect(await readFeedbackConsent()).toBe('inactive');
  cameraDemoSetIs18(); cameraDemoSetConsent();
  expect(await readFeedbackConsent()).toBe('active');
  mockFlags.demo = true;
  expect(await readFeedbackConsent()).toBe('inactive');
  expect(mockBootstrap).not.toHaveBeenCalled();
  expect(mockFrom).not.toHaveBeenCalled();
});

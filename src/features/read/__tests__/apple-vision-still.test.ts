const mockDetectStill = jest.fn();
const mockDispose = jest.fn();
jest.mock('../../capture/apple-vision-detector', () => ({
  createFaceDetector: jest.fn(() => ({ detectStill: mockDetectStill, dispose: mockDispose })),
}));
import { detectFacesOnStillDetailed } from '../detect-faces-still';
import { createFaceDetector } from '../../capture/apple-vision-detector';

beforeEach(() => { jest.clearAllMocks(); });

test('still read uses Apple Vision bounds in source pixels and releases the detector', async () => {
  mockDetectStill.mockReturnValue({ imageWidth: 400, imageHeight: 600, faces: [
    { x: 0.2, y: 0.1, width: 0.1, height: 0.2, yawAngle: 0, rollAngle: 0 },
    { x: 0.1, y: 0.2, width: 0.5, height: 0.6, yawAngle: 0, rollAngle: 0 },
  ] });
  const result = await detectFacesOnStillDetailed('file:///synthetic-test.jpg');
  expect(result.face).toEqual({ bounds: { x: 40, y: 120, width: 200, height: 360 } });
  expect(result.report.outcome).toBe('ok');
  expect(mockDetectStill).toHaveBeenCalledWith('file:///synthetic-test.jpg');
  expect(mockDispose).toHaveBeenCalledTimes(1);
});

test('native errors never leak image paths into diagnostic output', async () => {
  mockDetectStill.mockImplementationOnce(() => { throw new Error('file:///private-sensitive-path.jpg'); });
  const result = await detectFacesOnStillDetailed('file:///synthetic-test.jpg');
  expect(result.face).toBeNull();
  expect(result.report.outcome).toBe('threw');
  expect(JSON.stringify(result)).not.toContain('private-sensitive-path');
  expect(mockDispose).toHaveBeenCalledTimes(1);
});

test('unlinked detector is unavailable, not a fake successful detection', async () => {
  jest.mocked(createFaceDetector).mockImplementationOnce(() => { throw new Error('native module not installed'); });
  const result = await detectFacesOnStillDetailed('file:///synthetic-test.jpg');
  expect(result.face).toBeNull();
  expect(result.report.outcome).toBe('module-unavailable');
  expect(mockDetectStill).not.toHaveBeenCalled();
});

test('no face and malformed results do not invent contour geometry', async () => {
  mockDetectStill.mockReturnValueOnce({ imageWidth: 100, imageHeight: 100, faces: [] });
  expect((await detectFacesOnStillDetailed('file:///synthetic-test.jpg')).face).toBeNull();
  mockDetectStill.mockReturnValueOnce({ faces: 'bad' });
  expect((await detectFacesOnStillDetailed('file:///synthetic-test.jpg')).report.outcome).toBe('threw');
  expect(mockDispose).toHaveBeenCalledTimes(2);
});

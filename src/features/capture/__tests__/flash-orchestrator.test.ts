import { orchestrateFlashAndCapture, type DeviceAPI } from '../flash-orchestrator';

describe('flash-orchestrator', () => {
  let api: jest.Mocked<DeviceAPI>;
  let capturedPhoto: any;

  beforeEach(() => {
    capturedPhoto = { uri: 'file://test.jpg' };
    api = {
      getBrightness: jest.fn().mockResolvedValue(0.5),
      setBrightness: jest.fn().mockResolvedValue(undefined),
      delay: jest.fn().mockResolvedValue(undefined),
      supportsExposureLocking: true,
      supportsWhiteBalanceLocking: true,
      lockExposure: jest.fn().mockResolvedValue(true),
      lockWhiteBalance: jest.fn().mockResolvedValue(true),
      resetFocus: jest.fn().mockResolvedValue(undefined),
      capture: jest.fn().mockResolvedValue(capturedPhoto),
      setFlashOverlay: jest.fn(),
    };
  });

  it('performs full flash and lock sequence when supported', async () => {
    const photo = await orchestrateFlashAndCapture(api);

    expect(photo).toBe(capturedPhoto);

    // 1. Ramp brightness + white overlay
    expect(api.getBrightness).toHaveBeenCalledTimes(1);
    expect(api.setBrightness).toHaveBeenCalledWith(1.0);
    expect(api.setFlashOverlay).toHaveBeenCalledWith(true);

    // 2. Wait 150ms
    expect(api.delay).toHaveBeenCalledWith(150);

    // 3. Lock exposure and WB
    expect(api.lockExposure).toHaveBeenCalledTimes(1);
    expect(api.lockWhiteBalance).toHaveBeenCalledTimes(1);

    // 4. Capture
    expect(api.capture).toHaveBeenCalledTimes(1);

    // Order verification
    const captureOrder = api.capture.mock.invocationCallOrder[0];
    const lockExposureOrder = api.lockExposure.mock.invocationCallOrder[0];
    const lockWBOrder = api.lockWhiteBalance.mock.invocationCallOrder[0];
    const flashOrder = api.setFlashOverlay.mock.invocationCallOrder[0];
    
    expect(flashOrder).toBeLessThan(lockExposureOrder);
    expect(flashOrder).toBeLessThan(lockWBOrder);
    expect(lockExposureOrder).toBeLessThan(captureOrder);
    expect(lockWBOrder).toBeLessThan(captureOrder);

    // 5. Release locks and restore brightness
    expect(api.resetFocus).toHaveBeenCalledTimes(1);
    expect(api.setFlashOverlay).toHaveBeenCalledWith(false);
    expect(api.setBrightness).toHaveBeenCalledWith(0.5); // restored original
    
    const resetOrder = api.resetFocus.mock.invocationCallOrder[0];
    expect(captureOrder).toBeLessThan(resetOrder);
  });

  it('does not lock if locking is unsupported', async () => {
    api.supportsExposureLocking = false;
    api.supportsWhiteBalanceLocking = false;

    await orchestrateFlashAndCapture(api);

    expect(api.lockExposure).not.toHaveBeenCalled();
    expect(api.lockWhiteBalance).not.toHaveBeenCalled();
    expect(api.resetFocus).not.toHaveBeenCalled(); // nothing to unlock

    // but still flashes and captures
    expect(api.setBrightness).toHaveBeenCalledWith(1.0);
    expect(api.capture).toHaveBeenCalledTimes(1);
  });

  it('restores brightness even if capture throws', async () => {
    api.capture.mockRejectedValue(new Error('capture failed'));

    await expect(orchestrateFlashAndCapture(api)).rejects.toThrow('capture failed');

    expect(api.resetFocus).toHaveBeenCalledTimes(1);
    expect(api.setFlashOverlay).toHaveBeenCalledWith(false);
    expect(api.setBrightness).toHaveBeenCalledWith(0.5);
  });

  it('skips brightness ramp and restore if original brightness cannot be read', async () => {
    api.getBrightness.mockResolvedValue(-1);

    await orchestrateFlashAndCapture(api);

    expect(api.getBrightness).toHaveBeenCalledTimes(1);
    
    // Should NOT ramp brightness or restore it
    expect(api.setBrightness).not.toHaveBeenCalled();

    // BUT should still set the white overlay
    expect(api.setFlashOverlay).toHaveBeenCalledWith(true);
    expect(api.setFlashOverlay).toHaveBeenCalledWith(false); // in finally
  });
});

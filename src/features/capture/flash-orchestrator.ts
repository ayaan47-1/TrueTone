import { setBrightnessAsync, getBrightnessAsync } from 'expo-brightness';
import type { Camera } from 'react-native-vision-camera';

export interface DeviceAPI {
  getBrightness: () => Promise<number>;
  setBrightness: (b: number) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  supportsExposureLocking: boolean;
  supportsWhiteBalanceLocking: boolean;
  lockExposure: () => Promise<boolean>;
  lockWhiteBalance: () => Promise<boolean>;
  resetFocus: () => Promise<void>;
  capture: () => Promise<{ uri: string; [key: string]: any }>;
  setFlashOverlay: (active: boolean) => void;
}

export function createDeviceAPI(
  cameraRef: React.RefObject<Camera>,
  capturePhoto: () => Promise<{ uri: string; [key: string]: any }>,
  setFlashOverlay: (active: boolean) => void
): DeviceAPI {
  const c = cameraRef.current;
  const d = c?.device;
  const ctrl = c as any; // The controller methods might be on the camera ref or controller

  // Actually, for vision-camera v5:
  // cameraRef.current.lockCurrentExposure() is what is supported according to specs, but wait:
  // Is it cameraRef.current.controller? We can just check both.
  return {
    getBrightness: async () => {
      try {
        return await getBrightnessAsync();
      } catch {
        return -1;
      }
    },
    setBrightness: async (b: number) => {
      try {
        await setBrightnessAsync(b);
      } catch {
        // ignore
      }
    },
    delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    supportsExposureLocking: !!d?.supportsExposureLocking,
    supportsWhiteBalanceLocking: !!d?.supportsWhiteBalanceLocking, // assuming supportsWhiteBalanceLocking is there
    lockExposure: async () => {
      // It could be on .controller or directly on the component
      if (c && typeof (c as any).lockCurrentExposure === 'function') {
        await (c as any).lockCurrentExposure();
        return true;
      } else if (c && (c as any).controller && typeof (c as any).controller.lockCurrentExposure === 'function') {
        await (c as any).controller.lockCurrentExposure();
        return true;
      }
      return false;
    },
    lockWhiteBalance: async () => {
      if (c && typeof (c as any).lockCurrentWhiteBalance === 'function') {
        await (c as any).lockCurrentWhiteBalance();
        return true;
      } else if (c && (c as any).controller && typeof (c as any).controller.lockCurrentWhiteBalance === 'function') {
        await (c as any).controller.lockCurrentWhiteBalance();
        return true;
      }
      return false;
    },
    resetFocus: async () => {
      if (c && typeof (c as any).resetFocus === 'function') {
        await (c as any).resetFocus();
      } else if (c && (c as any).controller && typeof (c as any).controller.resetFocus === 'function') {
        await (c as any).controller.resetFocus();
      }
    },
    capture: capturePhoto,
    setFlashOverlay,
  };
}

export async function orchestrateFlashAndCapture(api: DeviceAPI) {
  let originalBrightness = -1;
  let didFlash = false;
  let didLock = false;

  try {
    // 1. Ramp screen to 100% + white overlay
    originalBrightness = await api.getBrightness();
    if (originalBrightness >= 0) {
      await api.setBrightness(1.0);
    }
    // Set overlay even if we skip brightness ramp
    api.setFlashOverlay(true);
    didFlash = true;

    // 2. Wait 150ms for the sensor/ISP to register the new incident light
    await api.delay(150);

    // 3. Lock white-balance/exposure
    const locks: Promise<boolean>[] = [];
    if (api.supportsExposureLocking) {
      locks.push(api.lockExposure());
    }
    // We assume supportsWhiteBalanceLocking exists on device if v5 supports it.
    if (api.supportsWhiteBalanceLocking) {
      locks.push(api.lockWhiteBalance());
    }
    
    if (locks.length > 0) {
      const results = await Promise.all(locks);
      didLock = results.every(r => r === true);
    }

    // 4. Capture
    const photo = await api.capture();
    return photo;
  } finally {
    // 5. Release locks + restore brightness
    if (didLock) {
      await api.resetFocus().catch(() => {});
    }
    if (didFlash) {
      api.setFlashOverlay(false);
      if (originalBrightness >= 0) {
        await api.setBrightness(originalBrightness).catch(() => {});
      }
    }
  }
}

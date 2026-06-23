// DEVICE-ONLY: verify on a physical Android phone via an Expo dev build. Decodes the captured
// JPEG to a fixed working-size RGBA RgbImage (512px longest edge). Intended native path:
// expo-image-manipulator resize → read pixels (confirm exact pixel-access API on-device via
// Context7 before wiring). Throws on the host so it can never be used off-device by accident.
import type { RgbImage } from './cv/types';

export const WORKING_EDGE = 512;

export async function decodeJpegToRgb(_uri: string): Promise<RgbImage> {
  // DEVICE-ONLY: replace with the confirmed native decode+resize call.
  throw new Error(
    'decodeJpegToRgb is a device-only stub: implement against the confirmed native JPEG decode/resize API',
  );
}

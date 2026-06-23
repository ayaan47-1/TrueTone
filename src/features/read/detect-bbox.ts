// DEVICE-ONLY: verify on a physical Android phone. Runs the vision-camera face detector on the
// STILL image (the capture-time bbox came from a lower-res preview frame) and returns the face
// bounding box in pixel coordinates of the decoded RgbImage. Throws on the host by design.
import type { Rect } from './cv/types';

export async function detectFaceBbox(_uri: string): Promise<Rect> {
  // DEVICE-ONLY: replace with the confirmed native face-detector call.
  throw new Error(
    'detectFaceBbox is a device-only stub: implement against the confirmed native face detector',
  );
}

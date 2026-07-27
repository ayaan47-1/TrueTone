// Turns an in-memory `Photo` into an UPRIGHT still on disk. Pure orchestration over structural
// interfaces, so the whole sequence is host-testable with fakes; Capture.tsx supplies the real
// vision-camera / nitro-image objects.
//
// The contract this file exists to establish: THE PIXELS IN THE WRITTEN FILE ARE UPRIGHT.
// Not "the file carries an EXIF tag saying which way is up" — actually upright. Two independent
// consumers read that file (jpeg-js in decode-rgb.ts, MLKit in detect-faces-still.ts) and they do
// not honour orientation metadata identically. Baking the rotation into the pixels is what makes
// them agree by construction instead of by hope. See photo-orientation.ts for the device evidence.
//
// COMPLIANCE (CLAUDE.md §1, §3): the photo is held in memory, written to the app's own temp
// directory, and deleted by withImageCleanup after the read. Nothing here logs it or sends it
// anywhere, and no new vendor is introduced — react-native-nitro-image is already a direct
// dependency, shipped as part of vision-camera v5's own stack.
import {
  checkOrientationApplied,
  conversionResidualDegrees,
  type OrientationCheck,
  type PhotoOrientation,
  type QuarterTurn,
  type Size,
} from './photo-orientation';

// Re-encoding is unavoidable: rotating the pixels means writing a new JPEG, so the still picks up
// a second compression generation. Quality 100 keeps that generation from adding block artifacts
// on top of the ones already there — microContrast (texture) and the Immerkaer noise estimate both
// read exactly the high-frequency energy that JPEG quantisation eats, so a cheaper setting would
// bias the read rather than merely shrink the file. The file is temporary and deleted after the
// read, so its size does not matter.
export const JPEG_QUALITY = 100;

/** Structural subset of react-native-nitro-image's `Image` that this module needs. */
export interface CapturedImage {
  readonly width: number;
  readonly height: number;
  rotateAsync(degrees: number, allowFastFlagRotation?: boolean): Promise<CapturedImage>;
  saveToTemporaryFileAsync(format: 'jpg', quality?: number): Promise<string>;
  dispose(): void;
}

/** Structural subset of react-native-vision-camera's `Photo` that this module needs. */
export interface CapturedPhoto {
  readonly orientation: PhotoOrientation;
  readonly isMirrored: boolean;
  readonly width: number;
  readonly height: number;
  toImageAsync(): Promise<CapturedImage>;
  saveToTemporaryFileAsync(): Promise<string>;
  dispose(): void;
}

export interface CaptureMeta {
  /** What the camera reported about the sensor buffer. */
  orientation: PhotoOrientation;
  isMirrored: boolean;
  sensorSize: Size;
  /** Size of the file actually written. Portrait here for a portrait selfie is the thing to see. */
  uprightSize: Size;
  /** Whether converting the Photo to an Image applied the rotation. `null` means undetermined. */
  orientationCheck: OrientationCheck;
  /** Degrees this module had to apply itself. 0 when the conversion got it right unaided. */
  correctedDegrees: QuarterTurn;
  /**
   * Why `correctedDegrees` is non-zero. `'residual'` — the conversion did not rotate, so we did.
   * `'mirrored-quarter-turn'` — it rotated but landed 180 degrees out on a mirrored frame; see
   * conversionResidualDegrees for the mechanism and the device evidence.
   */
  correctionReason: 'residual' | 'mirrored-quarter-turn' | null;
  /**
   * Non-null when the upright guarantee could NOT be met and the raw sensor buffer was written
   * instead. A read from such a file may place its regions on nothing. Surfaced by the dev overlay.
   */
  degradedReason: string | null;
}

export interface UprightStill {
  uri: string;
  meta: CaptureMeta;
}

const toUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

// A failure to release native memory must never fail a capture the user already took.
function release(disposable: { dispose(): void } | null): void {
  try {
    disposable?.dispose();
  } catch {
    /* the runtime will reclaim it eventually */
  }
}

export async function writeUprightStill(photo: CapturedPhoto): Promise<UprightStill> {
  const sensorSize: Size = { width: photo.width, height: photo.height };
  const orientation = photo.orientation;
  const isMirrored = photo.isMirrored;

  try {
    let image: CapturedImage;
    try {
      // Documented to apply `orientation` and `isMirrored` when producing the Image.
      image = await photo.toImageAsync();
    } catch (err) {
      // RAW photos and inaccessible image data land here. Writing the sensor buffer keeps capture
      // working, but the read that follows is unreliable — hence degradedReason.
      return {
        uri: toUri(await photo.saveToTemporaryFileAsync()),
        meta: {
          orientation,
          isMirrored,
          sensorSize,
          uprightSize: sensorSize,
          orientationCheck: { applied: null, residualDegrees: 0 },
          correctedDegrees: 0,
          correctionReason: null,
          degradedReason: err instanceof Error ? err.message : String(err),
        },
      };
    }

    const created: CapturedImage[] = [image];
    try {
      const orientationCheck = checkOrientationApplied(orientation, sensorSize, {
        width: image.width,
        height: image.height,
      });

      // Exactly one of these can be non-zero: either the conversion skipped the rotation and we
      // owe the whole thing, or it rotated a mirrored frame the wrong way round and we owe a half
      // turn on top. They are mutually exclusive by construction — conversionResidualDegrees only
      // fires when `applied === true`.
      const correctionReason = orientationCheck.applied === false
        ? ('residual' as const)
        : conversionResidualDegrees(orientation, isMirrored, orientationCheck.applied) !== 0
          ? ('mirrored-quarter-turn' as const)
          : null;
      const correctedDegrees: QuarterTurn = correctionReason === 'residual'
        ? orientationCheck.residualDegrees
        : correctionReason === 'mirrored-quarter-turn'
          ? conversionResidualDegrees(orientation, isMirrored, orientationCheck.applied)
          : 0;

      if (correctedDegrees !== 0) {
        // `allowFastFlagRotation: false` is load-bearing, not defensive. The fast path rotates by
        // writing an orientation flag rather than moving pixels, which is exactly the state the
        // Fold 7 was already in and which nothing downstream could recover from.
        image = await image.rotateAsync(correctedDegrees, false);
        created.push(image);
      }

      const path = await image.saveToTemporaryFileAsync('jpg', JPEG_QUALITY);
      return {
        uri: toUri(path),
        meta: {
          orientation,
          isMirrored,
          sensorSize,
          uprightSize: { width: image.width, height: image.height },
          orientationCheck,
          correctedDegrees,
          correctionReason,
          degradedReason: null,
        },
      };
    } finally {
      created.forEach(release);
    }
  } finally {
    release(photo);
  }
}

// Orientation bookkeeping for the still capture. PURE — no native, no camera, host-tested.
//
// Why this exists (device pass, 2026-07-26, Fold 7): `capturePhotoToFile` wrote the raw sensor
// buffer straight to disk — 3648x2736 landscape, EXIF orientation tag 1 — for a portrait selfie.
// Nothing downstream could recover from that. jpeg-js decoded a sideways face, MLKit's still
// detector found no face at all on it, `deriveRegionsForFace` fell through to the proportional
// guess, and the regions landed on hair and background. The read returned plausible numbers with
// no relationship to the user's skin, and no error anywhere.
//
// The fix is to bake the orientation into the PIXELS before the file is written (see Capture.tsx),
// so both consumers of that file agree by construction. This module is the part of that fix that
// can be tested without hardware: given what the camera reported and what the conversion produced,
// decide whether the rotation actually happened and how much is still owed.

/** Mirrors `CameraOrientation` from react-native-vision-camera, restated so this module is pure. */
export type PhotoOrientation = 'up' | 'right' | 'down' | 'left';

export type QuarterTurn = 0 | 90 | 180 | 270;

export interface Size {
  width: number;
  height: number;
}

export interface OrientationCheck {
  /**
   * `true`  — the conversion swapped the axes exactly as the orientation required.
   * `false` — it demonstrably did not, and `residualDegrees` says what is owed.
   * `null`  — the sizes carry no evidence either way. Never treat this as a pass.
   */
  applied: boolean | null;
  /** Clockwise degrees still owed. Always 0 when `applied` is not `false` — never guess. */
  residualDegrees: QuarterTurn;
}

/**
 * Clockwise degrees that bring a buffer captured at `orientation` upright.
 *
 * Direction follows vision-camera's own definition: `'left'` is documented as "rotated 90 degrees
 * left — whatever was top before is now left", so the content's top points left and a clockwise
 * quarter turn puts it back up. `'right'` is the mirror of that.
 */
export function uprightRotationDegrees(orientation: PhotoOrientation): QuarterTurn {
  switch (orientation) {
    case 'left':
      return 90;
    case 'down':
      return 180;
    case 'right':
      return 270;
    default:
      return 0;
  }
}

/**
 * Extra rotation owed AFTER a conversion that reported success.
 *
 * Measured on the Fold 7, 2026-07-26: `photo.orientation` was `'right'` and `isMirrored` was true;
 * `toImageAsync()` swapped the axes as required (3648x2736 -> 2736x3648), so every size-based check
 * passed — and the face came out UPSIDE DOWN. MLKit found nothing on it and the regions fell back
 * to the proportional guess, i.e. the exact failure the capture fix was meant to end, one turn
 * further along.
 *
 * Mechanism, which is why no size check could have caught it:
 *
 *     mirror o rotate(t)  ===  rotate(-t) o mirror
 *
 * Applying the un-mirror and the rotation in the wrong order therefore lands 2t away from upright.
 * For a quarter turn that is 180 degrees; for 'up' or 'down' it is 0 or 360, i.e. no error at all.
 * Both rotations produce identical portrait dimensions, so only pixels can tell them apart.
 *
 * Scope, deliberately narrow. This compensates for observed behaviour in someone else's library,
 * so it is bounded to the case actually observed: a mirrored frame whose orientation is a quarter
 * turn, where the CONVERSION did the rotating. When `rotateAsync` did it (applied === false) no
 * ordering was involved and correcting again would introduce the error rather than remove it.
 * A rear-camera frame is never mirrored and was never tested, so it gets nothing.
 *
 * NOT YET VERIFIED ON iOS, and this project is iOS-primary. 180 degrees has no direction ambiguity,
 * so the correction cannot be applied backwards — but whether iOS needs it at all is unanswered.
 * The dev overlay prints it whenever it fires; see plan Task 15b.
 */
export function conversionResidualDegrees(
  orientation: PhotoOrientation,
  isMirrored: boolean,
  applied: boolean | null,
): QuarterTurn {
  if (applied !== true || !isMirrored) return 0;
  const owed = uprightRotationDegrees(orientation);
  return owed === 90 || owed === 270 ? 180 : 0;
}

const NO_EVIDENCE: OrientationCheck = { applied: null, residualDegrees: 0 };

const isUsable = (s: Size) =>
  Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 0 && s.height > 0;

/**
 * Did converting the captured `Photo` to an `Image` actually apply `orientation`?
 *
 * The only evidence available without pixels is the shape of the result, so this answers only for
 * the quarter turns, which swap the axes. It deliberately returns `null` rather than a guess for:
 *   - `'up'` / `'down'`, which preserve the aspect ratio and so leave no trace in the sizes;
 *   - a square buffer, where `width === height` makes the swap test vacuously true;
 *   - an image matching neither the buffer nor its transpose (a resize happened too).
 *
 * A `null` is not a pass. The dev overlay prints it as "undetermined" for exactly this reason — the
 * previous version of that screen printed a reassuring green line in a case where the check had
 * never run, and the first real device run hit it.
 */
export function checkOrientationApplied(
  orientation: PhotoOrientation,
  photoSize: Size,
  imageSize: Size,
): OrientationCheck {
  if (!isUsable(photoSize) || !isUsable(imageSize)) return NO_EVIDENCE;

  const owed = uprightRotationDegrees(orientation);
  if (owed !== 90 && owed !== 270) return NO_EVIDENCE;
  if (photoSize.width === photoSize.height) return NO_EVIDENCE;

  const swapped = imageSize.width === photoSize.height && imageSize.height === photoSize.width;
  if (swapped) return { applied: true, residualDegrees: 0 };

  const unchanged = imageSize.width === photoSize.width && imageSize.height === photoSize.height;
  if (unchanged) return { applied: false, residualDegrees: owed };

  return NO_EVIDENCE;
}

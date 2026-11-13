// src/features/capture/__tests__/e2e-fixture-real-pipeline.test.ts
//
// Dwight review, HAG-231, fix (c): proves the fixture decodes AND scores to a SPECIFIC,
// deterministic shade through the REAL, unmodified pipeline -- not just that decode doesn't
// throw. Runs every pure step cv-read-engine.ts's device wrapper runs (decode -> orientation ->
// downscale -> regions -> scoreFromRgb -> deriveShade), skipping only the native boundaries
// (expo-file-system's readAsStringAsync, the still-image face detector -- "best-effort" per
// cv-read-engine.ts, so face=null reproduces its own real fallback-regions path, not a stub).
//
// The resulting shadeName is what .maestro/camera-demo-fixture/
// 02_camera_scan_to_shade_match_fixture.yaml asserts on-device -- a value ONLY this real
// derivation can produce, unlike the static "We found your match" / "Your shade" page text.
import jpeg from 'jpeg-js';
import { E2E_FIXTURE_IMAGE_BASE64_JPEG } from '../e2e-fixture-image';
import { applyOrientation, readExifOrientation } from '../../read/exif-orientation';
import { areaDownscale } from '../../read/cv/resample';
import { WORKING_EDGE } from '../../read/decode-rgb';
import { deriveRegionsForFace } from '../../read/face-geometry';
import { scoreFromRgb } from '../../read/cv/score-from-rgb';
import { deriveShade, deriveToneFromLab } from '../../shade/derive-shade';

test('the real (unmodified) read pipeline derives a specific, known shade from this fixture', () => {
  const bytes = Buffer.from(E2E_FIXTURE_IMAGE_BASE64_JPEG, 'base64');
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true }) as {
    width: number;
    height: number;
    data: Uint8Array;
  };

  // Same steps cv-read-engine.ts's real device wrapper runs, in the same order.
  const upright = applyOrientation(
    { width: decoded.width, height: decoded.height, data: new Uint8ClampedArray(decoded.data) },
    readExifOrientation(bytes),
  );
  const rgb = areaDownscale(upright, WORKING_EDGE);
  // detectFacesOnStill is native-only and best-effort (cv-read-engine.ts: "a failure degrades
  // region placement, it must never fail the read") -- face=null exercises that SAME real
  // fallback-regions path, not a stub substitute for it.
  const { regions } = deriveRegionsForFace(null, { width: rgb.width, height: rgb.height });
  const result = scoreFromRgb(rgb, regions);

  expect(result.tone).toBeDefined();
  const shade = deriveShade({
    ...deriveToneFromLab(result.tone!),
    skinType: result.skinType,
    oiliness: result.scores.oiliness,
  });

  // Pinned: a code change to any step above (or a different fixture image) that changes this
  // value is a real signal, not a flaky test -- every input is fully deterministic.
  expect(shade.shadeName).toBe('Light Warm');
});

// src/features/capture/__tests__/e2e-fixture-image.test.ts
// Dwight review (HAG-231, biometric boundary) blocker: the embedded fixture JPEG must actually
// decode with the SAME codec+options the production read path uses
// (src/features/read/decode-rgb.ts: jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true })).
// If it doesn't, run-read.ts's outer catch silently falls back to stubRead() in __DEV__
// (src/features/read/run-read.ts:44-49), and the Maestro flow can reach "We found your match"
// without ever exercising the real read/shade-derivation path it claims to prove. Decoding here
// is therefore not a nice-to-have -- it's the one thing that rules that silent fallback out.
import jpeg from 'jpeg-js';
import { E2E_FIXTURE_IMAGE_BASE64_JPEG } from '../e2e-fixture-image';
import { buildE2EFixtureJpeg } from '../e2e-fixture-generator';

test('the embedded fixture decodes with the production codec+options, at the documented size', () => {
  const bytes = Buffer.from(E2E_FIXTURE_IMAGE_BASE64_JPEG, 'base64');
  // Must not throw -- a throw here is exactly the "unknown JPEG marker" failure Dwight's review
  // found, which silently routes the fixture flow through stubRead() instead of the real read.
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true }) as {
    width: number;
    height: number;
  };
  expect(decoded.width).toBe(120);
  expect(decoded.height).toBe(120);
});

test('the committed base64 matches a FRESH render from the documented generator (not hand-edited)', () => {
  // HAG-231, Dwight review fix (a): compare against a live call to the generator, not a frozen
  // constant someone could update to match a bad regeneration. A mismatch means the committed
  // string was hand-edited, or drifted from eval/fairness/self-test-images.ts's
  // renderSelfTestFace('III') -- regenerate with `npm run e2e:regen-fixture`, don't edit either
  // value by hand.
  const fresh = buildE2EFixtureJpeg();
  expect(E2E_FIXTURE_IMAGE_BASE64_JPEG).toBe(fresh.base64);
});

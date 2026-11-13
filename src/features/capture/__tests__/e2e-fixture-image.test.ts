// src/features/capture/__tests__/e2e-fixture-image.test.ts
// Dwight review (HAG-231, biometric boundary) blocker: the embedded fixture JPEG must actually
// decode with the SAME codec+options the production read path uses
// (src/features/read/decode-rgb.ts: jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true })).
// If it doesn't, run-read.ts's outer catch silently falls back to stubRead() in __DEV__
// (src/features/read/run-read.ts:44-49), and the Maestro flow can reach "We found your match"
// without ever exercising the real read/shade-derivation path it claims to prove. Decoding here
// is therefore not a nice-to-have -- it's the one thing that rules that silent fallback out.
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';
import { E2E_FIXTURE_IMAGE_BASE64_JPEG } from '../e2e-fixture-image';

// Pinned provenance: SHA-256 of the exact decoded bytes, captured the last time this fixture
// was regenerated from eval/fairness/self-test-images.ts's renderSelfTestFace('III') via the
// documented command in e2e-fixture-image.ts's header comment. A mismatch means the committed
// base64 was hand-edited or corrupted since, not regenerated from source -- regenerate it with
// that exact command rather than editing this constant.
const EXPECTED_SHA256 = '287d281c0053cf6e0246f64db804958b456f1556be1731b8dfcdc097db2bfc9d';

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

test('the committed base64 matches its pinned provenance hash (not hand-edited)', () => {
  const bytes = Buffer.from(E2E_FIXTURE_IMAGE_BASE64_JPEG, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  expect(sha256).toBe(EXPECTED_SHA256);
});

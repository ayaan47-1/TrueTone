// src/features/capture/e2e-fixture-generator.ts
//
// Single source of truth for the E2E fixture image (HAG-231, Dwight review fix (b)). Encodes
// eval/fairness/self-test-images.ts's renderSelfTestFace('III') -- the same synthetic,
// not-a-real-person Fitzpatrick-III face the fairness self-test already uses -- to a JPEG with
// the project's existing jpeg-js dependency.
//
// Node-only (jpeg-js's encoder + node:crypto): imported only from Jest tests/tooling, never
// from app runtime code, so it never enters the Metro bundle. Two callers:
//   - src/features/capture/__tests__/e2e-fixture-image.test.ts asserts the committed
//     E2E_FIXTURE_IMAGE_BASE64_JPEG matches a FRESH call to this function, so drift between the
//     two is a test failure, not a silently-stale fixture.
//   - eval/fairness/__tests__/e2e-fixture-generator.regen.test.ts is the regeneration script --
//     run `npm run e2e:regen-fixture` to actually rewrite e2e-fixture-image.ts from this
//     function's current output.
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';
import { renderSelfTestFace } from '../../../eval/fairness/self-test-images';

export interface E2EFixtureJpeg {
  base64: string;
  sha256Hex: string;
}

export function buildE2EFixtureJpeg(): E2EFixtureJpeg {
  const { rgb } = renderSelfTestFace('III');
  const data = Buffer.from(rgb.data.buffer, rgb.data.byteOffset, rgb.data.byteLength);
  const encoded = jpeg.encode({ data, width: rgb.width, height: rgb.height }, 90);
  return {
    base64: encoded.data.toString('base64'),
    sha256Hex: createHash('sha256').update(encoded.data).digest('hex'),
  };
}

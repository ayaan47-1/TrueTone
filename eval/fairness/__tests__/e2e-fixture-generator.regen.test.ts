// eval/fairness/__tests__/e2e-fixture-generator.regen.test.ts
//
// HAG-231, Dwight review fix (b): the committed regeneration SCRIPT for the E2E fixture image
// (src/features/capture/e2e-fixture-image.ts). Not a "copy this snippet by hand" comment -- run:
//
//   npm run e2e:regen-fixture
//
// Lives under eval/ (excluded from the default `npm test` run, same as the rest of this
// directory -- see jest.config.js) and does nothing unless REGEN_E2E_FIXTURE=1 is set, so a
// plain `npm run test:eval` never touches the committed fixture file as a side effect.
import fs from 'node:fs';
import path from 'node:path';
import { buildE2EFixtureJpeg } from '../../../src/features/capture/e2e-fixture-generator';

const TARGET = path.join(__dirname, '../../../src/features/capture/e2e-fixture-image.ts');

const BASE64_LITERAL = /E2E_FIXTURE_IMAGE_BASE64_JPEG =\n {2}'[^']+';/;
const HASH_COMMENT = /\/\/ Generator: .+\n\/\/ SHA-256: [0-9a-f]{64}/;

(process.env.REGEN_E2E_FIXTURE === '1' ? test : test.skip)(
  'regenerates e2e-fixture-image.ts from eval/fairness/self-test-images.ts',
  () => {
    const { base64, sha256Hex } = buildE2EFixtureJpeg();
    let src = fs.readFileSync(TARGET, 'utf8');

    if (!BASE64_LITERAL.test(src)) {
      throw new Error(`${TARGET}: could not find the E2E_FIXTURE_IMAGE_BASE64_JPEG literal to replace`);
    }
    src = src.replace(
      BASE64_LITERAL,
      `E2E_FIXTURE_IMAGE_BASE64_JPEG =\n  '${base64}';`,
    );

    const generatorLine = `// Generator: src/features/capture/e2e-fixture-generator.ts (run \`npm run e2e:regen-fixture\`)\n// SHA-256: ${sha256Hex}`;
    src = HASH_COMMENT.test(src)
      ? src.replace(HASH_COMMENT, generatorLine)
      : src.replace(
          /(export const E2E_FIXTURE_IMAGE_BASE64_JPEG =)/,
          `${generatorLine}\n$1`,
        );

    fs.writeFileSync(TARGET, src);
    // eslint-disable-next-line no-console -- intentional CLI output for the regeneration script
    console.log(`Regenerated ${TARGET}\nSHA-256: ${sha256Hex}`);
  },
);

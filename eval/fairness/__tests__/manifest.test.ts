// eval/fairness/__tests__/manifest.test.ts
import { parseManifest } from '../manifest';

const valid = [{
  imageRef: 'subjA/img1.jpg', fst: 'IV', subjectId: 'subjA',
  lighting: 'indoor-window', source: 'public-consented-set-x',
  consentRef: 'consent-row-123', fstProvenance: 'annotated',
}];

test('parses a valid manifest', () => {
  const out = parseManifest(valid);
  expect(out).toHaveLength(1);
  expect(out[0].fst).toBe('IV');
});
test('rejects an invalid Fitzpatrick value', () => {
  expect(() => parseManifest([{ ...valid[0], fst: 'VII' }])).toThrow();
});
test('rejects a missing consentRef (required for every image)', () => {
  const { consentRef, ...noConsent } = valid[0];
  expect(() => parseManifest([noConsent])).toThrow();
});

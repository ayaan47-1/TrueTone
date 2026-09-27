// Design §5.3: every allergen string passes the disease filter AND the shared medical-claim list.
import { ALLERGEN_COPY, allCopyStrings } from '../allergen-copy';
import { ALLERGEN_GROUPS } from '../ingredients/allergen-groups';
import { ALLERGEN_DISCLAIMER, findMedicalClaims } from '../medical-claims';
import { findDiseaseTerms } from '../../lib/cosmetic-filter';

const strings = [...allCopyStrings(), ...ALLERGEN_GROUPS.map((g) => g.label)];

test('there is copy to check', () => {
  expect(strings.length).toBeGreaterThan(20);
});

test.each(strings.map((s) => [s]))('passes the disease filter: %s', (s) => {
  expect(findDiseaseTerms(s)).toEqual([]);
});

test.each(strings.map((s) => [s]))('passes the medical-claim blocklist (strict): %s', (s) => {
  expect(findMedicalClaims(s)).toEqual([]);
});

test('the disclaimer is the canonical compliance.md §2.3 string', () => {
  expect(ALLERGEN_COPY.disclaimer).toBe(ALLERGEN_DISCLAIMER);
});

test('the Setup question never names the user\'s health (design C1b)', () => {
  const q = `${ALLERGEN_COPY.setup.title} ${ALLERGEN_COPY.setup.subtitle}`.toLowerCase();
  expect(q).not.toMatch(/allergic|your allerg|sensitive to/);
});

test('templated strings fill their slots', () => {
  expect(ALLERGEN_COPY.settingsRow.sub(3)).toBe('3 flagged');
  expect(ALLERGEN_COPY.settingsRow.sub(0)).toBe('None');
  expect(ALLERGEN_COPY.referralNote('Latex')).toContain('Latex');
});

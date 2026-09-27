// Design §2.4: the reused wa_health policy names the ingredient-flag category, purpose, source,
// sharing (no one), storage (this phone only) and how to view/edit/delete. Counsel finalizes (D2).
import fs from 'fs';
import path from 'path';
import { POLICY_BODIES } from '../bodies';
import { findMedicalClaims } from '../medical-claims';
import { findDiseaseTerms } from '../../lib/cosmetic-filter';

const md = fs.readFileSync(path.join(__dirname, '..', 'wa_health.md'), 'utf8');
const retention = fs.readFileSync(path.join(__dirname, '..', 'retention.md'), 'utf8');

test.each([['wa_health.md', md], ['bodies.wa_health', POLICY_BODIES.wa_health]])(
  '%s covers the ingredient flags and stays a counsel placeholder', (_name, text) => {
    const t = text.toLowerCase();
    expect(t).toContain('placeholder');
    expect(t).toContain('ingredient flags');
    expect(t).toContain('only on this phone');
    expect(t).toContain('no one');
    expect(t).toMatch(/view, edit.*delete/);
    expect(findMedicalClaims(text)).toEqual([]);
    expect(findDiseaseTerms(text)).toEqual([]);
  },
);

test('retention schedule says ingredient flags are on-device only', () => {
  expect(retention.toLowerCase()).toMatch(/ingredient flags.*only on (this|your) phone/);
});

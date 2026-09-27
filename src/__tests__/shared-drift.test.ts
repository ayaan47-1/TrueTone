// src/__tests__/shared-drift.test.ts
// Compliance drift guard: ensures Edge Function _shared copies stay in sync with src originals.
// CLAUDE.md §1 violation: silent drift in disease blocklist or medical triggers = launch blocker.

import fs from 'fs';
import path from 'path';
import { DISEASE_BLOCKLIST } from '../content/cosmetic-vocab';

describe('Compliance module drift detection', () => {
  const repoRoot = path.join(__dirname, '..', '..');

  describe('DISEASE_BLOCKLIST sync check', () => {
    test('every term in DISEASE_BLOCKLIST appears quoted in _shared/cosmetic-vocab.ts', () => {
      const sharedVocabPath = path.join(repoRoot, 'supabase', 'functions', '_shared', 'recommend', 'cosmetic-vocab.ts');
      const sharedContent = fs.readFileSync(sharedVocabPath, 'utf8');

      for (const term of DISEASE_BLOCKLIST) {
        const quotedPattern = `'${term}'`;
        expect(sharedContent).toContain(quotedPattern);
      }
    });
  });

  describe('MEDICAL_TRIGGERS sync check', () => {
    test('every trigger from src refusal.ts appears in _shared refusal.ts', () => {
      const srcRefusalPath = path.join(repoRoot, 'src', 'features', 'recommend', 'chat', 'refusal.ts');
      const srcContent = fs.readFileSync(srcRefusalPath, 'utf8');

      // Extract MEDICAL_TRIGGERS array from src
      const srcArrayMatch = srcContent.match(/const MEDICAL_TRIGGERS = \[([\s\S]*?)\];/);
      expect(srcArrayMatch).not.toBeNull();

      if (!srcArrayMatch) return;

      // Parse the array items: look for quoted strings
      const triggerMatches = srcArrayMatch[1].match(/'([^']+)'/g) || [];
      const srcTriggers = triggerMatches.map((m) => m.slice(1, -1)); // Remove quotes

      const sharedRefusalPath = path.join(repoRoot, 'supabase', 'functions', '_shared', 'recommend', 'refusal.ts');
      const sharedContent = fs.readFileSync(sharedRefusalPath, 'utf8');

      // Verify each trigger appears in _shared
      for (const trigger of srcTriggers) {
        const quotedPattern = `'${trigger}'`;
        expect(sharedContent).toContain(quotedPattern);
      }
    });
  });

  describe('guardReply fail-closed marker check', () => {
    test('_shared guard.ts contains FALLBACK_MESSAGE and findDiseaseTerms call', () => {
      const sharedGuardPath = path.join(repoRoot, 'supabase', 'functions', '_shared', 'recommend', 'guard.ts');
      const sharedContent = fs.readFileSync(sharedGuardPath, 'utf8');

      // Verify fail-closed markers
      expect(sharedContent).toContain('FALLBACK_MESSAGE');
      expect(sharedContent).toContain('findDiseaseTerms');
      expect(sharedContent).toContain('guardReply');
    });
  });

  describe('medical-claim / allergy guard sync check (founder no-medical-advice rule)', () => {
    const shared = (f: string) =>
      fs.readFileSync(path.join(repoRoot, 'supabase', 'functions', '_shared', 'recommend', f), 'utf8');
    const { MEDICAL_CLAIM_BLOCKLIST, ALLERGEN_DISCLAIMER } = require('../content/medical-claims');
    const { ALLERGY_REFUSAL } = require('../features/recommend/chat/refusal');

    test('_shared medical-claims.ts carries every blocklist phrase and the disclaimer', () => {
      expect(shared('medical-claims.ts')).toContain('SOURCE OF TRUTH: src/content/medical-claims.ts');
      const sharedMod = require('../../supabase/functions/_shared/recommend/medical-claims.ts');
      expect(sharedMod.ALLERGEN_DISCLAIMER).toBe(ALLERGEN_DISCLAIMER);
      expect([...sharedMod.MEDICAL_CLAIM_BLOCKLIST]).toEqual([...MEDICAL_CLAIM_BLOCKLIST]);
    });

    test('every ALLERGY_TRIGGER from src refusal.ts appears in _shared refusal.ts', () => {
      const src = fs.readFileSync(path.join(repoRoot, 'src', 'features', 'recommend', 'chat', 'refusal.ts'), 'utf8');
      const m = src.match(/const ALLERGY_TRIGGERS = \[([\s\S]*?)\];/);
      expect(m).not.toBeNull();
      const triggers = (m![1].match(/'([^']+)'/g) || []).map((t) => t.slice(1, -1));
      expect(triggers.length).toBeGreaterThan(0);
      const content = shared('refusal.ts');
      for (const t of triggers) expect(content).toContain(`'${t}'`);
      expect(content).toContain('isAllergyQuery');
      expect(content).toContain('ALLERGY_REFUSAL');
      expect(ALLERGY_REFUSAL).toContain(ALLERGEN_DISCLAIMER);
    });

    // Code review M6: presence checks miss a changed regex or a reordered guard. Compare the whole
    // file, with import statements and full-line comments removed (only import paths may differ).
    const normalize = (text: string) =>
      text
        .replace(/^\s*(?:import|export)\s[^;]*?\sfrom\s+['"][^'"]+['"];?[ \t]*$/gms, '')
        .replace(/^\s*import\s+['"][^'"]+['"];?[ \t]*$/gm, '')
        .split('\n')
        .filter((line) => line.trim() !== '' && !line.trim().startsWith('//'))
        .join('\n');
    const SOURCES: [string, string][] = [
      ['guard.ts', 'src/features/recommend/chat/guard.ts'],
      ['handle.ts', 'src/features/recommend/chat/handle.ts'],
      ['refusal.ts', 'src/features/recommend/chat/refusal.ts'],
      ['prompt.ts', 'src/features/recommend/chat/prompt.ts'],
      ['medical-claims.ts', 'src/content/medical-claims.ts'],
    ];

    test.each(SOURCES)('_shared %s matches its src original apart from imports and comments', (file, src) => {
      const original = fs.readFileSync(path.join(repoRoot, src), 'utf8');
      expect(normalize(shared(file))).toBe(normalize(original));
    });

    test('_shared guard.ts and handle.ts run the medical-claim check and allergy refusal', () => {
      expect(shared('guard.ts')).toContain('findMedicalClaims');
      expect(shared('guard.ts')).toContain('ALLERGEN_DISCLAIMER');
      expect(shared('handle.ts')).toContain('isAllergyQuery');
      expect(shared('prompt.ts')).toContain('not a medical or allergy professional');
    });
  });
});

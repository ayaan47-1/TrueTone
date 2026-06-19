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
});

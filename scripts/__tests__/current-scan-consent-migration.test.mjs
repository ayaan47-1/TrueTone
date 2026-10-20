import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/0028_current_scan_consent.sql', 'utf8');
const feedbackMigration = readFileSync(
  'supabase/migrations/0029_current_scan_feedback_consent.sql',
  'utf8',
);

function functionDefinition(name) {
  const match = migration.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?end; \\$\\$;`),
  );
  assert.ok(match, `${name} must be defined in migration 0028`);
  return match[0];
}

test('has_current_scan_consent compares the caller receipt to the server-current policy', () => {
  const definition = functionDefinition('has_current_scan_consent');
  assert.match(definition, /auth\.uid\(\)/);
  assert.match(definition, /doc_key\s*=\s*'biometric'/);
  assert.match(definition, /is_current/);
  assert.match(definition, /policy_version\s*=\s*v_version/);
});

test('record_scan enforces current-version consent on the server', () => {
  const definition = functionDefinition('record_scan');
  assert.match(definition, /public\.has_current_scan_consent\(\)/);
});

test('record_ai_consent enforces its current biometric prerequisite on the server', () => {
  const definition = functionDefinition('record_ai_consent');
  assert.match(definition, /public\.has_current_scan_consent\(\)/);
});

test('the current-consent RPC is caller-only', () => {
  assert.match(
    migration,
    /revoke all on function public\.has_current_scan_consent\(\) from public;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.has_current_scan_consent\(\) to authenticated;/,
  );
});

test('routine feedback enforces current-version scan consent on the server', () => {
  assert.match(
    feedbackMigration,
    /create or replace function public\.set_routine_feedback[\s\S]*public\.has_current_scan_consent\(\)/,
  );
});

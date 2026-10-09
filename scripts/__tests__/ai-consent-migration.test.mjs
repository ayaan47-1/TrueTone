import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/0027_ai_consent.sql', 'utf8');

function functionDefinition(name) {
  const match = migration.match(
    new RegExp(`create or replace function public\\.${name}\\(\\)[\\s\\S]*?end; \\$\\$;`),
  );
  assert.ok(match, `${name} must be defined in migration 0027`);
  return match[0];
}

test('scan-consent withdrawal also records and clears active AI consent', () => {
  const definition = functionDefinition('withdraw_consent');
  assert.match(definition, /'withdrawn',\s*v_ai_version,\s*'ai_routine_chat'/);
  assert.match(definition, /ai_consent_active=false/);
});

test('record_consent re-records a current receipt when the active receipt version is old', () => {
  const definition = functionDefinition('record_consent');
  assert.match(definition, /policy_version=v_version/);
});

test('delete_my_data is idempotent when the caller profile is missing', () => {
  assert.match(functionDefinition('delete_my_data'), /if not found then return; end if;/);
});

test('retention sweep writes an AI deleted receipt before de-identification', () => {
  const definition = functionDefinition('truetone_retention_sweep');
  assert.match(definition, /'deleted',\s*v_ai_version,\s*'ai_routine_chat'/);
  assert.ok(
    definition.indexOf("'ai_routine_chat'") <
      definition.indexOf('update public.consent_log set user_id = null'),
  );
});

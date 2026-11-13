import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectFeedbackBoundary, feedbackFiles } from '../check-shade-feedback-boundary.mjs';
import { findEgress } from '../check-no-image-egress.mjs';

test('production feature obeys exact fields and disabled collection',()=>{
  assert.deepEqual(inspectFeedbackBoundary(feedbackFiles()),[]);
});
test('guard rejects added database columns, payload keys, and third-party transports',()=>{
  const baseline=feedbackFiles();
  const sql='supabase/migrations/0039_shade_feedback.sql';
  const contract='src/features/shade-feedback/contract.ts';
  for(const forbidden of ['skin_rgb','private_blob','arbitrary_metadata']) {
    assert.ok(inspectFeedbackBoundary({...baseline,[sql]:baseline[sql].replace('  id uuid primary key',`  ${forbidden} text,\n  id uuid primary key`)}).length);
    assert.ok(inspectFeedbackBoundary({...baseline,[contract]:baseline[contract].replace('consent_receipt_id:z.uuid()',`${forbidden}:z.string(),consent_receipt_id:z.uuid()`)}).length);
  }
  for(const forbidden of ["fetch('https://example.com')", "import x from '../shopify/client'", 'supabase.storage.from("x")', 'new FormData()', 'const imageUri="x"']) {
    assert.ok(inspectFeedbackBoundary({...baseline,'app/shade-feedback.tsx':baseline['app/shade-feedback.tsx']+'\n'+forbidden}).length);
  }
});
test('egress guard includes feedback files and catches bytes, URIs, FormData and storage calls',()=>{
  const source=readFileSync(new URL('../check-no-image-egress.mjs',import.meta.url),'utf8');
  assert.match(source,/shade-feedback/);
  for(const bad of ['fetch(url,{body:imageUri})','new FormData()','supabase.storage.from("x").upload(bytes)']) assert.ok(findEgress(bad).length);
});
test('feedback copy contains no medical, certainty, percentage or equity claims',()=>{
  const copy=['ShadeFeedbackScreen.tsx','ShadeFeedbackConsent.tsx','FeedbackDataPanel.tsx'].map(name=>readFileSync(new URL(`../../src/features/shade-feedback/${name}`,import.meta.url),'utf8')).join('\n');
  assert.doesNotMatch(copy,/diagnos|treat(?:ment)?\b|disease|cure\b|\d+\s*%|perfect|exact match|guaranteed|skin.tone.equity/i);
});

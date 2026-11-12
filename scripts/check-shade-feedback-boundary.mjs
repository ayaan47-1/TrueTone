import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const eventFields='id user_id consent_receipt_id recommendation_id engine_version catalog_as_of estimated_variant_gid estimated_label_id estimated_label_revision estimated_formula_version tried_variant_gid depth_correction undertone_correction outcome displayed_at submitted_at outcome_at expires_at purpose_closed_at'.split(' ');
const candidateFields='feedback_id user_id position variant_gid label_id label_revision formula_version available_at_display'.split(' ');
const payloadFields=eventFields.filter(key=>!['id','user_id','submitted_at','outcome_at','expires_at','purpose_closed_at'].includes(key)).concat('candidates');
const correctionFields=['depth_correction','undertone_correction','outcome'];
const localFields=['variant_gid',...correctionFields];
const shapes=new Map([
  ['feedbackSchema',payloadFields],['candidateSchema',candidateFields.filter(key=>!['feedback_id','user_id'].includes(key))],
  ['correctionSchema',correctionFields],['localAnswerSchema',localFields],
]);
const sameFields = (actual,expected) => actual.length===expected.length && [...actual].sort().join('|')===[...expected].sort().join('|');

function filesUnder(path) {
  return readdirSync(path,{withFileTypes:true}).flatMap(entry=>{
    if(entry.name==='__tests__') return [];
    const file=join(path,entry.name);
    return entry.isDirectory()?filesUnder(file):/\.tsx?$/.test(file)?[file]:[];
  });
}
export function feedbackFiles() {
  const paths=[...filesUnder('src/features/shade-feedback'),'app/shade-feedback.tsx','supabase/migrations/0039_shade_feedback.sql'];
  return Object.fromEntries(paths.map(path=>[path,readFileSync(path,'utf8')]));
}

export function inspectFeedbackBoundary(files) {
  const failures=[];
  const sql=files['supabase/migrations/0039_shade_feedback.sql']??'';
  const tables=[...sql.matchAll(/create table public\.([a-z_]+)/gi)].map(match=>match[1]);
  if(!sameFields(tables,['shade_feedback_events','shade_feedback_candidates'])) failures.push('only the two reviewed tables are allowed');
  if(/\bnet\.http|\bhttp_post\b|raise\s+(?:log|notice|debug)|\bexecute\s+(?:format|'|quote)|(?:insert into|update|delete from)\s+public\.catalog_/i.test(sql)) failures.push('SQL crosses the feedback boundary');
  for(const [name,expected] of [['shade_feedback_events',eventFields],['shade_feedback_candidates',candidateFields]]) {
    const table=sql.match(new RegExp(`create table public\\.${name} \\(([\\s\\S]*?)\\n\\);`,'i'));
    const fields=table?.[1].split('\n').map(line=>line.trim()).filter(line=>/^[a-z_]+\s+(?:uuid|text|integer|boolean|timestamptz)\b/i.test(line)).map(line=>line.split(/\s/)[0])??[];
    if(!sameFields(fields,expected)) failures.push(`${name}: field allowlist changed`);
  }
  for(const [value,expected] of [['p_event',payloadFields],['c',shapes.get('candidateSchema')],['p_correction',correctionFields]]) {
    const match=sql.match(new RegExp(`shade_feedback_keys\\(${value},array\\[([^\\]]+)\\]\\)`));
    const fields=[...(match?.[1]??'').matchAll(/'([^']+)'/g)].map(match=>match[1]);
    if(!sameFields(fields,expected)) failures.push(`${value}: RPC allowlist changed`);
  }
  if(!/shade_feedback_enabled\(\).*?\$\$select false\$\$/s.test(sql)) failures.push('server collection must stay disabled');
  if(/(?:join|references)\s+(?:public\.)?scans\b/i.test(sql)) failures.push('prohibited relationship');
  const contract=files['src/features/shade-feedback/contract.ts']??'';
  const syntax=ts.createSourceFile('contract.ts',contract,ts.ScriptTarget.Latest,true);
  for(const [name,expected] of shapes) {
    let fields=[];
    function visit(node) {
      if(ts.isVariableDeclaration(node) && node.name.getText(syntax)===name && node.initializer) {
        function findObject(child) {
          if(ts.isCallExpression(child) && child.expression.getText(syntax)==='z.strictObject') {
            const arg=child.arguments[0];
            if(arg && ts.isObjectLiteralExpression(arg)) fields=arg.properties.map(property=>property.name?.getText(syntax).replace(/['"]/g,'')??'spread');
          }
          ts.forEachChild(child,findObject);
        }
        findObject(node.initializer);
      }
      ts.forEachChild(node,visit);
    }
    visit(syntax);
    if(!sameFields(fields,expected)) failures.push(`${name}: client allowlist changed`);
  }
  const flags=files['src/features/shade-feedback/flags.ts']??'';
  if(!/SERVER_FEEDBACK_ENABLED:\s*boolean\s*=\s*false/.test(flags)) failures.push('client collection must stay disabled');
  for(const [file,source] of Object.entries(files)) {
    if(file.endsWith('.sql')) continue;
    const banned=/\bfetch\s*\(|\.storage\b|\.upload\s*\(|\b(?:XMLHttpRequest|WebSocket|axios|sendBeacon|FormData|imageUri)\b|supabase\.(?!rpc\b)|\b(?:blob|base64|pixels?|landmarks?|embeddings?|scan_?id|score|confidence|percentage|accuracy|hex|rgb|lch|ita|deltaE|advertising_?id|order_?id|cart_?id|customer_?id|metadata)\b/i;
    if(banned.test(source)) failures.push(`${file}: prohibited data or transport`);
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    function inspect(node) {
      if(ts.isCallExpression(node) && node.expression.getText(ast)==='rpc') {
        const name=node.arguments[0];
        if(!name || !ts.isStringLiteral(name) || !['record_shade_feedback','list_shade_feedback','delete_shade_feedback','set_shade_feedback_consent'].includes(name.text)) failures.push(`${file}: unreviewed RPC`);
      }
      if(ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
        /shopify|checkout|analytics|camera|scan-record|\bscans\b|openai|anthropic|filesystem|node:fs/i.test(node.moduleSpecifier.text)) failures.push(`${file}: prohibited import`);
      if(ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const module=node.moduleSpecifier.text;
        const fixed=['react','react-native','zod','expo-router','../../components/ui','../../lib/supabase','../../lib/encrypted-storage','../src/components/ui','../src/lib/profile-context'];
        if(!fixed.includes(module) && !/^\.\/[A-Za-z][\w-]*$/.test(module) && !/^\.\.\/src\/features\/shade-feedback\/[A-Za-z][\w-]*$/.test(module)) failures.push(`${file}: unreviewed import`);
        const bindings=node.importClause?.namedBindings;
        if(bindings && ts.isNamedImports(bindings) && bindings.elements.some(element=>['Share','Linking','Image','XMLHttpRequest'].includes((element.propertyName??element.name).text))) failures.push(`${file}: unreviewed destination`);
      }
      ts.forEachChild(node,inspect);
    }
    inspect(ast);
  }
  return failures;
}
if(import.meta.url===`file://${process.argv[1]}`) {
  const failures=inspectFeedbackBoundary(feedbackFiles());
  if(failures.length) {process.stderr.write(`${failures.join('\n')}\n`);process.exitCode=1;}
  else process.stdout.write('compliance: shade feedback boundaries and disabled collection verified\n');
}

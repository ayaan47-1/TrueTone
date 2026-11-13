// The Edge Function runs copies of these modules from supabase/functions/_shared/recommend/.
// MASVS M3 fixes must not drift between the Jest-tested source and the deployed copy.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../../..');
const normalize = (s: string) =>
  s
    .split('\n')
    .filter((l) => !l.startsWith('// SOURCE OF TRUTH') && !/^import /.test(l))
    .join('\n')
    .trim();

test.each(['handle', 'validate'])('_shared/recommend/%s.ts matches its source of truth', (name) => {
  const src = readFileSync(join(ROOT, `src/features/recommend/chat/${name}.ts`), 'utf8');
  const copy = readFileSync(join(ROOT, `supabase/functions/_shared/recommend/${name}.ts`), 'utf8');
  expect(normalize(copy)).toBe(normalize(src));
});

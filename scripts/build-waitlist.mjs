import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Builds the static assets the marketing site in web/ cannot keep by hand:
//
//   1. web/policies/*.html — generated from src/content/*.md, so the website and the app
//      can never state different terms. The app reads those files through
//      src/content/bodies.ts; this renders the same source for the web.
//   2. web/fonts/*.woff2   — Fraunces and Mulish subset out of node_modules, so the page
//      loads no font from fonts.googleapis.com and leaks no visitor IP to Google.
//      scripts/check-waitlist-copy.mjs fails the build if that ever regresses.
//   3. web/config.js + web/_headers — written from the environment at build time.

const CONTENT_DIR = 'src/content';
const OUT_DIR = 'web';

// ── markdown ──────────────────────────────────────────────────────────────────
// The five policy documents use headings, blockquotes, bold, bullet lists and
// paragraphs. A full CommonMark dependency would add supply-chain surface to publish
// legal text; this does exactly what the source needs and nothing it doesn't.

export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text) {
  // Escaping runs first so a literal "<b>" in a policy can never emit live markup.
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

export function renderMarkdown(md) {
  return md
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = block.match(/^(#{1,3})\s+(.*)$/s);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${inline(heading[2].trim())}</h${level}>`;
      }
      if (block.startsWith('>')) {
        const text = block.replace(/^>\s?/gm, '').replace(/\n/g, ' ');
        return `<blockquote>${inline(text.trim())}</blockquote>`;
      }
      if (/^[-*]\s+/.test(block)) {
        // Continuation lines are indented under their bullet, not new bullets.
        const items = block
          .split(/\n(?=[-*]\s+)/)
          .map((li) => inline(li.replace(/^[-*]\s+/, '').replace(/\n\s+/g, ' ').trim()));
        return `<ul>\n${items.map((i) => `<li>${i}</li>`).join('\n')}\n</ul>`;
      }
      // Source files hard-wrap at ~100 chars; those newlines are not paragraph breaks.
      return `<p>${inline(block.replace(/\n/g, ' '))}</p>`;
    })
    .join('\n');
}

// ── page shell ────────────────────────────────────────────────────────────────
// Palette is the app's own Mist system (tailwind.config.js), so a policy page opened
// from the website looks like the same product as the one opened inside the app.
const POLICY_CSS = `
@font-face{font-family:Fraunces;src:url(/fonts/fraunces-light.woff2)format("woff2");font-weight:300;font-display:swap}
@font-face{font-family:Fraunces;src:url(/fonts/fraunces-regular.woff2)format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:Mulish;src:url(/fonts/mulish-light.woff2)format("woff2");font-weight:300;font-display:swap}
@font-face{font-family:Mulish;src:url(/fonts/mulish-semibold.woff2)format("woff2");font-weight:600;font-display:swap}
*{box-sizing:border-box}
body{margin:0;padding:56px 24px 96px;background:#FBF7F2;color:#221F1A;
  font-family:Mulish,system-ui,sans-serif;font-weight:300;line-height:1.65}
main{max-width:660px;margin:0 auto}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:300;letter-spacing:-.015em;line-height:1.15}
h1{font-size:2.1rem;margin:0 0 .6em}
h2{font-size:1.4rem;margin:1.8em 0 .5em}
h3{font-size:1.1rem;margin:1.6em 0 .4em}
p{margin:0 0 1.1em}
strong{font-weight:600}
ul{margin:0 0 1.1em;padding-left:20px}
li{margin:0 0 .5em}
blockquote{margin:0 0 1.8em;padding:14px 18px;border-radius:14px;
  background:#F3EDE3;border:1px solid #EBE2D3;color:#6B655B;font-size:.9rem}
a{color:#6B655B}
.back{display:inline-block;margin-bottom:32px;font-size:.82rem;letter-spacing:.02em;color:#6B655B}
.ver{margin-top:56px;padding-top:20px;border-top:1px solid #EBE2D3;font-size:.78rem;color:#8A8378}
`.trim();

export function renderPolicyPage({ title, bodyHtml, version }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)} — TrueTone</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<style>${POLICY_CSS}</style>
</head>
<body>
<main>
<a class="back" href="/">← TrueTone</a>
${bodyHtml}
<p class="ver">Policy version ${escapeHtml(version)} · United States only · 18+</p>
</main>
</body>
</html>
`;
}

// ── manifest ──────────────────────────────────────────────────────────────────
// Parsed out of the TypeScript manifest rather than duplicated, so adding a policy to
// the app adds it to the website too.
export function parseManifest(source) {
  const version = source.match(/POLICY_VERSION\s*=\s*'([^']+)'/)?.[1];
  if (!version) throw new Error('could not read POLICY_VERSION from src/content/manifest.ts');
  const docs = [...source.matchAll(/\{\s*key:\s*'([^']+)',\s*title:\s*'([^']+)'\s*\}/g)]
    .map(([, key, title]) => ({ key, title }));
  if (!docs.length) throw new Error('could not read POLICY_DOCS from src/content/manifest.ts');
  return { version, docs };
}

// ── headers ───────────────────────────────────────────────────────────────────
// Cloudflare Pages reads web/_headers. scripts/check-waitlist-copy.mjs already fails the
// build if a third-party origin is committed into the HTML; this stops one that is
// injected at runtime. Both exist because the page's central claim — nothing third-party
// touches it (CLAUDE.md §1) — should be enforced, not merely intended.
export function renderHeaders(supabaseOrigin) {
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin}`,
    "base-uri 'none'",
    // The form is submitted with fetch() after preventDefault, never natively, so a
    // native submit anywhere would be a hijack.
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  return `# Generated by scripts/build-waitlist.mjs — do not edit.
/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

// ── generated config ──────────────────────────────────────────────────────────
export function renderConfig(supabaseUrl, anonKey) {
  for (const value of [supabaseUrl, anonKey]) {
    // These come from the environment and are interpolated into a JS string literal.
    if (/['"\\\r\n<>]/.test(value)) throw new Error('unsafe character in Supabase config value');
  }
  return `// Generated by scripts/build-waitlist.mjs — do not edit, do not commit.
window.TRUETONE_CONFIG = {
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${anonKey}',
};
`;
}

// ── fonts ─────────────────────────────────────────────────────────────────────
// Latin subset only; these pages are US-English. Keeps each face around 15–25 KB.
const UNICODES = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+2122,U+2212,U+FEFF';

const FONT_FACES = [
  ['@expo-google-fonts/fraunces/300Light/Fraunces_300Light.ttf', 'fraunces-light.woff2'],
  ['@expo-google-fonts/fraunces/300Light_Italic/Fraunces_300Light_Italic.ttf', 'fraunces-light-italic.woff2'],
  ['@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf', 'fraunces-regular.woff2'],
  ['@expo-google-fonts/mulish/300Light/Mulish_300Light.ttf', 'mulish-light.woff2'],
  ['@expo-google-fonts/mulish/400Regular/Mulish_400Regular.ttf', 'mulish-regular.woff2'],
  ['@expo-google-fonts/mulish/600SemiBold/Mulish_600SemiBold.ttf', 'mulish-semibold.woff2'],
];

/** The subset output is committed, so a deploy needs neither pyftsubset nor node_modules.
 *  Re-subsetting only happens when a face is missing or the toolchain is available — which
 *  in practice means "when a developer changes the fonts". */
function fontsNeedBuilding(outDir) {
  return FONT_FACES.some(([, outName]) => !existsSync(join(outDir, outName)));
}

function haveSubsetter() {
  try {
    execFileSync('pyftsubset', ['--help'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function buildFonts() {
  const outDir = join(OUT_DIR, 'fonts');
  mkdirSync(outDir, { recursive: true });

  if (!fontsNeedBuilding(outDir) && !haveSubsetter()) {
    console.log('  using committed subsets (pyftsubset not installed)');
    return;
  }
  if (fontsNeedBuilding(outDir) && !haveSubsetter()) {
    throw new Error(
      'Font subsets are missing and pyftsubset is not installed.\n' +
        'Install it with: pip install fonttools brotli',
    );
  }

  for (const [rel, outName] of FONT_FACES) {
    const src = join('node_modules', rel);
    if (!existsSync(src)) {
      // node_modules is absent on a deploy box; the committed subset is what ships.
      console.log(`  ${outName}  (committed subset; font source not installed)`);
      continue;
    }
    const out = join(outDir, outName);
    execFileSync('pyftsubset', [
      src,
      `--output-file=${out}`,
      '--flavor=woff2',
      `--unicodes=${UNICODES}`,
      '--layout-features=kern,liga,calt',
      '--no-hinting',
      '--desubroutinize',
    ]);
    console.log(`  ${outName}  ${(statSync(out).size / 1024).toFixed(1)} KB`);
  }
}

function buildPolicies() {
  const { version, docs } = parseManifest(readFileSync(join(CONTENT_DIR, 'manifest.ts'), 'utf8'));
  const outDir = join(OUT_DIR, 'policies');
  mkdirSync(outDir, { recursive: true });
  for (const { key, title } of docs) {
    const md = readFileSync(join(CONTENT_DIR, `${key}.md`), 'utf8');
    const page = renderPolicyPage({ title, bodyHtml: renderMarkdown(md), version });
    writeFileSync(join(outDir, `${key}.html`), page);
    console.log(`  policies/${key}.html  (${title})`);
  }
  return { version, docs };
}

function buildRuntime() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set.\n' +
        'Without them the form would render but store nothing.',
    );
  }
  const origin = new URL(url).origin;
  writeFileSync(join(OUT_DIR, 'config.js'), renderConfig(origin, key));
  writeFileSync(join(OUT_DIR, '_headers'), renderHeaders(origin));
  console.log(`  config.js + _headers  (connect-src → ${origin})`);
}

function build() {
  console.log('fonts:');
  buildFonts();
  console.log('policies:');
  const { version } = buildPolicies();
  console.log('runtime:');
  buildRuntime();
  console.log(`\nbuilt web/ assets at policy version ${version}`);
}

if (import.meta.url === `file://${process.argv[1]}`) build();

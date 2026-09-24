// scripts/check-no-image-egress.mjs
//
// Gap 11 — image-egress assurance. Two complementary layers, both dependency-free
// (Node built-ins only, so `node --test` and CI run with zero install):
//
//   LAYER 1 (legacy token scan): fast substring check for the obvious upload/storage
//     tokens in the scan-pipeline dirs. Kept verbatim for backward compatibility and
//     as a cheap first tripwire. `findEgress` is unchanged.
//
//   LAYER 2 (sink / co-occurrence scan): the real invariant from CLAUDE.md §3 —
//     "only derived scores cross the compliance boundary; the image never does."
//     Layer 1 only knows five literal tokens, so it misses the leaks that matter:
//       - the actual image variable is `photoUri` / `uri`, not the token `imageUri`;
//       - `readAsStringAsync(uri,{encoding:base64})` -> a base64 string handed to
//         `supabase.rpc(...)` uses NONE of the forbidden tokens;
//       - the app's real network sink is `supabase.rpc` / `.from().insert`, not `fetch`;
//       - `console.log(photoUri)` / a crash reporter attaching the image is egress too;
//       - the network layer (`src/lib`) is not scanned at all by Layer 1.
//     Layer 2 strips comments and string/template literals first (kills the false
//     positives and the "hide the token inside a string" bypass), then enforces two
//     rules described below. See docs/security/tt-gap11-image-egress-threat-model.md.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// ---------------------------------------------------------------------------
// LAYER 1 — legacy token scan (unchanged; `findEgress` contract is stable).
// ---------------------------------------------------------------------------
const FORBIDDEN = ['.storage', 'upload', 'imageUri', 'photo.path', 'FormData'];
const GUARDED_DIRS = ['src/features/capture', 'src/features/read', 'app/(dev)'];
const ALLOW = ['deleteAsync', 'FileSystem', 'normalizeToTensor', 'readAsStringAsync'];

export function findEgress(text) {
  const cleaned = ALLOW.reduce((s, a) => s.split(a).join(''), text);
  return FORBIDDEN.filter((f) => cleaned.includes(f));
}

// ---------------------------------------------------------------------------
// LAYER 2 — sink / co-occurrence scan.
// ---------------------------------------------------------------------------

// Symbols that carry the raw image, its bytes, or a handle to them. These are the
// things that must never reach a network/log sink. Deliberately matches the names
// the codebase actually uses (`photoUri`, bare `uri`, `u`) plus the base64 read that
// turns a file into an exfiltratable string.
const IMAGE_REFS = [
  /\bphotoUri\b/,
  /\bimageUri\b/,
  /\bphoto\.path\b/,
  /\breadAsStringAsync\b/, // reading the file into a (base64) string = image bytes in JS
  /\bbase64\b/,
  /\bphotoPath\b/,
  /\bimageBytes\b/,
  /\brawImage\b/,
  /\bframe\.(toArrayBuffer|toString|bytes)\b/, // vision-camera frame bytes
];

// Anything that can move bytes off the device or into a log/report sink.
const SINKS = [
  /\.rpc\s*\(/, // supabase.rpc(...)  <-- the app's real write path
  /\.from\s*\([^)]*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/, // supabase table writes
  /\.storage\b/,
  /\.upload\s*\(/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bnavigator\.sendBeacon\b/,
  /\bFormData\b/,
  /\baxios\b/,
  /\bconsole\.(log|info|warn|error|debug)\s*\(/,
  /\bcaptureException\b|\bSentry\b|\baddBreadcrumb\b/, // crash reporter (CLAUDE.md §2: never attach images)
];

// The network/egress layer: allowed to call sinks (that is its whole job), but must
// never so much as reference an image symbol. A clean, near-zero-false-positive rule.
const NETWORK_LAYER_DIRS = ['src/lib'];

// Inline escape hatch for the rare legitimate case Layer 2 can't tell apart. Grep-able
// on its own (`grep -rn 'egress-ok' src`) so every suppression stays auditable.
const SUPPRESS = 'egress-ok';

// Remove line/block comments and the CONTENTS of string + template literals, so a token
// inside a comment or a string can neither raise a false positive nor hide a real one.
// Not a full parser — a small lexer that is sound for TS/TSX source.
export function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'sq'; out += "''"; i++; continue; }
      if (c === '"') { state = 'dq'; out += '""'; i++; continue; }
      if (c === '`') { state = 'tpl'; out += '``'; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += '\n'; } i++; continue; }
    if (state === 'block') { if (c === '*' && c2 === '/') { state = 'code'; i += 2; } else { if (c === '\n') out += '\n'; i++; } continue; }
    if (state === 'sq') { if (c === '\\') { i += 2; continue; } if (c === "'") state = 'code'; i++; continue; }
    if (state === 'dq') { if (c === '\\') { i += 2; continue; } if (c === '"') state = 'code'; i++; continue; }
    if (state === 'tpl') {
      // Template literals can contain ${ ... } expressions with real code — keep those.
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { state = 'code'; i++; continue; }
      if (c === '$' && c2 === '{') { out += '${'; i += 2; let depth = 1; // copy expression through matching }
        while (i < n && depth > 0) { const d = src[i]; if (d === '{') depth++; else if (d === '}') depth--; if (depth > 0) out += d; i++; }
        out += '}'; continue; }
      if (c === '\n') out += '\n';
      i++; continue;
    }
  }
  return out;
}

// Intra-file taint: a variable assigned from an image ref (most importantly
// `const b64 = await readAsStringAsync(uri)`) IS image bytes, so it must be tracked
// too — otherwise the leak just splits across two lines (read on one, send on the
// next) and evades a per-line co-occurrence check. Single-pass, same-file only:
// it deliberately does not follow across functions/modules (documented residual).
export function taintedNames(cleaned) {
  const names = new Set();
  const decl = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=([^;\n]*)/g;
  let m;
  for (const line of cleaned.split('\n')) {
    decl.lastIndex = 0;
    while ((m = decl.exec(line)) !== null) {
      const [, name, rhs] = m;
      if (IMAGE_REFS.some((r) => r.test(rhs)) || [...names].some((t) => new RegExp(`\\b${t}\\b`).test(rhs))) {
        names.add(name);
      }
    }
  }
  return names;
}

// Layer-2 core. `layer` selects the rule:
//   'pipeline' — flag any line where an image ref (or a tainted var) co-occurs with a sink.
//   'network'  — flag any line that references an image ref at all.
// Returns [{ line, kind, refs, sinks }].
export function findSinkLeaks(rawText, layer) {
  const cleaned = stripCommentsAndStrings(rawText);
  const rawLines = rawText.split('\n');
  const lines = cleaned.split('\n');
  const tainted = layer === 'network' ? new Set() : taintedNames(cleaned);
  const hits = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if ((rawLines[idx] || '').includes(SUPPRESS)) continue; // auditable opt-out
    const refs = IMAGE_REFS.filter((r) => r.test(line)).map((r) => r.source);
    const taintHit = [...tainted].filter((t) => new RegExp(`\\b${t}\\b`).test(line));
    if (refs.length === 0 && taintHit.length === 0) continue;
    if (layer === 'network') {
      hits.push({ line: idx + 1, kind: 'image-ref-in-network-layer', refs, sinks: [] });
      continue;
    }
    const sinks = SINKS.filter((s) => s.test(line)).map((s) => s.source);
    if (sinks.length) {
      hits.push({ line: idx + 1, kind: 'image-ref-reaches-sink', refs: [...refs, ...taintHit.map((t) => `tainted:${t}`)], sinks });
    }
  }
  return hits;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return ['.ts', '.tsx'].includes(extname(p)) ? [p] : [];
  });
}

function scan() {
  const hits = [];

  // Layer 1 (legacy token scan) — pipeline dirs.
  for (const dir of GUARDED_DIRS) {
    for (const file of walk(dir)) {
      const bad = findEgress(readFileSync(file, 'utf8'));
      if (bad.length) hits.push(`[token] ${file}: ${bad.join(', ')}`);
    }
  }

  // Layer 2a (sink co-occurrence) — pipeline dirs.
  for (const dir of GUARDED_DIRS) {
    for (const file of walk(dir)) {
      for (const h of findSinkLeaks(readFileSync(file, 'utf8'), 'pipeline')) {
        hits.push(`[sink] ${file}:${h.line} image ref {${h.refs.join(', ')}} reaches sink {${h.sinks.join(', ')}}`);
      }
    }
  }

  // Layer 2b (network layer must not touch image symbols).
  for (const dir of NETWORK_LAYER_DIRS) {
    for (const file of walk(dir)) {
      for (const h of findSinkLeaks(readFileSync(file, 'utf8'), 'network')) {
        hits.push(`[network-layer] ${file}:${h.line} references image symbol {${h.refs.join(', ')}} — the network layer must only carry derived scores`);
      }
    }
  }

  if (hits.length) {
    console.error('IMAGE EGRESS risk detected:\n' + hits.join('\n'));
    process.exit(1);
  }
  console.log('compliance: no image egress from scan pipeline (token + sink + network-layer scans clean)');
}

if (import.meta.url === `file://${process.argv[1]}`) scan();

# eval/data — LOCAL ONLY (gitignored)

Real face images and their manifest live here. **They are never committed to git and never uploaded
to production Supabase** (TrueTone compliance boundary; BIPA/PIPA).

## Layout
- `manifest.json` — array matching `eval/fairness/manifest.ts` (`imageRef`, `fst`, `subjectId`,
  `lighting`, `source`, `consentRef`, `fstProvenance`).
- image files referenced by `imageRef`.

## Hard rules (see docs/superpowers/specs/2026-06-16-truetone-fairness-eval-design.md §9)
- The specific dataset/source, its license, and subject consent require **founder + counsel sign-off**
  before any real image is placed here.
- Every manifest entry MUST carry a `consentRef`.
- Only aggregate reports (`eval/reports/`) are committed — never images or per-subject data.

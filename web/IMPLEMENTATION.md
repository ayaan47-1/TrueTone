# TrueTone editorial web preview

Static HTML, CSS and JavaScript. The Expo app is unchanged. The source base is `fad70be`; this work belongs on `feat/truekind-web`.

## Preview

From the repository root, create a deliberately disconnected local configuration:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://preview.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=local-preview-disabled npm run waitlist:build
python3 -m http.server 8080 --directory web
```

Open `http://localhost:8080/` and `/journal.html`. The generated local configuration cannot submit email or report a successful signup. Valid production configuration continues to use the existing waitlist service. `web/config.js`, `web/_headers` and generated policies remain ignored build outputs. Do not deploy the preview configuration.

Run `npm run test:scripts`, `npm run check:compliance` and `npm run check:no-egress`. No lint command is configured. These web edits introduce no TypeScript or native changes.

## Assets

The founder supplied three Unsplash object photographs, used in the hero, morning routine and texture/finish feature. Six self-hosted WebP files provide two sizes per photo (270 KiB total); responsive `srcset` selects one per slot. The hero loads eagerly at high priority; lower images load lazily. Original source colours are retained. Other editorial compositions use typography and solid colours. No AI images or portraits are included. Source IDs and photographer names come from the supplied filenames; per-photo pages could not be independently retrieved. The general Unsplash License was checked; the per-photo source/license assertion comes from the founder. The partner section reserves a square neutral image slot; a 4:5 placeholder and `.supplier-portrait` modifier are also available. Product images use `object-fit: contain` so packaging is not cropped.

Future supplier photographs must have documented permission and be shown beside that exact supplier's actual product identity. They must never become generic TrueTone hero, routine, gallery or journal imagery. A photograph of one brand must never illustrate a fictional product or another brand. No Shopify integration, commerce service or remote image fetching is implemented.

See `images/editorial/provenance.json` for the asset record and replacement requirements. The SVGs are plain local neutral placeholders, not illustrations or product photographs. Image generation prompts have been cancelled and removed.

Plus Jakarta Sans and Inter remain self-hosted; their font licenses are included in `fonts/`. The contrasting serif is the OS-provided Georgia, with Times New Roman/serif fallbacks. No commercial font was downloaded or redistributed. This is a visual approximation of the requested type pairing, and serif metrics can vary across platforms.

## Preserved contracts

All existing homepage ids, navigation labels/destinations, signup input/button order, field names, referral behavior, legal URLs, wordmark markup and disclaimer wording remain. Journal navigation and `/journal.html` are additive. The claims ruling's two unsubstantiated product-verification phrases have been replaced with preference-based wording. Morning/evening examples are generic and do not claim to be personalized results.

Menu links close the disclosure and focus the destination; Escape returns focus to Menu. Details and articles work without JavaScript. Scroll entrances are optional, keep content visible by default and respect reduced motion. Form feedback preserves live regions, eligibility checks and error handling.

## Verification limits

The source and DOM interaction checks are not browser rendering tests. Before this photo update, the orchestrator rendered 1440px and verified the mobile overflow fix at 390/360px. This photo update needs fresh rendered crop/overflow checks; 1024/768px, reference pixel comparison and Core Web Vitals remain unverified. Chrome could not launch in this agent’s sandbox, and no further browser repair was authorized. Supplier photography is pending. Locked legal text and existing metadata retain em dashes; no literal-zero claim is made.

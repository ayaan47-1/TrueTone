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

The founder cancelled AI photography. No generated or stock images are included. Generic brand compositions use typography and solid colours. The partner section reserves a square neutral image slot; a 4:5 placeholder and `.supplier-portrait` modifier are also available. Product images use `object-fit: contain` so packaging is not cropped.

Future supplier photographs must have documented permission and be shown beside that exact supplier's actual product identity. They must never become generic TrueTone hero, routine, gallery or journal imagery. A photograph of one brand must never illustrate a fictional product or another brand. No Shopify integration, commerce service or remote image fetching is implemented.

See `images/editorial/provenance.json` for the asset record and replacement requirements. The SVGs are plain local neutral placeholders, not illustrations or product photographs. Image generation prompts have been cancelled and removed.

Plus Jakarta Sans and Inter remain self-hosted; their font licenses are included in `fonts/`. The contrasting serif is the OS-provided Georgia, with Times New Roman/serif fallbacks. No commercial font was downloaded or redistributed. This is a visual approximation of the requested type pairing, and serif metrics can vary across platforms.

## Preserved contracts

All existing homepage ids, navigation labels/destinations, signup input/button order, field names, referral behavior, legal URLs, wordmark markup and disclaimer wording remain. Journal navigation and `/journal.html` are additive. The claims ruling's two unsubstantiated product-verification phrases have been replaced with preference-based wording. Morning/evening examples are generic and do not claim to be personalized results.

Menu links close the disclosure and focus the destination; Escape returns focus to Menu. Details and articles work without JavaScript. Scroll entrances are optional, keep content visible by default and respect reduced motion. Form feedback preserves live regions, eligibility checks and error handling.

## Verification limits

The source and DOM interaction checks are not browser rendering tests. Chrome could not launch in the available sandbox, so 1440/1024/768/390/360px screenshots, rendered overflow, mobile crops and pixel comparison remain unverified. No further browser-repair work was authorized. Supplier photography is pending. Locked legal text and existing metadata retain em dashes; no literal-zero claim is made.

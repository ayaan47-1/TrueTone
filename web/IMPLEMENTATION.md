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

The founder supplied three Unsplash object photographs, used in the hero, morning routine and texture/finish feature. For these three object photos, six self-hosted WebP files provide two sizes per photo (270 KiB total); responsive `srcset` selects one per slot. The hero loads eagerly at high priority; lower images load lazily. Original source colours are retained. Other editorial compositions use typography and solid colours. Two further founder-supplied portraits appear only in the lifestyle gallery before the journal, each with an adjacent stock-photo disclaimer. They retain full source proportions and receive only resizing/format conversion. No model release is on file; the founder explicitly overrode that requirement on 2026-10-08. The gallery is separated from the waitlist by the full journal section. Four portrait derivatives add 214 KiB; all ten photo files total 484 KiB. No AI images are included. Source IDs and photographer names come from the supplied filenames; per-photo pages could not be independently retrieved. The general Unsplash License was checked; the per-photo source/license assertion comes from the founder. The partner section reserves a square neutral image slot; a 4:5 placeholder and `.supplier-portrait` modifier are also available. Product images use `object-fit: contain` so packaging is not cropped.

Future supplier photographs must have documented permission and be shown beside that exact supplier's actual product identity. They must never become generic TrueTone hero, routine, gallery or journal imagery. A photograph of one brand must never illustrate a fictional product or another brand. No Shopify integration, commerce service or remote image fetching is implemented.

See `images/editorial/provenance.json` for the asset record and replacement requirements. The SVGs are plain local neutral placeholders, not illustrations or product photographs. Image generation prompts have been cancelled and removed.

Plus Jakarta Sans and Inter remain self-hosted; their font licenses are included in `fonts/`. The contrasting serif is the OS-provided Georgia, with Times New Roman/serif fallbacks. No commercial font was downloaded or redistributed. This is a visual approximation of the requested type pairing, and serif metrics can vary across platforms.

## Preserved contracts

All existing homepage ids, navigation labels/destinations, signup input/button order, field names, referral behavior, legal URLs, wordmark markup and disclaimer wording remain. Journal navigation and `/journal.html` are additive. The claims ruling's two unsubstantiated product-verification phrases have been replaced with preference-based wording. Morning/evening examples are generic and do not claim to be personalized results.

Menu links close the disclosure and focus the destination; Escape returns focus to Menu. Details and articles work without JavaScript. Scroll entrances are optional, keep content visible by default and respect reduced motion. Form feedback preserves live regions, eligibility checks and error handling.

## Verification limits

The source and DOM interaction checks are not browser rendering tests. Before this photo update, the orchestrator rendered 1440px and verified the mobile overflow fix at 390/360px. The three-object-photo patch 34c82ea was subsequently rendered by the orchestrator at 1440/390/360px: readable hero headline, no phone overflow and all three images loading. The portrait gallery was then rendered and committed as `2c2ff16`. Final layout `39db6d2` has no horizontal overflow at 1440, 1024, 768, 390 or 360px; all images load and each photograph appears once. Reference pixel comparison, full browser keyboard/assistive-technology testing and Core Web Vitals remain unverified. Chrome could not launch in this agent’s sandbox, and no further browser repair was authorized. Supplier photography is pending. Locked legal text and existing metadata retain em dashes; no literal-zero claim is made.


## Photography and motion revision

The homepage now uses an edge-to-edge hero image at 88svh on desktop (bounded 640-1100px), with dark text on an opaque ivory panel. Mobile keeps a large 66svh image and follows it with a readable copy panel. Each supplied photo appears once: fullbleed makeup hero, amber morning routine, wide lipstick texture feature and two editorial portraits. The texture feature now spans the content width; the evening routine and journal retain type compositions to avoid repetition. Portraits remain in the separate gallery before the Journal, with full source proportions and visible disclaimers; the second portrait now spans the content width.

The header is sticky and condenses with a 10px upward translation after an IntersectionObserver sentinel passes the viewport. Anchor offsets account for it. Entrances last 700ms, with small staggered delays; hover scaling lasts700ms. Optional native CSS view timelines add gentle scale/translation to object images, without a scroll listener or animation library. Browsers without view-timeline support retain reveals and hover feedback. Current API source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline .

Reduced-motion disables entrances, drift, hover scale, header movement and smooth scrolling. A live preference change disconnects the observers; turning motion back on reconnects them without replaying revealed sections. Pagehide disconnects and pageshow restores observation. Content stays visible without JavaScript. Photo assets remain local and unchanged from the prior iteration. God rendered the first motion/scale revision at 1440/390/360: hero readable, no overflow, images load, reveal content visible after scroll, gallery captions present. The final change removes duplicate photo placements and enlarges the texture feature. God verified no overflow at all five target widths and measured the mobile swatch at 351 × 351px in the 390px viewport. Actual browser motion and live preference-switch behavior were not separately reported. Project 109 tests, 23 source/DOM checks and targeted observer lifecycle checks pass.

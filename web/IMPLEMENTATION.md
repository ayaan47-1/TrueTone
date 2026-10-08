# TrueTone editorial web preview

Static HTML, CSS and JavaScript on `feat/truekind-web`. The Expo app is unchanged. The design system is documented in [DESIGN.md](DESIGN.md).

## Preview

From the repository root, create a deliberately disconnected local configuration:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://preview.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=local-preview-disabled npm run waitlist:build
python3 -m http.server 8080 --directory web
```

Open `http://localhost:8080/` and `/journal.html`. The generated local configuration cannot submit email or report a successful signup. Valid production configuration continues to use the existing waitlist service. `web/config.js`, `web/_headers` and generated policies remain ignored build outputs. Do not deploy the preview configuration. The Python preview does not enforce `_headers`; deployment must use the generated Content Security Policy, including same-origin-only media permission.

Run `npm run test:scripts`, `npm run check:compliance` and `npm run check:no-egress`. No lint command is configured. These edits introduce no TypeScript or native changes.

## Hero footage

The founder supplied an eight-second, silent AI animation of the Fleur Kaan Unsplash portrait. The source remains untouched outside the repository. Full-clip crop detection found150px black bars on both sides; derivatives crop to1620x1080 at24fps without upscaling:

| Local asset | Bytes | Format |
|---|---:|---|
| assets/hero-editorial.mp4 | 2639301 | H.264, yuv420p, faststart, no audio |
| assets/hero-editorial.webm | 2402130 | VP9, yuv420p, no audio |
| assets/hero-editorial-poster.webp | 191030 | First cropped source frame |

The browser selects one supported video format; it does not need both. The poster/image is always available. The existing ivory panel, headline, support copy, action and eligibility wording remain. The added caption explicitly identifies stock footage, AI animation and nonendorsement. The founder subsequently requested removal of Play/Pause while keeping the loop. No in-page playback control remains.

`hero-video.js` leaves all video sources inert until preferences permit playback. Reduced motion or browser-exposed Save-Data yields poster-only with no video request; a live change removes sources, pauses and resets the video. Hidden tabs pause, pagehide releases sources, and pageshow restores permitted playback. No JavaScript, autoplay denial and media errors all preserve the poster. Browsers without the Network Information API cannot expose Save-Data; reduced motion remains independently supported.

The MP4 and WebM are local only. `scripts/build-waitlist.mjs` adds only `media-src 'self'` to the existing Content Security Policy. The generated header retains its restrictions on connections, scripts, frames and other origins. No tracking, media vendor SDK or external video request is added.

## Founder playback override

On2026-10-08, founder message74160b explicitly requested “remove play pause option keep the loop.” The markup, button CSS, controller logic and pause-control tests were removed. The looping background therefore has no in-page pause mechanism and is not claimed to satisfy WCAG2.2.2. Reduced-motion and browser-exposed Save-Data settings still prevent media loading and playback; live preference changes still return to the poster. This records the specific founder decision, not a general accessibility exemption.

## Other assets and rights

The pink makeup flatlay appeared only in the old hero. Both unused derivatives were removed; their source/hash history is retained under `retired_assets` in `images/editorial/provenance.json`. Two object photos remain: amber dropper for the morning routine and lipstick swatches for the full-width feature. Only the original Daniela portrait remains, centered in the separate editorial gallery before Journal with unchanged full proportions and its visible disclaimer. The founder removed the duplicate Fleur Kaan still; its two unused derivatives were deleted and retained in the manifest’s retired history. The evening routine and journal retain type compositions.

The founder explicitly authorized the supplied AI footage/poster in the hero on2026-10-08. This supersedes the prior hero-placement restriction only for that footage/poster. No model release is on file. Original gallery photography remains subject to its existing placement/caption restrictions. Source photographer/IDs and AI generation context were supplied by the founder; individual source pages, generation settings and derivative rights were not independently verified. No image-generation service was called for this update.

Supplier slots remain neutral placeholders. Future supplier photos require documented permission and exact matching supplier/product identity; never reuse them as generic TrueTone imagery. No commerce or Shopify integration is added. Fonts remain self-hosted Plus Jakarta Sans/Inter with included licenses and OS Georgia/Times fallbacks.

## Verification and limits

Before this video update, both homepage and journal passed1440/1024/768/390/360 overflow/headline/image checks, with normal/reduced/live-toggle motion verified by the orchestrator. Those earlier results do not certify the new video. The video update requires fresh browser checks for autoplay, poster-only request blocking, caption placement, face crop and all five widths.

Source tests cover media preferences, live changes, autoplay rejection, errors, visibility/page lifecycle and late play promises. File probes verify both videos are eight seconds,1620x1080,24fps with no audio stream and below3MB. Source hashes and encoding settings are recorded in the manifest.

No pixel-perfect comparison, full assistive-technology review, live signup or Core Web Vitals certification is claimed. Locked legal copy and existing metadata retain em dashes. No push or deployment is part of this work.

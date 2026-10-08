# TrueTone web design system

A warm photographic editorial website for US adults exploring cosmetic preferences. The existing TrueTone design is the foundation. This document governs the static marketing and journal pages in `web/`; it does not govern the Expo app or change any native flow.

Mode: **Redesign - Preserve**. DESIGN_VARIANCE **7**, MOTION_INTENSITY **6**, VISUAL_DENSITY **3**. The founder selected a mix of Apple and Claude, leaning on the current site. Preserve the large images and asymmetric layouts already built; improve consistency and reading character through small changes.

## Sources and precedence

- **[T] TrueTone:** existing `landing.css`, `index.html`, `journal.html` and `landing.js` at base `c7ea404`; repository `AGENTS.md`; approved TrueKind-inspired direction and later photography/motion decisions. This is the source of all colour values, assets, fonts, content, contracts and responsive structure below.
- **[A] Apple inspiration:** `getdesign@0.6.25/templates/apple.md`, exported as `apple.DESIGN.md` in the office's `research/truetone-design-md/`. Borrow photographic scale, generous space and quiet interface chrome.
- **[C] Claude inspiration:** `getdesign@0.6.25/templates/claude.md`, exported beside it as `claude.DESIGN.md`. Borrow warm reading surfaces and regular-weight serif headlines.

[A] and [C] are bundled third-party analyses from [awesome-design-md](https://github.com/voltagent/awesome-design-md), not official brand systems or newly verified measurements. They do not grant rights to fonts, photography or marks. TrueTone rules override conflicting template suggestions. Use no Apple/Anthropic marks, SF Pro, Copernicus, Tiempos, Styrene, coral actions, dark software panels or new commercial assets.

## Palette and semantics [T], warmth reinforced by [C]

| Token | Value | Role |
|---|---|---|
| `--paper` | `#faf7f2` | Main canvas, header, opaque hero copy surface |
| `--sand` | `#f2ebe0` | Philosophy and signup section surfaces |
| `--ivory` | `#f5f1e9` | Reserved existing neutral |
| `--white` | `#fffdf9` | Form field fill |
| `--ink` | `#221f1a` | Headings, body, filled actions |
| `--muted` | `#575045` | Secondary copy, placeholders, captions |
| `--line` | `#d5ccbf` | Decorative separators |
| `--field-line` | `#82796d` | Form control boundary |
| `--green` | `#2f7d52` | Focus, selection, checkbox |
| `--green-deep` | `#205839` | Positive status and link feedback |
| `--error` | `#9d4b2b` | Error text only |
| `--action-hover` | `#423b32` | Filled action hover |
| `--surface-selection` | `#d6e6d8` | Text selection |
| `--surface-referral` | `#e3ebe4` | Existing referral banner |

Light theme only, including when the operating system uses dark mode. Photos provide most colour. Green already carries semantic meaning; do not turn it into decorative branding. Coral/clay actions would confuse the error role and are prohibited. Pale decorative panels never communicate status by colour alone.

Existing editorial surface tokens retain their precise values:

| Token | Value | Placement |
|---|---|---|
| `--surface-composition` | `#e5dbcd` | Existing colour composition |
| `--surface-morning` | `#e7dfd2` | Reserved morning panel |
| `--surface-evening` | `#d7c5b3` | Evening type panel |
| `--surface-philosophy` | `#e0e5dc` | Privacy type panel |
| `--surface-preference` | `#e8dfd4` | Reserved preference panel |
| `--surface-supplier` | `#e8e1d6` | Supplier image slot |
| `--surface-journal` | `#e2d8c9` | Leading journal type composition |
| `--surface-journal-soft` | `#e1e5dc` | Smaller journal composition |
| `--surface-gallery` | `#e4dbce` | Reserved gallery type panel |
| `--surface-gallery-warm` | `#decab8` | Reserved warmer gallery panel |

Reserved tokens describe existing optional components, not permission to add more panels. Do not use the pale separator colour as the only form boundary. Recheck contrast when changing a colour pair.

## Typography [T], reading treatment adapted from [C]

Font order is explicit and must remain stable:

- `--display`: self-hosted **Plus Jakarta Sans**, then Segoe UI, system-ui, sans-serif.
- `--body`: self-hosted **Inter**, then Segoe UI, system-ui, sans-serif.
- `--editorial`: **Georgia**, then Times New Roman, serif. OS-provided faces; no redistributed serif font file.

No local font source may precede the two webfonts. Keep existing font licenses in `fonts/`. Default weight is400; never let browser heading defaults introduce bold text. The existing 800-weight wordmark and 700-weight footer lockup are preserved brand exceptions.

| Role | CSS size | Leading / tracking | Typeface |
|---|---|---|---|
| Body, `--type-body` | 16px | 1.65 / normal | Inter400 |
| Label, `--type-label` | 13px | 1.5 / .015em | Inter400 |
| Section, `--type-section` | clamp(38px,5.5vw,84px) | 1.08 / -.055em | Plus Jakarta400 |
| Subheading, `--type-subheading` | clamp(23px,2.2vw,34px) | 1.25 / -.035em | Plus Jakarta400 |
| Featured story, `--type-story` | clamp(30px,3vw,46px), 34px phone | 1.16 / -.035em | Georgia400 |
| Reading title, `--type-reading-title` | clamp(44px,6vw,88px) | 1.16 / -.035em | Georgia400 |
| Article title, `--type-reading-heading` | clamp(32px,4vw,56px) | 1.16 / -.035em | Georgia400 |

Journal story headings and long-form page/article titles use roman Georgia at400. Smaller article subheadings stay sans at23px with neutral letter-spacing for clear word separation and hierarchy. Existing selected `em` phrases stay italic Georgia with1.14 line height and a small bottom reserve; check descenders after font or size changes.

The hero retains its approved mixed sans/serif wording and deliberate break: desktop clamp(64px,6.1vw,96px); at1100px clamp(58px,7vw,82px); at800px clamp(48px,7.8vw,66px); at560px clamp(44px,11.8vw,64px). Do not expand serif styling to every utility heading. Body measures stay around48ch; long-form paragraphs allow66ch.

## Space, grid and photography [T], scale reinforced by [A]

- `--maxw`:1600px; `--gutter`:clamp(22px,4vw,64px), fixed22px at560px and below.
- `--section`:clamp(88px,10vw,160px), then88px at800px and76px at560px.
- Base composition gap24px. Routine and gallery layouts use twelve `minmax(0,1fr)` columns, with deliberate unequal spans. Preserve minimum-width safeguards on images and text.
- Fullbleed hero:88svh bounded640-1100px on desktop. Its opaque cream copy surface ensures contrast. At800px the image becomes72svh/min460px and copy returns to document flow; at560px it is66svh/min400px. Copy may follow the image below the initial phone viewport: that is the approved photographic composition, not hidden content.
- Keep morning photography, evening typography, a distinct philosophy panel, full-width texture feature and uneven journal. Do not replace them with repeated centered product tiles or identical feature cards.
- Object photographs have explicit dimensions, responsive sources and individual crops. The hero is eager/high-priority; later images are lazy. Current objects retain their source colours.
- Both editorial portraits retain full source proportions, no crop or retouch, and exact visible stock/nonuser/nonendorser/nonresult captions. They remain in the gallery, separated from signup by Journal. Never place them beside scan results, efficacy claims or conversion copy.
- Each supplied photograph appears once. See `images/editorial/provenance.json`; original source and permission limitations remain binding. Supplier images require exact product identity and permission, never generic reuse.

## Components [T], quiet chrome reinforced by [A]

**Header:** compact sticky cream surface; desktop links on one line with the exact wordmark and partnership action. Native `details` disclosure at1100px and below. Escape restores focus, destination links move focus to the target, outside click/focus departure dismisses. This is a disclosure, not a modal; do not trap focus.

**Actions and fields:** `--radius-control`:999px. Filled ink actions with cream text, minimum52px height, existing hover and pressed feedback. Text links and navigation targets at least44px. Maintain2px green focus outlines with5px offset. Fields use the stronger boundary colour, visible labels and honest busy/error/empty states. Preview configuration must not claim subscription success.

**Routine/FAQ:** native `details` controls; preserve keyboard operation and no-JavaScript access. Category buttons retain focus, pointer and touch behavior plus `aria-pressed`/panel relationships.

**Editorial:** photographs and type panels stay rectangular, without floating badges, decorative caption credits or general card shadows. Principles use open spacing. Journal links open the existing readable article anchors. Required portrait captions are context, not decoration.

**Footer:** retain large TrueTone mark, readable locked disclosure and existing Privacy, Terms, Biometric data and Retention links. Never shrink legal text to imitate Apple microcopy.

## Motion [T], restrained browsing priority consistent with [A] and [C]

- `--duration`:200ms for action feedback; `--ease`:cubic-bezier(.22,.61,.36,1).
- `--reveal-duration`:700ms; `--motion-ease`:cubic-bezier(.2,.65,.25,1).
- Hero image fade1000ms; headline entrance800ms; supporting copy begins160ms later. Section reveal28px over700ms, once; principles stagger80ms.
- Header moves10px upward over500ms after its sentinel leaves the viewport. Both scroll padding and target margin retain104px clearance.
- Hover-capable devices may scale object images to1.03 over700ms. Supporting object-image drift is progressive CSS view-timeline enhancement:1.06 base scale, -2% to2% translation. Unsupported browsers keep the still image and ordinary reveals. Portraits never drift or zoom.
- Menu enters over400ms. No scroll hijacking, automatic loops, scroll event listener or animation dependency.
- Reduced motion disables CSS animations, transitions, image transforms/scales, smooth scrolling and header movement. JavaScript disconnects observers on preference changes and pagehide; pageshow or re-enable restores observation without replaying completed reveals. Default content is visible when JavaScript fails.

No new motion is required for this blend; the existing level6 already supports the requested experience.

## Responsive and preservation contract [T]

Verify at1440,1024,768,390 and360px, with actual page scrolling and loaded fonts. At800px, principles use two columns and philosophy copy stacks; at560px routine, journal, partner and form compositions stack. The mobile philosophy panel must keep `aspect-ratio:auto` alongside its360px minimum height to avoid intrinsic overflow.

Keep all copy, routes, anchors, navigation labels, form field names/order, disclosures, image alternatives and portrait captions. No new claims, commerce, data collection, analytics or remote assets. Metadata and social cards remain unchanged. Preserve one primary heading per page, focus visibility, image dimensions and ordinary native scrolling.

Before accepting a change: run script tests, compliance/no-egress checks and the local preview build; inspect desktop/mobile screenshots and normal/reduced motion including live preference changes. Source tests are not browser evidence. Locked legal punctuation currently conflicts with the rulebook's literal-zero em-dash check; retain it and report the exception honestly.

## Avoiding template defaults

AI-purple/blue glow is excluded because the palette is already defined. Three equal feature cards are excluded because the established varied layouts carry the story. Beige/brass/clay/espresso as generic luxury decoration is excluded: warm neutrals are an explicit TrueTone brief, while brass decoration and clay actions are absent. The result must still read as TrueTone, not an Apple or Claude clone.

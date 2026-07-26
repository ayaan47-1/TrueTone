# Handoff: TrueTone — "Quiet Glass" Design Direction

## Overview
Visual direction for TrueTone, an on-device AI skin-scan app (US-only, 18+, cosmetic/wellness — not a medical device). "Quiet Glass" is a warm, frosted, Apple-native, spa-calm aesthetic: soft off-white backgrounds, translucent glass cards, sage/clay accents, minimal numbers, calm typography.

This covers 7 screens: **Gate → Today → Scan → Result → Routine → Trend → You**.

## About the design files
The files here (`TrueTone Concepts.dc.html`, `ios-frame.jsx`) are **HTML/React design references** — mockups built to show intended look, layout, and copy. They are **not production code to copy directly**. The task is to **recreate these screens in the app's existing codebase** (React Native / Expo per the app's tech stack) using its existing components, navigation, and theme system — not to ship this HTML as-is.

`TrueTone Concepts.dc.html` contains **two explored directions** side by side (`1a` and `1b`) — **only the `1a` "Quiet Glass" section is in scope for this handoff.** Ignore the `1b` "Flat / Cal AI" section entirely; it was an alternate direction not selected. Screens are laid out as iPhone mockups (via `ios-frame.jsx`, a bezel-only helper — don't port that file, it's a design-tool shell) in one continuous horizontal row, in the order: Gate, Today, Scan, Result, Routine, Trend, You.

## Fidelity
**High-fidelity.** Colors, type sizes/weights, spacing, corner radii, and copy below are final for this direction. Treat exact hex values and pixel measurements as the spec.

## Compliance constraints (must hold in the real build)
- Never show a number, percentage, or score for skin condition — only qualitative words (e.g. "Balanced," "Smooth," "Mostly even"). The bar fills shown are illustrative proportions only, not derived from any numeric formula surfaced to the user.
- Never use disease/medical language (acne, rosacea, etc.) or imply diagnosis.
- Consent checkbox on the Gate screen must NOT be pre-checked.
- Photo/face data never leaves the device — no copy or UI should imply otherwise.

## Design tokens
- **Background:** `#FBF7F2` (warm off-white)
- **Glass card:** `rgba(255,255,255,0.65)` fill, `1px solid rgba(255,255,255,0.8)` border, `backdrop-filter: blur(14px)`
- **Text primary:** `#221f1a`
- **Text secondary:** `#8a8378` / `#6b655b`
- **Accent (sage, primary):** `#7E9174`
- **Accent (clay, secondary):** `#C1875F`
- **Dark surface (e.g. camera):** `#111111`
- **Corner radius:** 18–22px on cards, 26px+ on hero cards, 999px on pills/buttons
- **Typography:** system font (SF Pro / -apple-system). Headline 24–28px/700, body 14–15px/400–600, caption 12–13px/400
- **Spacing:** 24px screen margins, 8–12px gaps between stacked cards

## Screens

### 1. Gate (`screenshots/1-gate.png`)
- **Purpose:** Minimal, fast legal essentials before the camera ever opens — region check, 18+ age confirmation, biometric consent. One scrollable screen, not a multi-step wizard.
- **Layout:** Title "Before we begin" + subtitle, then 3 stacked glass cards, then a full-width dark "Continue" button pinned near the bottom, with "Privacy Policy · Terms" caption below.
- **Components:**
  - Region card: pin icon swatch + "United States" + "TrueTone is available in your region" + a small sage dot (confirmed state).
  - Birthdate card: "Confirm your birthdate" + 3 white pill fields (day/month/year) + helper caption "Must be 18+. We don't store this date — only that you're eligible."
  - Consent card: unchecked square checkbox + copy: "I agree that my photo is analyzed on my device only, never uploaded, and deleted right after each scan."
  - Continue button: `#221f1a` fill, white text, 20px radius, full width.
- **Behavior:** Continue is disabled until region confirmed + age confirmed + consent checked. Any failure (wrong region, under 18, no consent) blocks entry — fail closed, never advances to the app.

### 2. Today (`screenshots/2-today.png`)
- **Purpose:** Daily dashboard/home tab.
- **Layout:** Date + greeting header, 7-dot week strip (today highlighted as a filled sage circle), a gradient affirmation hero card, a 4-chip mood check-in row, a scan-CTA glass card.
- **Components:**
  - Week strip: 7 small dots, "today" rendered larger/filled in sage, others neutral tan dots.
  - Affirmation card: warm tan gradient, small uppercase label "Today's note", one calm sentence of copy (rotates daily).
  - Mood chips: "Calm / Glowy / Dry / Tired" — single-select, selected chip is filled dark, others are light glass outline.
  - Scan CTA: circular sage icon + "Ready for today's scan?" + "Takes about 20 seconds" — taps into the Scan tab.
- **State:** Mood selection persists locally (on-device only, part of the existing skin-feel diary — purged by delete-everything, per existing architecture).

### 3. Scan (`screenshots/3-scan.png`)
- **Purpose:** Full-screen guided capture.
- **Layout:** Dark/black full-bleed background, centered oval face guide, instruction text above, hint text + shutter button near bottom.
- **Components:** "Hold steady" headline, oval guide (solid outline + dashed sage outline offset outward), "Natural light works best" hint, large circular shutter affordance.
- **Behavior:** Existing hands-free auto-capture behavior (steady → countdown → fire) is unchanged; this is a visual restyle only. Blocking quality gate stays as-is.

### 4. Result (`screenshots/4-result.png`)
- **Purpose:** Show the scan read — qualitative only, plus trend vs. last scan.
- **Layout:** Header "Today's read" / "Looking balanced", a trend chip, then 3 stacked band cards, then a "See your routine" CTA.
- **Components:**
  - Trend chip: small sage dot + "Fresher than your last scan."
  - Band cards (Hydration, Texture, Tone evenness): label + qualitative word (right-aligned, muted) + a horizontal fill bar (illustrative proportion, sage or clay fill) on a light tan track.
  - CTA: same dark full-width button style as Gate.
- **Compliance:** No numeric labels anywhere on this screen — only the words "Balanced," "Smooth," "Mostly even," etc.

### 5. Routine (`screenshots/5-routine.png`)
- **Purpose:** Brand-neutral AM/PM routine with completion tracking.
- **Layout:** Title + a 2-segment AM/PM toggle (pill-style, active segment white-on-tan), then 3 step cards, then a "Why these?" link.
- **Components:** Each step card = numbered icon swatch (tinted per step: green/tan/blue), step name ("Cleanse"/"Treat"/"Protect"), one-line neutral product-type description, and an empty circular checkbox on the right for marking done.
- **Behavior:** Tapping a step's checkbox marks it done for the day (existing routine-tracking logic, restyled only). "Why these?" opens the existing scoped chat.

### 6. Trend (`screenshots/6-trend.png`)
- **Purpose:** Progress over time + "did this help" feedback loop.
- **Layout:** Header, a line-chart card, a check-in streak row, a feedback card.
- **Components:**
  - Line chart: simple smoothed polyline from "Duller" (left) to "Fresher" (right) — qualitative axis labels only, no numeric y-axis.
  - Streak row: 7 equal-width rounded bars, filled sage = checked-in that day, tan = not yet.
  - Feedback card: "Did your routine help this week?" + Yes / Not really buttons (Yes = filled dark, Not really = light tan).
- **Behavior:** Wires to the existing `routine_helpful` feedback RPC and trend/freshness card logic — visual restyle only.

### 7. You (`screenshots/7-you.png`)
- **Purpose:** Profile/settings + data rights.
- **Layout:** Centered avatar circle + name, then a stacked list of glass rows.
- **Components:** Rows: "Your data," "Privacy & policies," "Notifications" (chevron affordance), and "Delete everything" (destructive, red text `#b23b3b`).
- **Behavior:** Unchanged from existing Data Rights / delete-everything flows — restyle only.

## Interactions & behavior notes
- All taps/transitions/data logic described above already exist in the shipped app (per the architecture decisions) — this handoff is a **visual restyle**, not new functionality, except where explicitly noted.
- No hover states needed (mobile-only, iOS + Android).
- Standard tab navigation across Today / Routine / Scan (center) / Trend / You is unchanged in structure — only needs re-skinning to this palette/typography if the tab bar itself is restyled (not pictured here; ask if you want a tab-bar mock too).

## Assets
No custom icons/imagery used — all glyphs are simple CSS shapes/emoji placeholders for the mockup. Real iconography should be built by the dev team to match the existing icon system (hand-drawn, no icon-font dependency, per current `GlassTabBar` approach).

## Files
- `TrueTone Concepts.dc.html` — full design reference (open in any browser). **Only the `1a` section applies to this handoff** — ignore `1b`.
- `ios-frame.jsx` — device-bezel helper used only for presenting the mockups; not for production use.
- `screenshots/1-gate.png` … `7-you.png` — flat PNG captures of each screen, in flow order.

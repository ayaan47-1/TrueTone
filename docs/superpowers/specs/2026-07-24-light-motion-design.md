# Design — Light motion pass (test-build scope)

**Goal:** make the UI feel alive without feeling animated. Deliberately minimal for test
builds; the foundation is shared so motion can be dialed up later without refactoring.

**Branch:** `feat/motion-light`, stacked on `feat/quiet-glass-theme` (the motion targets are the
tab screens that branch rewrote — basing on `main` would conflict and animate replaced code).

## Scope

**In** — two primitives + one token file, applied to the four main tab screens
(Today, Routine, Trend, You).

**Out (parked, revisit after test builds):** haptics (`expo-haptics` dep), ambient/looping motion
(breathing blooms, Scan-button pulse), trend-line draw-on, count-up numbers, screen/tab transitions.

**No new dependencies** — `react-native-reanimated@4.3.1` + `react-native-worklets@0.8.3` are
already installed.

## Components

### 1. `src/theme/motion.ts` — motion tokens
Single source for timing so values don't scatter as magic numbers.

- `DURATION = { quick: 180, base: 240, slow: 320 }` (ms)
- `EASE` — one calm ease-out curve (`Easing.out(Easing.cubic)`), no overshoot.
- `SPRING = { damping: 18, stiffness: 180, mass: 0.9 }` — settles without bounce.
- `STAGGER_MS = 50`, `STAGGER_MAX = 6` — cap so long lists don't cascade slowly.
- `ENTER_OFFSET = 16` (px rise distance).
- `useCalm(): boolean` — wraps Reanimated's `useReducedMotion()`. `true` means "skip motion":
  entrances render at final state, presses do not scale.

### 2. `src/components/ui/Rise.tsx`
Named `Rise`, not `FadeInUp`: Reanimated already exports a `FadeInUp` layout animation (which this
wraps), so sharing the name would be a footgun at import sites.

`Rise({ children, index = 0, style })` — on mount, animates `opacity 0→1` and
`translateY ENTER_OFFSET→0` over `DURATION.base` with `EASE`, delayed by
`min(index, STAGGER_MAX) * STAGGER_MS`.

- Under `useCalm()`: renders children at final state, no animation, no delay.
- Animates `opacity`/`transform` only — never blur or layout properties.

### 3. `src/components/ui/PressableScale.tsx`
`PressableScale(props)` — drop-in `Pressable` wrapper. `onPressIn` springs `scale` to `0.98`,
`onPressOut` back to `1`, using `SPRING`.

- Forwards all `Pressable` props (`onPress`, `accessibilityRole`, `disabled`, children, …).
- Under `useCalm()`: no scaling; press behavior otherwise identical.

## Application

- **Today / Trend / You / Routine:** wrap top-level cards and list rows in `<Rise index={i}>`
  so content settles in on mount.
- **`PressableScale`:** the Today mood chips, `ListRow`, and `PrimaryButton` press targets.
- Existing layout, copy, and colors are unchanged — this pass adds motion only.

## Constraints

- **Perf:** `opacity`/`transform` only, on the UI thread via Reanimated. Nothing animates blur or
  backdrop (that is what dropped frames on the Fold's Routine screen). No looping animations.
- **Calm:** no bounce/overshoot, ≤320 ms, ≤16 px travel.
- **A11y:** every animation respects OS reduce-motion via `useCalm()`.
- **Compliance:** motion only — touches no copy, scores, or claims; no analytics, no data paths.

## Testing

jest + jest-expo, `@testing-library/react-native`, colocated `__tests__`.

- `motion.ts`: token values and shape.
- `Rise`: renders children at any index; attaches an entrance animation, and none under
  reduce-motion (spy on our own `useCalm`). Delay maths is covered by `staggerDelay`'s tests.
- `PressableScale`: forwards `onPress` and `Pressable` props; press in/out does not throw;
  reduce-motion path renders and still fires `onPress`.
- Existing suites must stay green (the tab screens gain wrappers, so their queries must still match).

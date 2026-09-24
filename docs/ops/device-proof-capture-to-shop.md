# Device proof: capture → shade → ranked products (founder checklist)

Cards: `tt-gap05-capture-device-test-pack`, `tt-gap08-end-to-end-device-proof`.
**Status: NOT YET RUN on a physical device.** Host tests prove the logic; only this checklist,
run by a founder on a real phone, proves the device. Nothing here has passed until a completed
evidence sheet (§5) is filed.

## 1. What the build logs, and what it never logs

The `device-test` EAS profile sets `EXPO_PUBLIC_CAPTURE_EVIDENCE=1`. With that flag the app writes
one console line per capture and one per read, prefixed `[tt-evidence] `. Other builds write nothing.

- **Numbers and booleans only.** Never the image, a file URI, pixel bytes, or anything that
  identifies the person. Not shown in the UI, not sent to the backend (CLAUDE.md §1, §3).
- If a line ever shows a `file://` path or image data, **stop the run and report it** — that is a
  compliance bug, not a test result.

| Line | Fields | Pass bar |
|---|---|---|
| `{"kind":"capture",…}` | `originalBrightness`, `exposureLockSupported`, `whiteBalanceLockSupported`, `lockSucceeded`, `lockReleased`, `brightnessRestored`, `captured`, `error` | `captured:true`, `error:null`; `lockReleased` is `true` (or `null` when no lock was taken); `brightnessRestored` is `true` (or `null` when brightness could not be read) |
| `{"kind":"scan",…}` | `readOk`, `imageDeleted`, `skinClipFraction`, `clipPass`, `tone` (`L`,`a`,`b`) | `imageDeleted:true` **always**, even when `readOk:false`; `clipPass:true` (≤ 1% clipped pixels on cheeks + forehead) |

Bright-vs-dim comparison: CIE76 delta-E between the two `tone` values must be **< 2.0**
(`compareRooms` in `src/features/capture/device-evidence.ts`). These bars are provisional test
bars, not product thresholds.

## 2. Setup (once)

1. Build and direct-install: `eas build --profile device-test --platform ios` (or `android`).
   Record the git SHA and build number. No TestFlight, no store.
2. Turn **off** Night Shift, True Tone, auto-brightness, and any Android colour filter.
3. Open the console:
   - iOS: Mac → Console.app → select the phone → filter `tt-evidence`.
   - Android: `adb logcat | grep tt-evidence`.
4. Complete age gate and biometric consent as a normal user (both are part of the proof).

## 3. Checklist

Run every step on each device you file for (at least one iPhone; one Android if Android ships).

**A. Capture controls (gap 5)**
1. **Bright room** (normal ceiling lights). Open the scan. Expected: the gate does **not** pass and
   the hint reads exactly `Dim the room so the screen can light your face`. This is correct — the
   gate admits only dim ambient (brightness 0.05–0.4) so the screen flash dominates.
2. **Too dark** (lights off, no screen glow nearby). Expected hint:
   `Too dark — add a little light`.
3. **Dim room** (one lamp, away from face). Gate passes, countdown runs, screen goes full white
   and full brightness briefly, oval guide stays visible. After capture, screen brightness returns
   to what it was. Evidence: `capture` line passes; `scan` line passes.
4. **Second lighting condition that still passes the gate** (e.g. lamp a bit closer). Scan again.
   Compute delta-E between the two `tone` values: must be < 2.0.
5. **Lock release.** Back out of the scan, open the OS Camera app: exposure and white balance must
   auto-adjust normally (point at a window, then a dark corner).

**B. Scan → shade → ranked products (gap 8)**
6. After a passing scan, the result screen shows a shade as **words** (e.g. "Medium Warm") — no
   raw number for depth, warmth, or lightness.
7. Open **For You** / **Shop**. Products are listed with a fit % between 40 and 99, sorted high to
   low, and exactly one is marked best match. Record the top three product names and fit %.
8. Repeat step 3 twice more. Record whether the shade word stayed the same across the three scans.

**C. Image deletion**
9. Every `scan` line in the run shows `imageDeleted:true`.
10. iOS: Settings → General → iPhone Storage → TrueTone → Documents & Data should not grow by
    roughly one photo per scan. Android: Settings → Apps → TrueTone → Storage, same check. Record
    before/after size.

**D. Failure recovery**
11. Cover the camera during the countdown or turn the head away: gate blocks, hint updates, no
    crash; uncover and the scan completes.
12. Background the app mid-countdown, return: scan resumes or restarts cleanly, no stuck
    white screen, brightness restored.
13. Airplane mode, then scan: the read still runs on-device, the shade still shows, and
    `imageDeleted:true`. Any cloud-only surface (chat) may fail with a friendly message.
14. Any `readOk:false` line: the app shows a retry path, the next scan works, and that line still
    has `imageDeleted:true`.

**E. Data rights spot-check**
15. Account tab → Your Data → delete everything. App returns to a clean state; For You no longer shows
    the previous shade.

## 4. Stop conditions

Stop and report immediately if: an evidence line holds a URI or image data; `imageDeleted:false`
appears; the app shows a disease word; the camera stays locked after leaving the scan; the screen
stays at full brightness.

## 5. Evidence sheet (copy, fill, file with the card)

```
Build: git SHA ____  EAS build # ____  profile device-test
Device: ____ (model)  OS ____   Tester: ____   Date: ____
Display filters off: yes/no

Step | Result (pass/fail) | Evidence line(s) pasted verbatim / notes
1    |                    | hint text:
2    |                    | hint text:
3    |                    | [tt-evidence] {"kind":"capture",...}
     |                    | [tt-evidence] {"kind":"scan",...}
4    |                    | tone A:        tone B:        delta-E:
5    |                    |
6    |                    | shade words:
7    |                    | #1 ____ __%  #2 ____ __%  #3 ____ __%  best-match count:
8    |                    | shade words x3:
9    |                    | count of imageDeleted:true / total scan lines:
10   |                    | storage before:      after:
11   |                    |
12   |                    |
13   |                    | [tt-evidence] {"kind":"scan",...}
14   |                    |
15   |                    |
Stop condition hit: none / describe
```

No screenshots of the face, no photos, no video. Screenshots of the result screen or product list
are fine only if no face is visible.

## 6. What the host tests already prove (so the device run can focus on hardware)

- `src/features/capture/__tests__/device-e2e-pipeline.test.ts` — real read → shade → For You
  ranking chain with faked decode/detect/delete; image deleted on success and on failure; a
  failed read leaves no shade and the next scan recovers.
- `src/features/capture/__tests__/flash-orchestrator.test.ts` — lock/flash/restore ordering and
  the `capture` evidence line, including failure paths.
- `src/features/capture/__tests__/device-evidence.test.ts` — clip fraction, delta-E, evidence
  formatting, flag gating.
- `src/features/capture/__tests__/quality-gate.test.ts`, `face-metrics.test.ts` — gate hints and
  the neutral-pass fallback staying inside the lighting band.

What host tests cannot prove: real camera exposure/white-balance locking, the screen flash
actually lighting the face, real JPEG decode + face detection, real file deletion, and real
colour stability. That is this checklist's job.

// Regression guard: the capture gate must run on the REAL camera signals, not SIM_TIMELINE.
//
// use-frame-metrics.ts is a device-only native shell, excluded from coverage (jest.config.js) and
// untestable by rendering without brittle native mocks. But the one property that matters here is
// checkable statically, in the style of scripts/check-no-analytics-sdk.mjs: the flag that selects
// real signals vs the scripted simulation.
//
// Why this is worth a test: with FRAME_PROCESSORS_INSTALLED = false the gate auto-advances to
// "well framed" on a ~4.5s timer regardless of what the camera sees, so a scan can be taken and
// scored with no face check at all. Shipping that would mean showing a user a cosmetic reading
// derived from an image nothing verified — an honesty problem, not just a bug.
import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCE = readFileSync(join(__dirname, '..', 'use-frame-metrics.ts'), 'utf8');

describe('capture frame processors', () => {
  it('are enabled, so the gate reads the real camera and not SIM_TIMELINE', () => {
    expect(SOURCE).toMatch(/^const FRAME_PROCESSORS_INSTALLED = true;$/m);
  });

  it('still keeps the simulation available as an explicit opt-in', () => {
    // The scripted path stays in the codebase for rendering the capture screen without native
    // modules — it just must not be the default. `simulate` is a caller-supplied option.
    expect(SOURCE).toMatch(/simulate = !FRAME_PROCESSORS_INSTALLED/);
  });
});

# Invariance eval — 2026-07-25T22:14:30.889Z

> Synthetic harness. Measures self-consistency of the pipeline under simulated lighting,
> geometry and defect sweeps. It is **not an accuracy claim** and is not validation data on
> file — no accuracy, efficacy or skin-tone-equity statement may cite it (CLAUDE.md §1).

Overall: FAIL

## illuminant — FAIL
- worst: darkSpots = 0.1115
- hydration: 0.0298
- oiliness: 0.0688
- texture: 0.0298
- pores: 0.0326
- darkSpots: 0.1115
- redness: 0.0875
- fineLines: 0.0080
- darkCircles: 0.0338

## geometric — PASS
- worst: darkSpots = 0.0126
- hydration: 0.0056
- oiliness: 0.0007
- texture: 0.0056
- pores: 0.0206
- darkSpots: 0.0126
- redness: 0.0075
- fineLines: 0.0040
- darkCircles: 0.0039

## monotonic — PASS
- worst: darkSpots = 0.9747
- rho:darkSpots: 0.9747
- crosstalk:spots->hydration: 0.0000
- crosstalk:spots->oiliness: 0.0000
- crosstalk:spots->texture: 0.0000
- crosstalk:spots->pores: 0.0000
- crosstalk:spots->redness: 0.0051
- crosstalk:spots->fineLines: 0.0005
- crosstalk:spots->darkCircles: 0.0000
- rho:redness: 1.0000
- crosstalk:redness->hydration: 0.0000
- crosstalk:redness->oiliness: 0.0000
- crosstalk:redness->texture: 0.0000
- crosstalk:redness->pores: 0.0000
- crosstalk:redness->darkSpots: 0.0000
- crosstalk:redness->fineLines: 0.0000
- crosstalk:redness->darkCircles: 0.0000
- rho:oiliness: 0.9747
- crosstalk:oiliness->hydration: 0.0001
- crosstalk:oiliness->texture: 0.0001
- crosstalk:oiliness->pores: 0.0000
- crosstalk:oiliness->darkSpots: 0.0000
- crosstalk:oiliness->redness: 0.0004
- crosstalk:oiliness->fineLines: 0.0001
- crosstalk:oiliness->darkCircles: 0.0000
- rho:pores: 1.0000
- crosstalk:pores->hydration: 0.0000
- crosstalk:pores->oiliness: 0.0030
- crosstalk:pores->texture: 0.0000
- crosstalk:pores->darkSpots: 0.0000
- crosstalk:pores->redness: 0.0004
- crosstalk:pores->fineLines: 0.0000
- crosstalk:pores->darkCircles: 0.0000
- rho:fineLines: 1.0000
- crosstalk:lines->hydration: 0.0000
- crosstalk:lines->oiliness: 0.0000
- crosstalk:lines->texture: 0.0000
- crosstalk:lines->pores: 0.0000
- crosstalk:lines->darkSpots: 0.0000
- crosstalk:lines->redness: 0.0000
- crosstalk:lines->darkCircles: 0.0345
- rho:darkCircles: 1.0000
- crosstalk:darkCircles->hydration: 0.0000
- crosstalk:darkCircles->oiliness: 0.0000
- crosstalk:darkCircles->texture: 0.0000
- crosstalk:darkCircles->pores: 0.0000
- crosstalk:darkCircles->darkSpots: 0.0000
- crosstalk:darkCircles->redness: 0.0001
- crosstalk:darkCircles->fineLines: 0.0007
- rho:texture: 1.0000
- crosstalk:roughness->oiliness: 0.0000
- crosstalk:roughness->pores: 0.0000
- crosstalk:roughness->darkSpots: 0.0000
- crosstalk:roughness->redness: 0.0000
- crosstalk:roughness->fineLines: 0.0000
- crosstalk:roughness->darkCircles: 0.0000

## tone-preservation — PASS
- separation: 0.3919
- lum:I: 0.7727
- lum:II: 0.7305
- lum:III: 0.6618
- lum:IV: 0.5715
- lum:V: 0.4735
- lum:VI: 0.3809

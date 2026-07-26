# Invariance eval — 2026-07-26T01:56:53.986Z

> Synthetic harness. Measures self-consistency of the pipeline under simulated lighting,
> geometry and defect sweeps. It is **not an accuracy claim** and is not validation data on
> file — no accuracy, efficacy or skin-tone-equity statement may cite it (CLAUDE.md §1).

Overall: FAIL

## illuminant — PASS
- worst: redness = 0.0742
- hydration: 0.0298
- oiliness: 0.0688
- texture: 0.0298
- pores: 0.0326
- darkSpots: 0.0307
- redness: 0.0742
- fineLines: 0.0080
- darkCircles: 0.0338

## geometric — PASS
- worst: darkSpots = 0.0269
- hydration: 0.0056
- oiliness: 0.0007
- texture: 0.0056
- pores: 0.0206
- darkSpots: 0.0269
- redness: 0.0099
- fineLines: 0.0040
- darkCircles: 0.0039

## monotonic — PASS
- worst: oiliness = 0.9535
- rho:darkSpots: 0.9977
- crosstalk:spots->hydration: 0.0000
- crosstalk:spots->oiliness: 0.0000
- crosstalk:spots->texture: 0.0000
- crosstalk:spots->pores: 0.0000
- crosstalk:spots->redness: 0.0000
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
- rho:oiliness: 0.9535
- crosstalk:oiliness->hydration: 0.0001
- crosstalk:oiliness->texture: 0.0001
- crosstalk:oiliness->pores: 0.0000
- crosstalk:oiliness->darkSpots: 0.0000
- crosstalk:oiliness->redness: 0.0018
- crosstalk:oiliness->fineLines: 0.0001
- crosstalk:oiliness->darkCircles: 0.0000
- rho:pores: 0.9977
- crosstalk:pores->hydration: 0.0000
- crosstalk:pores->oiliness: 0.0030
- crosstalk:pores->texture: 0.0000
- crosstalk:pores->darkSpots: 0.0000
- crosstalk:pores->redness: 0.0018
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
- crosstalk:roughness->darkSpots: 0.0473
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

## defect-tone-fairness — FAIL
- worst: oiliness = 0.1188
- darkSpots:I: 0.7108
- darkSpots:II: 0.6941
- darkSpots:III: 0.7024
- darkSpots:IV: 0.6913
- darkSpots:V: 0.6774
- darkSpots:VI: 0.6774
- darkSpots: 0.0334
- redness:I: 0.1463
- redness:II: 0.1752
- redness:III: 0.2054
- redness:IV: 0.2020
- redness:V: 0.1980
- redness:VI: 0.2114
- redness: 0.0651
- oiliness:I: 0.0707
- oiliness:II: 0.0106
- oiliness:III: 0.0012
- oiliness:IV: 0.0035
- oiliness:V: 0.0324
- oiliness:VI: 0.1200
- oiliness: 0.1188
- pores:I: 0.1775
- pores:II: 0.1939
- pores:III: 0.2112
- pores:IV: 0.2204
- pores:V: 0.2347
- pores:VI: 0.2500
- pores: 0.0724
- fineLines:I: 0.0581
- fineLines:II: 0.0586
- fineLines:III: 0.0598
- fineLines:IV: 0.0619
- fineLines:V: 0.0672
- fineLines:VI: 0.0791
- fineLines: 0.0209
- darkCircles:I: 0.1620
- darkCircles:II: 0.1589
- darkCircles:III: 0.1418
- darkCircles:IV: 0.1245
- darkCircles:V: 0.1047
- darkCircles:VI: 0.0862
- darkCircles: 0.0758
- texture:I: 0.0911
- texture:II: 0.0905
- texture:III: 0.0907
- texture:IV: 0.0930
- texture:V: 0.1019
- texture:VI: 0.1537
- texture: 0.0632
- hydration:I: 0.9089
- hydration:II: 0.9095
- hydration:III: 0.9093
- hydration:IV: 0.9070
- hydration:V: 0.8981
- hydration:VI: 0.8463
- hydration: 0.0632

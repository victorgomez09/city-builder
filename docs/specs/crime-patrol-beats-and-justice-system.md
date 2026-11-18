# Crime, patrol beats and justice system

**Owns:** localized crime concentration, police patrol beat coverage, court processing, and detention capacity.

**Rules:**

- Crime hot-spots concentrate dynamically around unlit streets, high unemployment, and abandoned lots. `[R-services-041]`
- Police precinct patrol beats directly suppress crime probability along connected road corridors. `[R-services-041]`
- Municipal court backlog and jail overcrowding accelerate criminal recidivism. `[R-services-041]`
- Active precinct coverage mitigates citizen fear and restores neighborhood land values. `[R-services-041]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `CRIME_UNLIT_FACTOR` | 1.40 | multiplier | [Night crime risk](../../src/sim/justice.ts) |
| `CRIME_BLIGHT_FACTOR` | 1.60 | multiplier | [Abandoned lot risk](../../src/sim/justice.ts) |
| `JAIL_CAPACITY_PER_PRECINCT` | 50 | inmates | [Detention standard](../../src/sim/justice.ts) |
| `COURT_CASES_PER_DAY` | 20 | cases | [Judicial throughput](../../src/sim/justice.ts) |

**Code:** `src/sim/justice.ts` `JusticeSim` — tracks crime concentration, patrol beats, and justice capacity.
`src/ui/advisor.ts` — alerts on jail capacity breaches and crime waves.

**Tests:** `src/sim/justice.test.ts` — hotspot emergence, patrol suppression, and judicial bottlenecks.

**Open:** none.

## Crime concentration dynamics

Criminal activity clusters in neglected urban pockets: unlit back alleys, areas suffering severe unemployment (>25%), and neighborhoods plagued by abandoned building blight.
Crime suppresses local citizen happiness and depresses land values.

## Patrol beats and deterrence

Police cars assigned to patrol beats cruise local road networks.
A high patrol frequency deters street crime, driving down localized crime rates and restoring public safety.

## The justice pipeline

Arrested offenders pass through municipal courts for trial and are held in detention facilities.
When court caseflow is overwhelmed or jails exceed capacity (>90%), offenders are released prematurely, causing criminal recidivism to spike.

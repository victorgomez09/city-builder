# Natural and industrial disasters

**Owns:** wildfire propagation, river floodplain flooding, industrial chemical leaks, and emergency relief.

**Rules:**

- Summer heatwaves ignite woodland wildfires across dry vegetation and tree stands. `[R-world-056]`
- Torrential rainfall induces riverbank flooding across low-elevation floodplains. `[R-world-056]`
- Industrial accidents produce expanding toxic chemical clouds in heavy industrial zones. `[R-world-056]`
- Warning sirens trigger district evacuations and unlock municipal disaster recovery grants. `[R-world-056]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `WILDFIRE_PROPAGATION_CHANCE` | 0.05 | per pass | [Fire spread rate](../../src/sim/disasters.ts) |
| `FLOOD_ELEVATION_THRESHOLD` | 3.5 | metres | [River floodplain cutoff](../../src/sim/disasters.ts) |
| `CHEMICAL_LEAK_RADIUS` | 6 | tiles | [Toxic vapor envelope](../../src/sim/disasters.ts) |
| `DISASTER_RELIEF_GRANT` | 20000 | ¢ | [Emergency relief grant](../../src/sim/disasters.ts) |

**Code:** `src/sim/disasters.ts` `DisasterSim` — models disaster outbreaks, environmental propagation, and damage.
`src/ui/advisor.ts` — issues siren warnings and evacuation orders.

**Tests:** `src/sim/disasters.test.ts` — seasonal ignition, floodplain flooding, chemical leak containment, and relief grants.

**Open:** none.

## Wildfire propagation

During hot dry summer periods, unmitigated heat sparks wildfires in dry woodland stands.
Flames spread to adjacent tree stands, generating high smoke and threatening urban outskirts before burn-out or containment.

## River floodplain flooding

Heavy rainfall swells waterways, causing rivers to overflow onto adjacent low-elevation terrain (<3.5m).
Submerged road tiles suffer structural damage and temporary traffic closure.

## Industrial chemical leaks

Catastrophic chemical leaks occur in heavy industrial sectors, creating a concentrated toxic vapor cloud.
Vapor plumes spike local pollution to maximum values, necessitating rapid district evacuation to avoid mass casualties.

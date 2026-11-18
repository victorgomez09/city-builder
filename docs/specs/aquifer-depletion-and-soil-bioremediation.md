# Aquifer depletion and soil bioremediation

**Owns:** groundwater table drawdown, saltwater intrusion risk, and brownfield soil decontamination.

**Rules:**

- Groundwater table depletes under prolonged extraction exceeding natural recharge rates. `[R-services-042]`
- Critical groundwater drawdown on coastal aquifers induces permanent saltwater intrusion. `[R-services-042]`
- Heavy industrial lots retain persistent soil toxicity preventing residential redevelopment. `[R-services-042]`
- Environmental bioremediation passes decontaminate brownfield soils for clean urban reuse. `[R-services-042]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `AQUIFER_RECHARGE_RATE_KL` | 1500 | kL/month | [Natural recharge](../../src/sim/aquifer.ts) |
| `SALTWATER_INTRUSION_THRESHOLD` | 0.20 | ratio | [Saltwater intrusion line](../../src/sim/aquifer.ts) |
| `BIOREMEDIATION_COST_PER_TILE` | 250 | ¢ | [Decontamination fee](../../src/sim/aquifer.ts) |

**Code:** `src/sim/aquifer.ts` `AquiferSim` — tracks groundwater reservoir levels, drawdown, and brownfield soil toxicity.
`src/ui/advisor.ts` — alerts on aquifer depletion and soil contamination.

**Tests:** `src/sim/aquifer.test.ts` — drawdown mechanics, coastal intrusion risks, and bioremediation decontamination.

**Open:** none.

## Groundwater table drawdown

Municipal water pumping stations draw from regional subterranean aquifers.
When extraction exceeds the natural monthly recharge rate (1,500 kL/mo), groundwater levels decline.
Depletion below 20% on coastal maps risks saltwater infiltration, permanently degrading municipal water yield.

## Brownfield soil bioremediation

Heavy manufacturing, chemical plants, and refineries leach industrial contaminants into underlying soils.
Decommissioned heavy industrial parcels retain dangerous soil toxicity.
Attempting to rezone toxic brownfields for residential development produces high illness and abandonment unless bioremediation decontamination passes are executed.

# Multimodal commute and congestion pricing

**Owns:** commute modal split calculation, congestion pricing cordons, and low-emission zones.

**Rules:**

- Multimodal commute modal split allocates commuter trips across walking, cycling, private vehicles, and transit. `[R-roads-083]`
- Trip distance, road network congestion, and transit ticket pricing dynamically govern mode choice. `[R-roads-083]`
- Cordon congestion pricing charges vehicular tolls to suppress downtown peak traffic. `[R-roads-083]`
- Low-Emission Zones (LEZ) ban or penalize high-emission commuter vehicles. `[R-roads-083]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `MAX_WALK_COMMUTE_DISTANCE` | 400 | metres | [Walkability radius](../../src/sim/multimodal.ts) |
| `MAX_CYCLE_COMMUTE_DISTANCE` | 1500 | metres | [Cycling threshold](../../src/sim/multimodal.ts) |
| `CONGESTION_CORDON_TOLL` | 5 | ¢/trip | [Congestion pricing charge](../../src/sim/multimodal.ts) |
| `LEZ_EMISSION_PENALTY` | 0.40 | ratio | [Emission reduction target](../../src/sim/multimodal.ts) |

**Code:** `src/sim/multimodal.ts` `MultimodalSim` — calculates modal split, congestion toll revenue, and LEZ traffic shifts.
`src/ui/advisor.ts` — alerts on severe avenue gridlock.

**Tests:** `src/sim/multimodal.test.ts` — distance-based modal selection, congestion elasticity, and toll revenue generation.

**Open:** none.

## Multimodal commute choice

Commuter trips derive from the residential-to-employment gravity distribution.
Short-distance commutes (<400m) are absorbed primarily by walking and cycling.
Longer distances shift commuters to private automobiles or mass transit lines (bus, tram, and rail).

## Congestion cordon pricing and Low-Emission Zones

Designated downtown districts implement congestion cordon pricing, charging an entry toll to personal motor vehicles during daytime hours.
Low-Emission Zones mandate clean mobility, diverting heavy emitting vehicles and increasing local pedestrian street happiness.
Tolls collect additional municipal revenues while suppressing vehicular gridlock.

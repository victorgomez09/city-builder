# Civic unrest and citizen protests

**Owns:** emergence of citizen demonstrations, crowd generation, street traffic choke, and Advisor ultimatums.

**Rules:**

- Citizen protests spawn when residential happiness drops below 40 or acute civic grievances exceed stress thresholds. `[R-world-052]`
- Protesting crowds gather along street frontages and pedestrian plazas, drawn as instanced crowd figures without per-citizen agents. `[R-render-001]`
- A street tile occupied by a demonstration incurs a 70% road flow capacity penalty, inducing localized congestion. `[R-roads-004]`
- Protests register actionable ultimatums with the Advisor that clear once the triggering grievance is remediated. `[R-design-005]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `PROTEST_HAPPINESS_THRESHOLD` | 40 | byte (0..255) | [Sim happiness cutoff, fields.ts](../../src/sim/fields.ts) |
| `PROTEST_TAX_THRESHOLD` | 0.15 | rate (0..0.30) | [Punitive tax threshold, store.ts](../../src/ui/store.ts) |
| `PROTEST_ROAD_CAPACITY_FACTOR` | 0.30 | multiplier | [Traffic bottleneck factor, network.ts](../../src/sim/network.ts) |
| `PROTEST_MIN_DURATION_TICKS` | 40 | ticks (~5 sim days) | [Dispatch incident duration, dispatch.ts](../../src/sim/dispatch.ts) |

**Code:** `src/sim/unrest.ts` `UnrestSim` — evaluates grievances, spawns active protests, applies road capacity choke.
`src/render/protests.ts` `ProtestRenderer` — renders instanced crowd picketers and banners on sidewalks.
`src/ui/advisor.ts` `unrestIssues` — maps active protests to Advisor ultimatums.

**Tests:** `src/sim/unrest.test.ts` — protest triggers, traffic restriction, grievance satisfaction.
`src/render/protests.test.ts` — instanced crowd allocation and placement.

**Open:** none.

## Why protests emerge from civic grievances

A city simulation that renders visual polish without systemic consequences feels hollow.
When taxes exceed bearable thresholds (>15%) or services fail, citizens react through collective action.
Demonstrations represent localized discontent that spills onto streets rather than abstract spreadsheet numbers.

Protests target visible municipal focal points: City Hall, high-tax residential corridors, or polluting factory gates.
Crowds gather on footways and pedestrian plazas without individual pathfinding agents, preserving browser frame budgets.

## Traffic chokes and economic disruption

Protesting crowds occupy adjacent street carriageways, reducing road capacity to 30% of normal throughput.
This creates localized traffic jams, delaying civilian commuters and commercial freight deliveries.
In severe industrial strikes, factories cease production, reducing tax revenue and halting cargo dispatches.

## Advisor ultimatums and grievance remediation

Demonstrations are not permanent disasters; they communicate clear, actionable player choices.
The Advisor elevates protests to high-priority alerts with direct camera focus links and specific remedies.
Lowering punitive taxes, restoring power and water, or constructing clinics disperses the crowd.
Resolving an active protest grants a temporary civic relief morale bonus, accelerating recovery.

## Decided

- Statistical crowd clusters over individual agent navigation, maintaining 60 FPS under laptop hardware budgets.
- Direct road capacity throttling over full road closures, preventing complete pathfinding failure across the road graph.
- Advisor ultimatum integration over intrusive modal dialogues, respecting player camera autonomy.

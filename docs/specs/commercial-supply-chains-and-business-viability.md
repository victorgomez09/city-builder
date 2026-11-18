# Commercial supply chains and business viability

**Owns:** freight delivery dependency, commercial profitability, goods stockouts, and insolvency.

**Rules:**

- Commercial supply chains require physical road connectivity to industrial zones or highway edge connections. `[R-world-054]`
- Unsupplied commercial shops suffer goods stockouts, depressing profit margins. `[R-world-054]`
- Sustained losses trigger commercial insolvency and local land value depression. `[R-world-054]`
- Corporate tax hikes curb commercial profit margins and accelerate bankruptcy risk. `[R-world-054]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `BASE_PROFIT_MARGIN` | 0.22 | ratio | [Commercial baseline margin](../../src/sim/supplychain.ts) |
| `STOCKOUT_MARGIN_PENALTY` | 0.30 | ratio | [Stockout profit penalty](../../src/sim/supplychain.ts) |
| `INSOLVENCY_MARGIN_THRESHOLD` | -0.10 | ratio | [Insolvency boundary](../../src/sim/supplychain.ts) |
| `INSOLVENCY_TAX_FACTOR` | 0.25 | ratio | [Tax receipt collapse factor](../../src/sim/supplychain.ts) |

**Code:** `src/sim/supplychain.ts` `SupplyChainSim` — tracks freight connectivity, commercial margins, and stock levels.
`src/ui/InfoPanel.tsx` — shows commercial profit margins, stock status, and insolvency flags.

**Tests:** `src/sim/supplychain.test.ts` — connectivity evaluation, margin elasticity, and stockout penalties.

**Open:** none.

## Freight delivery dependency

Commercial shops sell finished goods produced by local industrial factories or imported from highway connections.
When a commercial shop has a road path to an active industrial building or map-edge highway connection, it maintains stocked inventory.
Disconnected shops or cities with zero industrial capacity and no highway links suffer inventory stockouts.

## Profitability and corporate tax elasticity

Commercial viability is calculated as:
`profitMargin = baseMargin + footTraffic + taxFactor - laborFriction - stockoutPenalty`.
Corporate taxes above 18% severely compress operating margins. Combined with inventory stockouts, profit margins turn negative.

## Blight and insolvency

When margins fall below -10%, businesses become insolvent.
Insolvent storefronts pay only a fraction of normal municipal taxes and emit a negative land value modifier to adjacent tiles.

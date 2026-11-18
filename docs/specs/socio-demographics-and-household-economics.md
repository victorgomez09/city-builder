# Socio-demographics and household economics

**Owns:** statistical household income tier distribution, balance sheet calculations, and poverty rate effects.

**Rules:**

- Demographics simulate three socio-economic income tiers (low, medium, high) statistically per residential building. `[R-world-053]`
- Population calculations remain aggregate statistical sums without per-citizen physical agents. `[R-world-007]`
- Household balance sheets balance wages against living costs, municipal utility fees, and residential taxes. `[R-world-053]`
- Sustained household deficits drive localized economic distress, suppressing immigration and elevating civic unrest risk. `[R-world-052]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `WAGE_LOW_INCOME` | 1200 | ¢/month | [Household wage benchmark](../../src/sim/demographics.ts) |
| `WAGE_MEDIUM_INCOME` | 2800 | ¢/month | [Household wage benchmark](../../src/sim/demographics.ts) |
| `WAGE_HIGH_INCOME` | 6500 | ¢/month | [Household wage benchmark](../../src/sim/demographics.ts) |
| `BASE_LIVING_COST_LOW` | 900 | ¢/month | [Essential living cost](../../src/sim/demographics.ts) |
| `BASE_LIVING_COST_MEDIUM` | 1800 | ¢/month | [Essential living cost](../../src/sim/demographics.ts) |
| `BASE_LIVING_COST_HIGH` | 3800 | ¢/month | [Essential living cost](../../src/sim/demographics.ts) |

**Code:** `src/sim/demographics.ts` `DemographicsSim` — evaluates income brackets, household balance sheets, and poverty metrics.
`src/ui/BudgetPanel.tsx` — displays household economics, disposable income gauges, and tax elasticity feedback.

**Tests:** `src/sim/demographics.test.ts` — income tier distribution, tax shock impacts, and poverty rate calculation.

**Open:** none.

## Why statistical income tiers over individual agents

Simulating hundreds of thousands of independent citizen wallets destroys CPU caches and browser frame rates.
Instead, residential buildings distribute occupants across three statistical income tiers: low, medium, and high.
Building level, local land value, and school access determine which bracket moves into each neighbourhood.

Level 1 residences house starter families (predominantly low-income).
Level 2 apartments accommodate middle-class households.
Level 3 luxury manors and high-value downtown towers attract high-income residents with high tax contributions.

## Household balance sheets and living costs

Each bracket earns a base monthly wage and pays essential living costs: rent/mortgage, utility service fees, and taxes.
Disposable income represents what remains after these mandatory expenditures:
`disposable = wage - (livingCosts + taxRates.res * wage)`.

When residential taxes are raised to punitively high levels (>15%), low-income households plunge into deficit.
A household in deficit cannot accumulate savings, leading to localized poverty, decay, and civil unrest.

## Decided

- Statistical cohort distribution over individual agent bank accounts, respecting laptop hardware budgets.
- Direct integration into municipal budget feedback rather than a hidden background multiplier.
- Three clear income brackets (low, medium, high) mirroring genre conventions and educational rungs.

# Systemic crises and municipal default

**Owns:** municipal bond credit ratings, penalty interest rates, public sector strikes, and health epidemics.

**Rules:**

- Heavy debt near the ceiling under negative cash flow triggers bond rating downgrades and penalty interest rates. `[R-world-055]`
- Service funding slashed below 70% triggers public sector worker walkouts and strikes. `[R-world-055]`
- Sustained garbage backlogs and unchecked industrial pollution ignite contagious health epidemics. `[R-world-055]`
- Epidemics overload healthcare facilities and diminish active workforce productivity. `[R-world-055]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `BOND_INTEREST_AAA` | 0.01 | monthly rate | [Prime credit interest](../../src/sim/crises.ts) |
| `BOND_INTEREST_A` | 0.02 | monthly rate | [Downgraded tier A rate](../../src/sim/crises.ts) |
| `BOND_INTEREST_BBB` | 0.035 | monthly rate | [Downgraded tier BBB rate](../../src/sim/crises.ts) |
| `BOND_INTEREST_DEFAULT` | 0.05 | monthly rate | [Junk bond default penalty rate](../../src/sim/crises.ts) |
| `SERVICE_STRIKE_THRESHOLD` | 0.70 | ratio | [Service funding strike line](../../src/sim/crises.ts) |

**Code:** `src/sim/crises.ts` `SystemicCrisesSim` — tracks debt ratios, credit downgrades, strikes, and disease spread.
`src/ui/BudgetPanel.tsx` — displays municipal credit rating, bond interest rates, and debt status.
`src/ui/ServicesPanel.tsx` — shows worker strike banners and disabled operational capacity.

**Tests:** `src/sim/crises.test.ts` — fiscal rating transitions, penalty interest calculation, and strike triggers.

**Open:** none.

## Municipal bond credit ratings

A solvent city with moderate borrowing maintains an investment-grade AAA credit rating paying 1% monthly interest.
When loans exceed ¢75,000 during cash deficits, credit rating agencies downgrade municipal paper to A (2%) and BBB (3.5%).
Reaching catastrophic debt (>¢95,000) under negative monthly cash flow trips a fiscal default state with 5% monthly penalty interest.

## Public sector worker strikes

Slashing any municipal service budget below 70% prompts union walkouts.
Striking departments (police, fire, healthcare, education, or sanitation) suffer an 75% collapse in operational effectiveness, inflicting severe citywide happiness penalties and triggering public safety emergencies.

## Contagious health epidemics

Accumulating uncollected garbage or subjecting residential districts to hazardous industrial pollution triggers epidemic outbreaks.
Epidemics surge patient intake beyond hospital capacity and reduce available workforce labor.

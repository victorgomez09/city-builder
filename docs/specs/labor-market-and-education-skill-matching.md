# Labor market and education skill matching

**Owns:** workforce skill segmentation, educational matching, office vacancy rates, and structural unemployment.

**Rules:**

- Workforce capacity is segmented across four education tiers: uneducated, elementary, secondary, and college. `[R-world-058]`
- High-tier office towers demand college-educated labor; shortages produce chronic job vacancies. `[R-world-058]`
- Unskilled labor experiences structural unemployment when industrial and low-commercial jobs are scarce. `[R-world-058]`
- Expanding secondary schools and regional college campuses balances labor market skill matching. `[R-world-058]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `COLLEGE_OFFICE_JOB_SHARE` | 0.60 | ratio | [Office skill requirement](../../src/sim/labormarket.ts) |
| `UNSKILLED_MANUAL_SHARE` | 0.70 | ratio | [Industrial manual labor share](../../src/sim/labormarket.ts) |
| `STRUCTURAL_UNEMPLOYMENT_CAP` | 0.35 | ratio | [Unemployment boundary](../../src/sim/labormarket.ts) |

**Code:** `src/sim/labormarket.ts` `LaborMarketSim` — balances labor supply by educational rung against sector job requirements.
`src/ui/advisor.ts` — alerts on educated labor shortages and structural unemployment.

**Tests:** `src/sim/labormarket.test.ts` — skill rung distribution, office vacancy spikes, and structural job mismatch.

**Open:** none.

## Workforce skill segmentation

The city workforce is segmented into four distinct educational rungs:
Uneducated, Elementary School graduate, High School graduate, and College graduate.
Educational attainment is driven by local school ladder coverage (elementary, middle, high, college).

## Sector skill matching

Industrial factories and starter corner shops employ predominantly uneducated and elementary-educated labor.
Level 3 corporate offices and high-tech campuses mandate college graduates for at least 60% of their positions.
Shortages of university graduates stall office employment, leaving vacant desks while uneducated laborers suffer unemployment.

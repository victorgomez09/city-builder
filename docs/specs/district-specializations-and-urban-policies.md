# District specializations and urban policies

**Owns:** district specializations, urban policy modifiers, and localized zoning directives.

**Rules:**

- District specializations enact localized economic, environmental, and traffic mandates. `[R-world-057]`
- Tourism Quarters generate hotel occupancy tax surcharges and pedestrian traffic boosts. `[R-world-057]`
- High-Tech Campuses require high education rungs, zero pollution, and accelerate high-value office growth. `[R-world-057]`
- Clean Eco-Districts ban heavy freight transit and generate municipal recycling bonuses. `[R-world-057]`

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `TOURISM_TAX_MULT` | 1.15 | multiplier | [Tourism surcharge](../../src/sim/policy.ts) |
| `HIGH_TECH_OFFICE_MULT` | 1.25 | multiplier | [High-tech office bonus](../../src/sim/policy.ts) |
| `ECO_DISTRICT_RECYCLING_BONUS` | 1.20 | multiplier | [Eco-district bonus](../../src/sim/policy.ts) |

**Code:** `src/sim/policy.ts` `PolicyStore` — applies district policy modifiers to taxation, emissions, and demand.

**Tests:** `src/sim/policy.test.ts` — specialization multipliers, policy composition, and district boundary isolation.

**Open:** none.

## Tourism & Historic Quarter

Historic Quarters apply preservation guidelines and charge hotel occupancy surcharges (+15% commercial revenue).
Streets encourage pedestrian foot traffic and cultural events, boosting tourism income.

## High-Tech Innovation Campus

High-Tech Campuses demand college-educated labor and zero industrial pollution.
In exchange, they accelerate premier commercial office demand and high-wage job creation (+25%).

## Clean Eco-District

Clean Eco-Districts mandate clean energy adoption, prohibit heavy diesel freight transit, and reward zero-waste recycling with a +20% recovery bonus.

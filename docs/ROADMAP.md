# CityVI — Design & Technical Roadmap

**CityVI** is a small-form-factor **city builder** for the browser: a
familiar city-builder play grammar and UI layout at reduced scale, built on
**Three.js** as a deliberate engine showcase — proof that a web engine can
deliver a living, data-rich city sim. Maps and texture sets are
**AI-generated raster assets** (terrain heightmaps + satellite-style
colormaps, facade/ground atlases).

Two identities, one build:

- **The game**: paint zones, grow a city, read it through infoviews — the
  genre's feel, browser-sized.
- **The demo**: instancing at scale, day/night, GPU-friendly sim fields,
  buttery RTS camera — Three.js flexing.

_Design rationale and scope guards live in [DESIGN.md](DESIGN.md).
Discipline specifications start at [README.md](README.md); the player-facing guide is
[USERGUIDE.md](userguide/README.md). Shipped history narrative is in
[roadmap/0-what-is-shipped.md](roadmap/0-what-is-shipped.md)._

---

## 1. Immediate Priorities (TODO)

- [x] **Extreme Simulation: Civic Discontent, Citizen Protests & Demonstrations**:
  - Dynamic protest emergence when district or citywide happiness plunges (<40%) or acute grievances spike (excessive residential taxes >15%, persistent blackouts, uncollected garbage, zero healthcare/school access, severe unemployment) (`[R-world-052]`, `src/sim/unrest.ts`).
  - Street demonstrations & marches: citizen crowds assemble in front of City Hall, public plazas, or march along major avenues with protest signs and banners.
  - Road blockades & traffic disruption: protesting crowds occupy street carriageways, reducing road flow capacity by 70% and triggering localized traffic gridlock (`PROTEST_ROAD_CAPACITY_FACTOR = 0.30`).
  - Workplace walkouts & industrial strikes: prohibitive corporate tax rates (>18%) provoke factory worker strikes, shutting down production, freezing tax revenue, and disrupting supply lines.
  - Low-draw-call visual crowd rendering: instanced crowd figures and picket clusters placed on sidewalks and pedestrian plazas adhering to palette standards (`[R-render-001]`, `src/render/protests.ts`).
  - Advisor ultimatums & grievance resolution: protest leaders present explicit demands through the Advisor ("Cut Residential Taxes", "Build Local Clinic"); resolving demands disperses crowds and triggers a civic relief morale boost (`src/ui/advisor.ts`).

- [x] **Extreme Simulation: Socio-Demographics & Household Economic Stress**:
  - Socio-economic income tiers: statistical distribution across low, middle, and high-income brackets without per-citizen agent overhead (`[ADR-0001]`, `[R-world-053]`, `src/sim/demographics.ts`).
  - Bracket-specific vulnerability: low-income households are acutely sensitive to tax hikes and inflation; affluent households demand high land value, cultural amenities, zero pollution, and low noise.
  - District household balance sheets: tracks disposable income vs living costs (rents, mortgage, sector tax burden, municipal utility tariffs).
  - Sustained household deficits trigger poverty degradation and acute civil unrest risk (`BudgetPanel`, `InfoPanel`).

- [x] **Extreme Simulation: Commercial Supply Chains & Business Viability**:
  - Physical freight delivery dependency: commercial shops require periodic deliveries of finished goods from local industrial zones or highway connections (`[R-roads-004]`, `[R-world-054]`, `src/sim/supplychain.ts`).
  - Stockouts & commercial distress: unsupplied shops suffer goods stockouts, depressing profit margins and triggering commercial blight.
  - Profit margins & corporate tax elasticity: dynamic profitability tracking per commercial parcel based on customer foot traffic, tax rates, and labor supply (`InfoPanel`, `BudgetPanel`).
  - Commercial insolvency cycles: unprofitable businesses become insolvent, reducing tax revenues and depressing neighborhood land value.

- [x] **Extreme Simulation: Systemic Crises & Municipal Default**:
  - Contagious health epidemics: prolonged garbage backlog or unmitigated industrial pollution triggers disease outbreaks that overload hospitals and decimate workforce productivity (`[R-world-055]`, `src/sim/crises.ts`).
  - Public sector worker strikes: slashing service funding below operational thresholds (<70% funding) triggers police slowdowns, fire department strikes, and sanitation walkouts (`ServicesPanel`).
  - Municipal fiscal default & bond downgrades: carrying debt near the ¢100,000 ceiling under chronic negative cash flow triggers bond rating downgrades, raising loan interest penalties and forcing emergency austerity (`BudgetPanel`).

---

## 2. Open Backlog & Technical Debt (TODO)

- [x] **Natural & Industrial Disasters (Emergencias y Desastres)**:
  - Summer wildfire propagation through dry woodlands, river flooding during heavy rainfall, and hazardous industrial chemical leaks (`[R-world-056]`, `src/sim/disasters.ts`).
  - Emergency warning sirens, district evacuation orders, damage assessment passes, and disaster recovery grants (`advisor.ts`).
- [x] **Dynamic Crime, Police Patrol Beats & Justice System**:
  - Spatially concentrated crime hot-spots around dark unlit streets, high unemployment clusters, and industrial decay (`[R-services-041]`, `src/sim/justice.ts`).
  - Patrol cars assigned to beats; precinct coverage, court capacity, and detention facilities directly deterring crime escalation (`advisor.ts`).
- [x] **Multimodal Commute Choice & Congestion Pricing**:
  - Modal split (walking, cycling, personal vehicle, transit) derived from route congestion, fuel cost, and transit ticket pricing (`[R-roads-083]`, `src/sim/multimodal.ts`).
  - Low-Emission Zones (LEZ) and downtown congestion cordon pricing charging tolls to high-emission commuter vehicles.
- [x] **District Specializations & Urban Policies**:
  - Tourism & Historic Quarter: historic preservation orders, pedestrian cobblestone avenues, and hotel occupancy tax surcharges (`[R-world-057]`, `src/sim/policy.ts`).
  - High-Tech Innovation Campus: requires university graduates and zero pollution; generates high-wage office demand.
  - Clean Eco-District: mandatory rooftop solar power, ban on heavy freight transit, and zero-waste municipal recycling bonuses.
- [x] **Labor Market & Education Skill Matching**:
  - Segmented workforce skills (uneducated, elementary, secondary, and college-educated labor pools) (`[R-world-058]`, `src/sim/labormarket.ts`).
  - High-tier office towers demand college graduates; shortages produce office vacancies, while uneducated workers suffer unemployment (`advisor.ts`).
- [x] **Aquifer Depletion & Environmental Soil Bioremediation**:
  - Groundwater table drawdown from excessive municipal pumping; saltwater intrusion risk on coastal aquifers (`[R-services-042]`, `src/sim/aquifer.ts`).
  - Persistent soil toxicity on brownfield heavy industrial lots requiring bioremediation passes before residential redevelopment (`advisor.ts`).
- [ ] **UI Modernization & Aesthetic Redesign**:
  - Visual overhaul of panel chrome, HUD layout, typography, iconography, and micro-interactions ([ux/](ux/README.md), [ui-style-guide.md](art/ui-style-guide.md)).
- [x] **Zoom-Adaptive Directional Shadows & Calibrated Contact Lighting**:
  - Zoom-dependent dynamic shadow frustum span (tight near-field focus at street level, expansive horizon coverage at overview) ([lighting.md](visual-render/lighting.md), `src/render/scene.ts`, `src/render/sun.ts`).
  - Contact shadow softening and PCF filter radius adjustment based on solar elevation and time-of-day (`[R-render-018]`, `[R-render-020]`).
  - Calibrated earth ground bounce fill illumination preventing shaded building faces from crushing to flat black.
- [x] **Atmospheric Aerial Perspective & Dynamic Twilight Scattering**:
  - Rayleigh and Mie atmospheric scattering color gradients for dawn, golden hour, and twilight sky domes (`src/render/sky.ts`).
  - Aerial perspective depth tinting where distant alpine peaks and horizon features softly blend into atmospheric haze ([terrain.md](visual-render/terrain.md), `src/render/terrain.ts`).
- [x] **Procedural Water Articulation, Coastal Waves & Weather Interaction**:
  - Animated water surface micro-glint and depth-based color absorption from azure shallows to deep navy trenches ([water.md](visual-render/water.md), `src/render/water.ts`).
  - Procedural coastal wave break and dynamic foam line along sand and rock contacts (`[R-render-010]`).
  - Puddle gloss and wet surface specular reflections during rain transitions, and seasonal snow drift coverage on roofs and roadsides ([vfx.md](visual-render/vfx.md), `src/render/weather.ts`).
- [x] **Night City Glow, Vehicle Headlights & Interior Windows**:
  - Active vehicle headlight projection cones and braking taillights on road surfaces at night (`src/render/vehicles.ts`).
  - Organically varied window emissive tones (warm tungsten, cool office LED) across residential and commercial buildings (`src/render/facade.ts`, `src/render/nightlook.ts`).
  - Ambient storefront glow and smooth light pools on sidewalks under street lamps (`src/render/lamps.ts`).
- [x] **Architectural Edge Beveling & Window Specular Reflections**:
  - Vertex normal edge beveling along building silhouettes and roof eaves to catch crisp specular highlights (`src/render/buildingkit.ts`, `src/render/buildings.ts`).
  - Subtle Fresnel specular sky reflections on facade glass panes ([materials.md](visual-render/materials.md)).
- [ ] **Hierarchical GPU Frustum Culling & Dense Foliage Mesh LOD**:
  - Chunk-level bounding volume hierarchy (BVH) frustum culling for instanced building kits, urban props, and tree stands ([lod.md](visual-render/lod.md), `src/render/trees.ts`).
  - Dynamic distance-based LOD mesh transitions for high-altitude camera overviews to sustain locked 60 fps on large metropolis maps (`[R-render-004]`, [performance-budget.md](engineering/performance-budget.md)).
- [x] **Visual Defects Punchlist**:
  - Triage and resolution of logged screenshot audit defects ([open-visual-defects.md](roadmap/open-visual-defects.md)).
- [x] **Junction Turn Radii & Curve Transitions**:
  - Class-based minimum turn radius enforcement on bends and transitions (`[R-roads-081]`).
- [x] **Heavy Industrial Lot Depths**:
  - Deepen 4×3 heavy industrial lots to fit 16m semi-truck trailer courts ([specs/lots-and-land.md](specs/lots-and-land.md)).
- [x] **Bus Stops on Free-Form Road Curves**:
  - Support bus shelters on non-grid curve segments reusing the lamp pole projection frame.
- [x] **Metropolis Triangle Budget Optimization**:
  - Triangle reduction across merged road/lot meshes and dense wild tree stands ([performance-budget.md](engineering/performance-budget.md#the-main-thread-while-a-city-grows)).
- [x] **Furniture & Service Line Polish**:
  - Clean detachment of orphaned power line segments ([power-distribution.md](specs/power-distribution.md)).
  - Clearance fixes for structured parking stalls ([structured-parking.md](specs/structured-parking.md)).
  - Utility pole alignment inside the furnishing strip ([street-furniture.md](specs/street-furniture.md)).

---

## 3. Shipped Milestones

- [x] **Alpine Relief & Mountain Elevation**: Scaled average peaks to ~2,000m, timberline (1,600m), and snowcaps (`src/world/maps.ts`, `src/render/terrain.ts`).
- [x] **Dynamic Climatology & Four Seasons**: Full-frustum precipitation, wet surface gloss, winter snow cover, and sky haze (`src/render/precipitation.ts`, `src/render/sky.ts`).
- [x] **Endless Horizon Backdrop & Terrain LOD**: 360° procedural horizon backdrop and mesh simplification beyond city boundaries (`src/render/terrain.ts`).
- [x] **Civic Palette Dressing & Contrast**: High-contrast material tones and accent hues for placeables and utilities (`[R-render-001]`, `[R-render-018]`).
- [x] **European Architectural Articulation**: Terracotta/slate roofs, stone sills, balconies, and calibrated solar shadows (`src/render/buildings.ts`, `src/render/sun.ts`).
- [x] **Municipal Budget & Sector Tax Panel**: Independent 0%–30% sliders, citizen satisfaction feedback, and loan servicing (`src/ui/BudgetPanel.tsx`, `src/sim/fields.ts`).
- [x] **Smooth & Progressive Coastal Terrain Transitions**: Continuous quintic blending between sand, dunes, rock, and vegetation without contour cut lines (`src/render/terrain.ts`).
- [x] **Procedural Map Synthesis**: Deterministic multi-octave terrain generation from seed (river carving, coastal bays, islands, mountain passes) in `src/world/maps.ts`.
- [x] **Warm Minimalist Diorama Art Direction**: Studio hemisphere fill lighting, earth ground bounce, softened shadows, calm cerulean water planes, and calibrated matte materials ([diorama-art-direction.md](specs/diorama-art-direction.md)).
- [x] **Parks & Recreation**: Five true-scale municipal park archetypes with wear degradation ([parks-and-recreation.md](specs/parks-and-recreation.md)).
- [x] **Tramways & Elevated Guideways**: At-grade street tram reservations and elevated Disney-style monorail guideways ([tramways.md](specs/tramways.md)).
- [x] **Transport Depots & Fleet Dispatch**: Vehicle depots, line fleet allocation, and daily operating costs ([transport-depots.md](specs/transport-depots.md)).
- [x] **Architectural Building Details (RCI & Civics)**: Instanced meshes modeled after real US typologies ([building-detail.md](specs/building-detail.md)).
- [x] **Power Generation Ladder**: Solar farms, gas peakers, combined-cycle power plants, and modular reactors ([power-generation.md](specs/power-generation.md)).
- [x] **Education Ladder**: Elementary, middle, high schools, regional college campus, and municipal library ([education-ladder.md](specs/education-ladder.md)).
- [x] **Emergency Services**: Staged fire stations, response radii, and unit dispatch ([emergency-services.md](specs/emergency-services.md)).
- [x] **Healthcare & Death Care**: Outpatient clinics, regional hospitals, cemeteries, hearse fleets, and crematoria ([healthcare-and-death-care.md](specs/healthcare-and-death-care.md)).
- [x] **Garbage & Resource Recovery**: Comprehensive curbside waste chain, recycling depots, MRFs, and transfer stations ([garbage-recovery.md](specs/garbage-recovery.md)).
- [x] **Power Distribution Grid**: High-voltage pylons, substations, and underground medium-voltage cables ([power-distribution.md](specs/power-distribution.md)).
- [x] **Structured Parking Decks**: Multi-story urban parking decks integrated into high-density districts ([structured-parking.md](specs/structured-parking.md)).
- [x] **Street Furniture & Roadside Standards**: Furnishing strip placement rules for lamps, benches, bins, and signs ([street-furniture.md](specs/street-furniture.md)).

---

## 4. Technical Status & Reference Index

**Test suite:** 7,984 tests passing across 235 test files, run 2026-11-11.
(This is the single test count in the documentation set).

| Section | Description |
| --- | --- |
| [1. Current state audit](roadmap/1-current-state-audit-what-exists-today.md) | Audit of existing systems |
| [2. Design pillars](roadmap/2-design-pillars-what-feels-like-a-city-builder-actually-means.md) | City builder feel and genre grammar |
| [3. Architecture decisions](roadmap/3-architecture-decisions.md) | Worker boundary and data layer architecture |
| [4. Interface](roadmap/4-interface.md) | UI surface specifications |
| [5. AI raster asset pipeline](roadmap/5-ai-raster-asset-pipeline.md) | Raster textures and heightmap pipeline |
| [6. Module structure](roadmap/6-module-structure.md) | Module responsibilities and structure |
| [7. Milestones](roadmap/7-milestones-each-ends-playable.md) | Historic playable milestones |
| [8. Performance budgets](roadmap/8-performance-budgets.md) | Frame time and heap allocations |
| [9. Risks & scope guards](roadmap/9-risks--scope-guards.md) | Non-goals and scope guards |

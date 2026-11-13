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

- [ ] **Mountain Height Adjustment & Elevation Relief**:
  - Increase average elevation, prominence, and vertical range of mountain ranges and peaks in procedural generation (`maxPeakAltitude` and alpine masks in `src/world/maps.ts`).
  - Scale highlands so alpine ridges stand out majestically from the default overhead RTS camera.

- [x] **Dynamic Weather & Seasons (Climatology)**:
  - Dynamic atmospheric states (clear, overcast, rain precipitation with surface asphalt sheen, low-lying ground fog).
  - Full four-season cycle: fresh spring, lush summer, golden autumn foliage, and winter snowline descending over hills and tree canopies.
  - Synchronous shifts in ambient sky dome lighting, horizon haze, and shadow softness (`src/render/sky.ts`, `src/render/scene.ts`).

- [x] **Endless Terrain / Continuous Horizon (Backdrop Map)**:
  - Procedural backdrop terrain synthesis extending beyond the 256×256 playable plot boundaries.
  - Eliminate the abrupt map edge: the 360° horizon always displays rolling hills, distant coastal shorelines, and plains instead of an empty void.

- [x] **LOD Optimization for Distant Terrain**:
  - Progressive mesh simplification beyond the playable plot (lower vertex density and coarsened quads as distance from the city increases).
  - Maintain fine sub-tile resolution in the urban core while shedding distant geometry to preserve a locked 60 FPS.

- [x] **Palette & Surface Color Dressing for Placeables and Civics**:
  - Introduce richer contrast, distinct material tones, and accent hues across civic facilities, wind turbines, water towers, warehouses, and industrial plants.
  - Eliminate current monochromatic flatness while adhering to InstancedMesh palette and material standards (`[R-render-001]`, `[R-render-005]`, `[R-render-018]`).

- [ ] **Advanced Building Detailing & Architectural Articulation**:
  - Enrich residential, commercial, and civic structures with high-fidelity architectural details to maximize diorama realism.
  - Implement instanced micro-geometry and facade features: ornamental cornices, cantilevered balconies, external fire escapes, recessed window sills/headers, fabric storefront awnings, detailed rooftop mechanical equipment (chillers, duct banks, cooling towers), and varied parapet trims without violating single-draw `InstancedMesh` performance (`[R-render-001]`, `[R-render-005]`, `[R-render-013]`).

---

## 2. Open Backlog & Technical Debt (TODO)

- [ ] **Municipal Budget & Tax Panel**:
  - DOM panel and store actions for sector tax sliders (0%–30%) and loan drawdown/repayment controls up to ¢100,000.
- [ ] **UI Modernization & Aesthetic Redesign**:
  - Visual overhaul of panel chrome, HUD layout, typography, iconography, and micro-interactions ([ux/](ux/README.md), [ui-style-guide.md](art/ui-style-guide.md)).
- [ ] **Visual Defects Punchlist**:
  - Triage and resolution of logged screenshot audit defects ([open-visual-defects.md](roadmap/open-visual-defects.md)).
- [ ] **Junction Turn Radii & Curve Transitions**:
  - Class-based minimum turn radius enforcement on bends and transitions (`[R-roads-081]`).
- [ ] **Heavy Industrial Lot Depths**:
  - Deepen 4×3 heavy industrial lots to fit 16m semi-truck trailer courts ([specs/lots-and-land.md](specs/lots-and-land.md)).
- [ ] **Bus Stops on Free-Form Road Curves**:
  - Support bus shelters on non-grid curve segments reusing the lamp pole projection frame.
- [ ] **Metropolis Triangle Budget Optimization**:
  - Triangle reduction across merged road/lot meshes and dense wild tree stands ([performance-budget.md](engineering/performance-budget.md#the-main-thread-while-a-city-grows)).
- [ ] **Furniture & Service Line Polish**:
  - Clean detachment of orphaned power line segments ([power-distribution.md](specs/power-distribution.md)).
  - Clearance fixes for structured parking stalls ([structured-parking.md](specs/structured-parking.md)).
  - Utility pole alignment inside the furnishing strip ([street-furniture.md](specs/street-furniture.md)).

---

## 3. Shipped Milestones

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

# Diorama art direction

- **Status:** Built

**Owns:** The warm minimalist diorama aesthetic: ambient hemisphere bounce, warm sky haze, calibrated matte palette, procedural facade vector joints, construction staging (cranes, scaffolding), elevator penthouses, and cerulean diorama water.

**Rules:**

- Every placeable retains `InstancedMesh` with stock materials, vertex colour, and instance colour `[R-render-001]`, `[R-render-005]`, `[R-render-006]`.
- All world surface materials maintain matte roughness between 0.85 and 0.95 and low metalness `[R-render-007]`.
- Water uses cerulean tones (`#7FA9C9`, `#5E8DB3`), cubic Fresnel, and widely spaced trochoidal ripples without blooming emissive `[R-render-005]`, `[R-render-019]`.
- Procedural facades render vector joints (precast panels, brick bond, standing seams, form ties) in-shader without textures `[R-render-005]`.
- Multi-storey flat roofs carry an instanced elevator penthouse core breaking the silhouette `[R-render-001]`, `[R-render-013]`.
- Constructing buildings carry an instanced yellow tower crane and green scaffolding safety net `[R-render-001]`, `[R-render-008]`.

**Numbers:**

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| `HEMI_GROUND_BOUNCE` | `[0.725, 0.663, 0.549]` | RGB 0..1 | Studio diorama reference (`#B9A98C`) |
| `SUN_DAY_KEY` | `[1.0, 0.945, 0.863]` | RGB 0..1 | Studio diorama key light (`#FFF1DC`) |
| `SHALLOW_WATER_COLOR` | `[0.498, 0.663, 0.788]` | RGB 0..1 | Clean cerulean diorama water (`#7FA9C9`) |
| `DEEP_WATER_COLOR` | `[0.369, 0.553, 0.702]` | RGB 0..1 | Deep cerulean architectural wash (`#5E8DB3`) |
| `TOWER_CRANE_JIB_L` | 16.0 | metres | Standard construction crane boom |
| `PENTHOUSE_SIZE` | 3.5, 2.8, 2.4 | metres | Elevator & stair bulkhead (w, d, h) |
| `CONCRETE_PANEL_W_H` | 1.5, 1.0 | metres | Precast facade panel standard |

**Code:**
`src/render/scene.ts` `DAY_KEYFRAME` — daytime lighting and hemisphere ground bounce.
`src/render/water.ts` `WaterRenderer` — cerulean diorama water with 4-octave ripples and cubic Fresnel.
`src/render/construction.ts` `ConstructionRenderer` — instanced tower cranes and scaffolding curtains.
`src/render/props.ts` `RoofPropRenderer` — elevator penthouse core, AC units, and antennas.
`src/render/buildings.ts` `createMaterial` — procedural facade joints, form-ties, and brick courses.

**Tests:**
`src/render/geometrybudget.test.ts` — triangle budgets across instanced meshes.

**Open:** none

## Why the rules are what they are

### Studio diorama lighting
Realistic sunlight with black ambient ground creates stark, high-contrast shadows that read harsh and industrial from high camera elevations. A warm hemisphere ground bounce lifts shadows with earth-tinted fill light, giving the city the look of a physical architectural model. Softening shadow intensity from 1.0 to 0.60 prevents dark voids beneath trees and overpasses while retaining directional clarity.

### Matte palette and material finish
Glossy specular highlights give procedural geometry a toy plastic appearance. Setting material roughness to 0.90 with near-zero metalness diffuses specular highlights across polygons, creating a tactile papercraft or chalk finish. Surface colors are desaturated to maintain lighting headroom under midday sun and bloom.

### Toy-kit vehicle and building silhouettes
Detailed micro-geometry creates visual clutter at orbital camera distances. Merged multi-part meshes with chamfered corners, single-piece window glass, and cylindrical wheels provide crisp, legible silhouettes while staying within triangle budgets.

## Decided

- Warm hemisphere bounce chosen over ambient occlusion passes to preserve 60 fps on mobile GPUs without extra post-processing cost.
- Desaturated matte vertex colours chosen over image textures to preserve zero-download instant loading and InstancedMesh compatibility.

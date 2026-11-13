# Terrain specification

How the ground is built, levelled and closed off at the edge of the world.

Everything here is deterministic — seeded from map data or tile coordinates,
never `Math.random` — so the same map always looks the same.

## Levelling under structures

Placing a road or a building levels its own footprint — plus a 1-tile apron
around a road — to the mean height of the tiles it covers, so the new structure
sits flat instead of a terrain "diamond" poking up through it. A building the
sim grows is placed as surely as one the player plops, and levels its ground
the same way when it spawns and when it levels up; growth is not a command,
so there is nothing to undo.

A map cell holds one height, and a rendered terrain corner is the mean of
the four cells meeting there (`cornerHeight` in `src/render/terrain.ts`), so
every corner of a tile is shared with its neighbours and the ground inside a
tile is one plane only when the cells around it agree. The levelling takes
the apron's cells too where open ground owns them — so the whole surface
under the footprint is one plane — and leaves alone any that a road, another
building or water owns, since moving it would tilt the road, unseat the
neighbour or move the shoreline.

**A road's ground carries on past its end.** A wide road's turning head —
the rounded cap and the footway that wraps it, up to the class's kerb return
past the carriageway's end — stands over the apron tile beyond a dead end,
whose far corners average cells the apron never touched. Cut into a
hillside, that ground rose over the cap's uphill corner. So the levelling
runs out two tiles past a dead end: each run-out cell takes the height of
the end tile or side-apron cell it lies behind, raised or lowered to it,
held at or below the end tile and any road it borders, and never a cell a
road, a building or water owns. The cap then stands on a level shelf with
the terrace edge behind it. A narrow road's head never leaves its tile, and
the run-out is harmless there.

**A drag is solved one run at a time.** The grade solver that lifts a road
onto decks where the ground steps more than it may climb reads a drag as
contiguous runs; a command that carries two runs — the two halves of a
corridor, which the road tool lays as one command for this reason — solves
each on its own ground, and the halves take the higher of their two lifts at
each station, so both are on the ground or both on decks and neither's
corners average the other's unlevelled cells. The body is
then seated on the highest
ground under the body itself ([buildings.md](../art/buildings/lots-and-paved-ground.md)),
never under the whole footprint, so a street climbing past the lot does not
lift the house off the pad it stands on.

Because a rendered terrain corner is shared by the two chunks that meet there,
dirtying one tile always dirties its neighbours' chunks too: rebuild only the
edited chunk and the shared edge would show the old height on one side and the
new one on the other — a crack that shows the water plane straight through the
ground.

## The map edge and endless horizon

Beyond the 256×256 playable city parcel, the world does not end abruptly in an
empty void. A continuous 360-degree backdrop landscape extends outward to a
16,000 m horizon radius (`BACKDROP_REACH_METERS`), providing an expansive 37.1 km
panoramic view of rolling hills, mountain ridges, and coastal horizons:

- **Continuous procedural world generation & meandering river continuation**:
  The macro world generation is identical and continuous across the entire map and horizon:
  `createProceduralWorldEvaluator` exactly evaluates the mathematical terrain formula for any
  world coordinate $(x, z)$. Valleys, meandering riverbeds, ocean basins, and flanking mountain
  ranges flow naturally and seamlessly across the boundary:
  - Meandering rivers bend and twist continuously outside the city parcel instead of projecting
    as straight canals. Real water (`WaterRenderer.outerMesh`) fills the riverbed between natural banks.
  - Boundary stitching blends out any local terraforming or road grading deltas across 250 m with
    quintic Hermite decay, guaranteeing zero seam cracks at Ring 0 and smooth convergence to the wild landscape.
- **Isotropic 68-ring concentric mesh & non-shearing 8-sector layout**:
  Sixty-eight concentric radial loops (`BACKDROP_RING_RADII`: 0 m, 10 m, 20 m, 32 m, 46 m,
  62 m, 80 m, 100 m, 122 m, 146 m, 172 m, 200 m, 230 m, 262 m, 296 m, 332 m, 370 m,
  410 m, 452 m, 496 m, 542 m, 590 m, 640 m, 692 m, 746 m, 802 m, 860 m, 920 m, 982 m,
  1,050 m, 1,125 m, 1,205 m, 1,290 m, 1,380 m, 1,475 m, 1,575 m, 1,680 m, 1,790 m,
  1,910 m, 2,040 m, 2,180 m, 2,330 m, 2,490 m, 2,660 m, 2,840 m, 3,030 m, 3,230 m,
  3,450 m, 3,690 m, 3,950 m, 4,230 m, 4,530 m, 4,860 m, 5,220 m, 5,610 m, 6,030 m,
  6,490 m, 6,990 m, 7,540 m, 8,150 m, 8,820 m, 9,560 m, 10,380 m, 11,300 m, 12,340 m,
  13,520 m, 14,700 m, 16,000 m).
  Radial steps grow continuously and smoothly from 10 m up close, keeping polygon aspect
  ratios isotropic ($< 2.5:1$ in visible range) and completely eliminating needle-thin quads.
- **Multiscale Nyquist anti-aliasing (zero texture stretching)**: Rather than sampling micro-noise
  on distant quads, detail is decomposed into spatial frequency tiers (`backdropDetailLevels`):
  - Micro-grain (2.8 m sand pebbles, 2.8 m rock crag, 4 m lawn micro) is 100% full detail up close
    (dist $\le$ 80 m) and smoothly diffuses by 350 m before quad spacing exceeds its Nyquist wavelength.
  - Mid-frequency features (10 m patches, 18 m rock crags, 24 m dry patches) remain active out to 1,600 m.
  - Macro-frequency variation (30 m dunes, 96 m grass hues) diffuses between 3,000 m and 8,500 m.
  Gouraud vertex interpolation across triangles never stretches or streaks towards the horizon.
- **Deep 3D foliage & procedural woodland clusters (1,600 m)**: Boundary forests continue
  into a 1,600 m (80 tiles) backdrop tree buffer (`TreeRenderer.planPlacements`).
  Foliage follows the continuous procedural tree evaluator across the countryside, preserving
  edge density near the boundary and forming natural 2D groves along riverbanks and slopes.
- **Analytical surface normal stitching**: Chunk boundary vertices and Ring 0 backdrop
  vertices overwrite their geometric normals with exact central-difference surface
  normals (`surfaceNormalAt`), guaranteeing bit-for-bit normal equality across the seam.
  This eliminates all directional lighting creases and shadow boundaries under sunlight.
- **Procedural macro landscape & ocean extension**: Outside the city, terrain blends
  smoothly across an 800 m transition band (`BACKDROP_BLEND_METERS`) into deterministic
  macro simplex hills and ridged mountain peaks. Submerged parcel edges sustain open
  ocean basins that seamlessly align with the concentric outer water plane (`WaterRenderer.outerMesh`).
- **Horizon elevation tapering**: At extreme distances (>8,000 m), mountain
  elevations gently taper toward sea level into smooth coastal plains and ocean,
  eliminating floating cross-section edges on the distant horizon.
- **Dynamic climatology & progressive aerial perspective**: The backdrop mesh shares the
  primary `MeshStandardNodeMaterial`, responding in real time to dynamic weather.
  Fog color matches the sky horizon color (`skyHorizonColor`) exactly, and fog
  parameters ramp smoothly over a broad 11 km span (e.g. 3,300 m to 14,300 m in clear
  weather), creating a soft, progressive aerial haze that dissolves seamlessly into
  the sky dome with zero hard cutoffs.
- **Perimeter skirt fallback**: The legacy vertical quad strip skirt (−18 m)
  remains built as a dormant fallback (`visible = false`), preserving backwards
  compatibility with edge terraforming rebuild triggers.

## Materials

The terrain carries no textures. The grass, dirt and rock reads are all
per-vertex colour baked at chunk build time — see
[vegetation.md](vegetation.md) for the ground-cover variation and
[shaders.md](shaders.md) for why there is no shader doing this.

The rules governing what the terrain _is_ — height, sea level, terraforming and
buildability — are simulation, not rendering; see
[../world-sim/world-model.md](../world-sim/world-model.md).

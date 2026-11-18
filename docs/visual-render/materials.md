# Material specification

What every surface in the world is made of, and the rules a new material must
follow to sit alongside the existing ones.

## Everything is a stock three.js material

There are no custom shaders — no `ShaderMaterial`, no GLSL, no
`onBeforeCompile` anywhere in `src/`. Every surface uses a standard three.js
material, and the variety in the world comes from three things layered on top
of it:

- **Per-vertex colour**, which does most of the work. Terrain, ground cover,
  the map-edge strata, road paint and building facades are all vertex-coloured
  at build time rather than textured. See [terrain.md](terrain.md) and
  [vegetation.md](vegetation.md).
- **Per-instance colour**, which is how one archetype's geometry produces a
  street of buildings that are not identical. See
  [../art/buildings/README.md](../art/buildings/README.md).
- **Emissive**, driven by the day/night ramp — the one material property that
  changes at runtime on almost everything. See [lighting.md](lighting.md).

The consequence worth stating: a material's appearance is decided by the
geometry that carries it, not by the material itself. Two buildings sharing a
material differ because their vertex and instance colours differ. This is what
lets the whole city draw in a handful of batches — see
[rendering-architecture.md](rendering-architecture.md).

## The rules a material must follow

- **Share, do not multiply.** A new material means a new draw batch. Reach for
  vertex or instance colour on an existing material before creating one.
- **Respond to the ramp.** Every material the sun lights must read correctly at
  every hour, not just at noon. A material tuned only in daylight will look
  wrong for half of every game day.
- **Emissive means "lit from within".** It is reserved for surfaces that are
  actually a light source — windows at night, lamp luminaires, vehicle lights —
  because the bloom pass picks up everything emissive and a stray emissive
  surface glows for no reason.
- **No transparency without a reason.** Sorting transparent surfaces costs
  more than the effect is usually worth. Water is the deliberate exception.

## Palette

Colour values are calibrated per family rather than chosen per asset — the
figures live with the assets that use them, in
[../art/texture-standards.md](../art/texture-standards.md) and the individual
art documents. The DOM overlay has its own separate palette, owned by
`src/ui/styles.css` and documented in
[../art/ui-style-guide.md](../art/ui-style-guide.md); the two are deliberately
independent, since one is lit by a simulated sun and the other is not.

## Architectural bevels and window reflections

To avoid the sharp, computer-generated appearance of harsh 90° box geometry without exploding polygon counts, building bodies and kit parts share chamfered unit geometries ([R-render-041]):

- **Edge beveling**: `buildBeveledBoxGeometry` in `src/render/beveledbox.ts` constructs unit boxes with 45° chamfered edge bevels and corner facets (44 triangles total). Outward-facing chamfer normals catch directional sun glints and sky specular highlights along building silhouettes and roof eaves.
- **Glass specular roughness & metalness**: Active facade windows modulate PBR material nodes (`isGlazingActive`), dropping roughness to 0.10 (versus 0.85 on matte concrete/masonry walls) and increasing metalness to 0.18 (versus 0.04 on walls).
- **Cubic Fresnel sky reflections**: Window glazing evaluates view incidence angle via view-transformed normals and camera view direction: grazing viewing angles softly reflect the sky dome horizon tone via a cubic Fresnel curve (`(1 - cosView)^3`), providing high visual fidelity.

## Terrain PBR materials and procedural micro-relief

Terrain rendering employs procedural WebGPU TSL PBR nodes on `MeshStandardNodeMaterial` ([R-render-042]):

- **Procedural surface normal perturbation**: `material.normalNode` applies high-frequency trigonometric normal perturbations in view space (`transformNormalToView(shadingNormalLocal)`), resolving rock cliff fissures and grass turf micro-facets under directional sunlight.
- **Physical biome roughness & metalness**: Decoupled PBR parameters assign crystalline rock 0.55 roughness (dropping to 0.20 when wet for sharp specular gleams), beach sand 0.75, lush grass 0.82 (dropping to 0.30 in rain puddles), and snow 0.88 matte.
- **Multi-layer geological strata**: Horizontal sedimentary rock striations on slopes combine dark volcanic slate, mountain granite, limestone, and iron-oxide mineral veins.

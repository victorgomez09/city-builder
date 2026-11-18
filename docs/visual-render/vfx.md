# VFX specification

Smoke, fire, dust, weather and other transient visual effects: what they look
like, what triggers them, and what they cost.

## There is no particle system

`src/` contains no particle emitter, no sprite pool, and no transient-effect
system of any kind. Nothing in the world puffs, sparks or burns.

Several things a player might expect to produce an effect currently do not:

- An **incinerator** consumes rubbish without a plume.
- A **fire risk** field exists and feeds land value and desirability, but no
  building ever visibly catches fire — the field is a statistical pressure, not
  an event. See [../world-sim/environmental-simulation.md](../world-sim/environmental-simulation.md).
- **Construction** is shown by swapping the building's own geometry through
  construction states, not by dust or scaffolding effects. See
  [../art/buildings/README.md](../art/buildings/README.md).

## Precipitation and weather interaction

Precipitation and surface weather effects are rendered without runtime particle systems or GC allocations:

- **Instanced precipitation**: rain streaks (4096 instances) and drifting snowflakes (3200 instances) use GPU-friendly `InstancedMesh` volumes centered on the camera focus point (`src/render/precipitation.ts`). Instances wrap within a bounding volume with zero per-frame buffer allocations `[R-render-001]`, `[R-render-011]`.
- **PBR wetness and puddle gloss**: precipitation accumulates a global `wetness` scalar, dropping road and roof material roughness (0.82 dry -> 0.18 wet) while increasing specular reflectivity (0.05 -> 0.22 metalness) to reflect sun glints and sky light like glistening wet asphalt `[R-render-039]`.
- **Snow drift accumulation**: freezing winter conditions accumulate `snowCover`, dusting roads, roofs, and terrain with high-albedo matte frost (roughness 0.95), softening surface specular highlights `[R-render-039]`.

## Deliberately not built

The first effect that needs to appear and disappear on its own. The design
questions that will need answering then, none of which are settled today:

- Pooling and instancing, since the renderer allocates nothing per frame and an
  effect system is the obvious way to break that. See
  [../engineering/performance-budget.md](../engineering/performance-budget.md).
- Whether an effect is simulation state (and therefore must be deterministic
  and may need saving) or purely cosmetic (and therefore may use the render
  thread's own RNG and is never saved). The same split already governs
  vehicles — see [../world-sim/agent-behavior.md](../world-sim/agent-behavior.md).
- How an effect reads under the day/night ramp, which every other material
  follows automatically. See [lighting.md](lighting.md).

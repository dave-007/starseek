# StarSeek — Technical Architecture

## Stack

| Layer | Tool |
|-------|------|
| Language | TypeScript (ES modules) |
| 3D | Three.js |
| Build | Vite |
| Deploy | Vercel (auto-deploy from `main`) |

---

## Source Files

### `src/main.ts` (~1200 lines)
The single orchestrator. Owns:
- Scene, camera, renderer setup
- **State machine**: `'galaxy' | 'zooming-in' | 'solar-system' | 'zooming-out' | 'planet'`
- All UI elements (created imperatively as DOM nodes)
- Input handlers (mousedown/move/up, wheel, pointer)
- Galaxy camera controls (spherical coords, inertia)
- Solar system camera controls (spherical coords, scroll zoom)
- Planet drag-paint + spin with inertia
- Phenomena panel state for both galaxy and solar system layers
- Random Oddness timer (`tickRandomOddness`)
- Hover zoom + story fragments for galaxy systems

### `src/hexsphere.ts`
Builds the geodesic hex sphere used for both the galaxy surface decoration and planet surfaces.
- `buildHexSphere(subdivisions, radius, color)` → `THREE.Group`
- `buildSurfaceMesh(subdivisions, radius)` → `SurfaceMesh` (paintable)
- `SurfaceMesh` includes `cellCentroids: THREE.Vector3[]` for raycasting

### `src/solarsystem.ts`
Procedural solar system from a seed.
- `SolarSystem(audioSeed, color, pulseSpeed)` — star + planets + asteroid belts
- `planetInfos: PlanetInfo[]` — position, `baseColor`, `tempNorm` (0=cold, 1=hot), `isGoldilocks`, `mesh`
- 1–3 InstancedMesh asteroid belts; belt types: rocky/icy/metallic
- Orbit speed slows on hover (`orbitMul = 0.15` when hovered)

### `src/planetview.ts`
Paintable planet surface with elemental attunement gameplay.
- `PlanetView(seed, color, tempNorm)` — creates geodesic hex surface
- **Elements**: fire, water, earth, air — each spreads at different rates
- **Resonance zones**: 4–6 BFS-grown blobs requiring a specific element; shown as faint hints
- **Thermal pressure**: hot worlds (tempNorm > 0.65) drain non-fire cells; frozen worlds (< 0.35) extinguish fire
- **Win condition**: litFraction ≥ 0.72 AND zoneAttunement ≥ 0.68
- **Lose condition**: frontier empty, litFraction < 0.22, timePlaying > 5s
- Static `PlanetView.randomEonTale()` — atmospheric failure narrative

### `src/audio.ts`
Procedural ambient music, one loop per solar system.
- `unlockAudio()` — must be called on first user interaction
- `SystemLoop(seed)` — seeded generative music loop with drone, reverb, scales
- `loop.setVolume(vol)` — used for hover volume swell

### `src/phenomena.ts`
All toggleable animations, solar-system and galaxy layers.

**Solar system phenomena** (`PhenomenonKey`):
`radio` | `ufo` | `comet` | `lights` | `formation` | `anomaly`

**Galaxy phenomena** (`GalaxyPhenomenonKey`):
`nebulae` | `signalweb` | `streams` | `wormhole` | `pulsars` | `void` | `messier` | `randomoddness`

Each phenomenon is `{ group: THREE.Group, update(dt, planets?), dispose() }`.

---

## Phenomenon Pattern

To add a new phenomenon:

1. Add its key to the `PhenomenonKey` or `GalaxyPhenomenonKey` union type.
2. Write a `createXxx(seed, ...): Phenomenon | GalaxyPhenomenon` factory.
3. Add to `PHENOMENON_DEFS` or `GALAXY_PHENOMENON_DEFS` array in `main.ts`.
4. Add a `case` in `spawnPhenomenon()` or `spawnGalaxyPhenomenon()`.

**Rules:**
- Solar system phenomena: `scene.add(inst.group)` and `scene.remove` on teardown. Their `update(dt, planets)` receives `planetInfos` for attaching effects to planets.
- Galaxy phenomena: also added directly to `scene` (not `galaxyGroup`) — galaxyGroup rotates but phenomena should be world-stable.
- Always call `dispose()` on geometry/material in `dispose()`.

---

## State Transitions

```
galaxy
  ├─ click system ──→ zooming-in ──→ solar-system
  │                                       ├─ scroll out ──→ goBack() ──→ galaxy
  │                                       └─ click planet ──→ planet
  └─ hover ──────── zoom toward, play music, show story
```

`goBack()` handles solar-system → galaxy.
`exitPlanet()` handles planet → solar-system.

---

## Camera Systems

### Galaxy camera
Spherical: `(theta, phi, dist=3)` on `galaxyGroup`.
Inertia: `velX/velY` decay 0.93/frame. Hover zoom lerps toward dist=2.0.

### Solar system camera
Spherical: `(theta, phi, dist)` — dist range 3–28, target smoothed with factor 0.1.
Scroll past max → `goBack()`. Zoom-out prompt fades in near max.

### Planet camera
Fixed at z=2.4. Planet group spins (drag with inertia). Paint mode vs spin mode toggled by whether an element is selected.

---

## Known Constraints / Gotchas

- **Hex literals**: Never use non-hex characters in `0x...` literals (past bug: `0xm01e`, `0xuf0`). Always verify.
- **Edit tool uniqueness**: When using Edit to patch a file, the `old_string` must be unique. Use more surrounding context if needed.
- `galaxyGroup` rotates — don't attach world-stable phenomena to it; attach to `scene` directly.
- `nearestCell()` uses `worldToLocal()` — this correctly handles planet rotation during painting.
- InstancedMesh asteroid data stored in per-belt `Float32Array` fields; update via `_beltDummy` Object3D.
- Audio context must be unlocked on first user interaction (`unlockAudio()` on mousedown).

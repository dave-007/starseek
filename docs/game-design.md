# StarSeek — Game Design Document

## Vision

StarSeek is a game of elemental attunement and galactic exploration. The galaxy is not an opponent — it is a living, ambient intelligence that responds to the player's way of being. Every solar system is a fresh canvas shaped by the player's accumulated elemental choices.

The tone is: quiet discovery, not conquest. The universe whispers. You listen.

---

## Core Loop

1. **Galaxy layer** — navigate a hex-tiled sphere of 9 solar systems
2. **Hover** — system reveals a story fragment; camera zooms gently; music swells
3. **Enter** — zoom into solar system; explore star, planets, moons, asteroid belts
4. **Choose a planet** — zoom to planet surface
5. **Seed event** — choose a cataclysmic starting event (meteor, volcano, ice age…)
6. **Attune** — paint elemental zones; fight the world's natural thermal pressure
7. **Win** — life emerges (green wave animation); planet is attuned
8. **Hop** — build power to reach nearby systems; repeat with accumulated affinity

---

## Elemental System

Four elements. Each has distinct gameplay feel:

| Element | Spread Rate | Character |
|---------|-------------|-----------|
| Fire | 3.2 (fast) | Aggressive, dominant on hot worlds, resists water |
| Air | 1.8 (medium) | Adaptive, low harmony with earth |
| Water | 0.75 (slow) | Stable, suppressed on hot worlds, patient |
| Earth | 0.5 (slowest) | Grounded, provides solid base for other elements |

**Harmony matrix**: each element spreads better into compatible neighbours (e.g. water resists fire, earth and water are friends).

**Resonance zones**: 4–6 BFS-grown blobs per planet, each wanting a specific element. Shown as faint colour hints. Correct zone fill = 1.25× brightness; wrong = 0.85×.

---

## World Types

### Temperate worlds (tempNorm 0.35–0.65)
Balanced. Elements compete fairly. Good for learning the system.

### Hot worlds (tempNorm > 0.65)
Fire dominates. Non-fire cells slowly drain back (thermal pressure scales with tempNorm).
- Strategy: burst-paint, work quickly, use earth as a buffer between fire zones and water zones
- Visual hint in event picker: 🔥 *hot world — fire resists all other elements*

### Frozen worlds (tempNorm < 0.35)
Cold extinguishes fire passively. Ice and water creep.
- Strategy: small, well-supported fire pockets; surround with earth and air to insulate
- Visual hint: ❄ *frozen world — fire fades quickly in the cold*

### Goldilocks worlds (tempNorm 0.40–0.60)
The "alive" band. These are the prize worlds — once attuned, life emerges more vibrantly.

---

## Attunement System

Win condition: `litFraction ≥ 0.72 AND zoneAttunement ≥ 0.68`

- **litFraction**: fraction of all cells with phase > 0.5
- **zoneAttunement**: average zone score (fraction of each zone's cells painted with the correct element)

Lose condition: frontier empty, litFraction < 0.22, timePlaying > 5s (planet dies before coverage)

**Life emergence animation**: on win, a green wave sweeps from pole to pole — the signature of life taking root.

**Failed attunement narrative**: when lost, an eon-passing tale is shown before "click to try again". The story conveys geological time — comets, ice ages, volcanic rebirths. Reseeding is a new cataclysmic event.

---

## Seeding Events

Events set the starting element and number of seed cells. They also flash the surface with a distinctive colour.

| Event | Seeds | Element | Feel |
|-------|-------|---------|------|
| Meteor Strike | 4 | fire | scattered, fast start |
| Solar Storm | 1 | fire | single burning spot |
| Volcano | 2 | earth | slow, grounded |
| Tidal Wave | 3 | water | gentle, spreading |
| Ice Age | 1 | air | sparse, cold |
| Lightning Storm | 6 | air | many sparks |

---

## Galaxy Phenomena (toggleable, star layer)

| Key | Description |
|-----|-------------|
| Nebulae | 5 slowly rotating coloured cloud puffs |
| Signal Web | glowing edges between nearby systems + sliding pulse nodes |
| Star Streams | 400-point spiral arm particles drifting |
| Wormhole | 5 counter-rotating rings at a fixed galaxy position |
| Pulsars | sharp spike-pulse beacons at 3 random systems |
| Void | dark sphere drifting slowly across the scene |
| Deep-Sky Objects | M1, M42, M57, M31, M13, M51 with labels |
| Random Oddness | master timer that randomly toggles other phenomena (6–18s intervals) |

---

## Solar System Phenomena (toggleable, system layer)

| Key | Description |
|-----|-------------|
| Radio | expanding ring pulses from Goldilocks planets |
| UFO | saucer with orbiting/hovering/darting behaviour |
| Comet | bezier-path comet with 80-point particle trail |
| City Lights | night-side point lights on planets with atmospheres |
| Formation | geometric formation of probe-like objects |
| Anomaly | drifting wireframe polyhedron that pulses |

---

## Navigation

- **Galaxy**: drag to rotate; hover to zoom and hear music; click to enter
- **Solar system**: drag to orbit; scroll to zoom (3–28); scroll past max to return to galaxy; click planet to enter
- **Planet**: no element selected = spin the world; element selected = paint mode (drag to paint)

---

## Music

Seeded generative ambient music per solar system:
- Randomly selects from 8 scales (pentatonic minor, whole tone, hirajoshi, lydian, etc.)
- Drone frequency at base note (55% chance)
- Reverb wet/dry per system
- Volume swells on galaxy hover, fades when moving away

---

## Planned / Future

- [ ] Power system: resource accumulation before system hop
- [ ] Elemental affinity tracking across sessions (accumulated way of being)
- [ ] Multiplayer layer (single-player first)
- [ ] More world types: gas giant, ocean world, dead rock, binary system worlds
- [ ] Moon attunement (secondary puzzles around major planets)
- [ ] Galaxy evolution: attuned systems change the appearance of nearby systems

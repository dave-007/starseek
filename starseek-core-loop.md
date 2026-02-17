# StarSeek — Revised Core Loop

Version: 0.2 — Life Emergence Update
Last updated: 2026-02-16

## Overview

The core loop has been expanded from 7 to 9 stages. The original step 6 ("Build power to hop") has been split to accommodate a major new phase: **Life Emergence**. After a planet is attuned and elemental identity is expressed, life takes root. What follows is an entire evolutionary arc — life trees competing and cooperating, a Great Filter funnel, and (if life survives) the dawn of solar system exploration.

This is the heart of StarSeek's mid-game. It transforms each planet from a resource node into a living story.

---

## The Revised Core Loop

| Stage | Name | Summary |
|-------|------|---------|
| 1 | **Arrive** | Reach a solar system (a point on the galactic sphere) |
| 2 | **Survey** | Zoom in to solar system level — discover planets, moons, asteroids |
| 3 | **Descend** | Zoom in to planet/object level — from sun down to asteroid |
| 4 | **Develop** | Harvest resources, discover hidden resources, express elemental way of being |
| 5 | **Attune** | The galaxy responds to your choices, revealing and concealing |
| 6 | **Life Emergence** | *NEW* — Life takes root on attuned planets; life trees grow, harmonize, and compete |
| 7 | **The Funnel** | *NEW* — Dominant life faces existential filter; survive or collapse |
| 8 | **Expand** | Survivors approach utopic status, begin developing solar system resources |
| 9 | **Seek & Hop** | Build power sufficient to leap to a nearby solar system; repeat |

---

## Stage 6: Life Emergence (Detail Summary)

Once a planet is attuned, its elemental signature seeds the conditions for life. Life does not arrive as a single species — it blooms as **Life Trees**, each a branching evolutionary lineage with its own logic, strengths, and vulnerabilities.

### Life Trees

Each life tree represents a fundamental biological paradigm. A planet's elemental attunement influences which trees are seeded and how they express:

| Life Tree | Character | Elemental Affinity |
|-----------|-----------|-------------------|
| **Mycelium** | Network intelligence, resource distribution, underground connectivity | Earth / Water |
| **Flora** | Photosynthetic builders, atmospheric shapers, patient growth | Water / Air |
| **Mammalian** | Social intelligence, tool use, emotional bonding, adaptability | Fire / Earth |
| **Reptilian** | Endurance, territorial dominance, cold calculation, deep time survival | Fire / Earth |
| **Crystalline** | Mineral consciousness, resonance communication, geological timescale thought | Earth / Air |
| **Fungal-Insectoid** | Hive intelligence, rapid reproduction, biomechanical symbiosis | Water / Fire |
| **Cetacean-Aquatic** | Sonic intelligence, oceanic civilization, deep empathy, fluid social structures | Water / Air |
| **Avian-Aerial** | Migration intelligence, atmospheric mastery, song-based culture | Air / Fire |

Additional exotic trees may emerge on planets with unusual attunement combinations (e.g., **Plasma Entities** on fire-dominant worlds, **Silicon Dreamers** on crystalline-heavy moons).

### Harmonization & Antagonism

Life trees interact along a spectrum:

- **Deep Harmony** — Two trees co-evolve, becoming stronger together (e.g., Mycelium + Flora create living planetary infrastructure)
- **Neutral Coexistence** — Trees occupy different niches without significant interaction
- **Competitive Tension** — Trees compete for the same resources; one must adapt or decline
- **Antagonism** — Active conflict; one tree's growth directly harms another

**Key principle:** Life trees that harmonize broadly and antagonize only in self-defense are most likely to reach dominance. Pure aggressors burn bright but destabilize their own ecosystems.

### Relics & Discoverable Items

Scattered across each planet (and hidden in moons, asteroids, and orbital debris) are **Relics** — artifacts of unknown origin that grant leaps in development:

- **Tech Relics** — Grant technological breakthroughs (propulsion, energy, materials)
- **Wisdom Relics** — Grant understanding leaps (diplomacy, ecology, self-awareness)
- **Attunement Relics** — Deepen connection to the galaxy's ambient intelligence
- **Hybrid Relics** — Rare; combine tech and wisdom in unexpected ways

Relics are revealed through exploration, attunement depth, and sometimes through the harmonization patterns of life trees themselves. A mycelium network might "sense" a buried relic. A crystalline civilization might resonate with one embedded in bedrock.

### The Scrolling Narrative

Throughout the Life Emergence phase, a **narrative scroll** moves along a random edge of the screen — one paragraph at a time. This is the planet's story being written in real time:

- Prose style: mythic, poetic, observational — like a cosmic naturalist's journal
- Placement: randomly selected screen edge (top, bottom, left, right), drifting slowly
- Pacing: one paragraph per significant game event or time interval
- Tone shifts: hopeful during harmony, ominous during antagonism, elegiac during collapse

The narrative is procedurally generated from game state but shaped by the planet's elemental character.

---

## Stage 7: The Funnel (Detail Summary)

When a dominant life tree (or coalition of harmonized trees) reaches a critical development threshold, the planet enters **The Funnel** — a convergence point where civilization-level choices determine survival or collapse.

### Funnel Triggers
- Population/complexity crosses a threshold
- Resource extraction begins to outpace planetary regeneration
- Life trees develop technology that can alter planetary systems

### Funnel Outcomes
- **Collapse** — Antagonistic species destroy each other or render the planet uninhabitable. The planet remains in the solar system but is scarred; future visitors may find ruins and relics.
- **Scarred Survival** — Life survives but is diminished. Development continues at reduced capacity. Some paths to solar system expansion remain.
- **Transcendence** — Harmonized life passes through the funnel intact. Utopic potential unlocked. Full solar system development and eventual Seek & Hop capability.

### Player Influence
The player's attunement choices in stages 4–5 ripple forward into life emergence. A player who attuned with patience and harmony seeds conditions for transcendence. A player who attuned aggressively may find their planet's life more volatile — exciting but dangerous.

---

## Stage 8: Expand (Detail Summary)

Post-funnel civilizations that survive begin developing the broader solar system:

- Establish presence on moons, asteroids, and neighboring planets
- Harvest resources that were inaccessible at the planetary level
- Discover solar-system-scale relics (ancient orbital structures, deep-space artifacts)
- Build the energy and attunement necessary to power a Seek & Hop to the next star

---

## File Structure for Stage Details

Each stage should have its own detailed design document:

```
docs/
├── core-loop-overview.md          ← this file (renamed)
├── stages/
│   ├── 01-arrive.md
│   ├── 02-survey.md
│   ├── 03-descend.md
│   ├── 04-develop.md
│   ├── 05-attune.md
│   ├── 06-life-emergence.md
│   ├── 07-the-funnel.md
│   ├── 08-expand.md
│   └── 09-seek-and-hop.md
```

---

## Design Principles for the New Stages

1. **Life is not a resource — it's a co-creator.** The player doesn't "manage" life trees. They create conditions; life responds.
2. **The Funnel is not a boss fight.** It's a consequence. The player's earlier choices echo here.
3. **Relics reward curiosity, not grinding.** Hidden behind attunement depth and exploration, not repetition.
4. **The narrative scroll is the planet's voice.** It reminds the player they are witnessing something, not just optimizing it.
5. **Harmony is powerful, not passive.** Choosing harmony is a strategic advantage, not a soft option.

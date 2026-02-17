import * as THREE from 'three'
import { PlanetView, type ResonanceZone, type ElementKey, ELEMENT_COLORS } from './planetview'

// ---------------------------------------------------------------------------
// Life Types
// ---------------------------------------------------------------------------
export type LifeType =
  | 'mycelium' | 'plant' | 'mammal' | 'reptile'
  | 'crystal' | 'spore' | 'symbiont' | 'aether'

export interface LifeTypeDef {
  id:            LifeType
  name:          string
  emoji:         string
  baseGrowth:    number      // per-second base growth rate
  techContrib:   number      // tech contribution multiplier
  wisdomContrib: number      // wisdom contribution multiplier
  tempPref:      number      // preferred tempNorm (0=cold, 1=hot)
  tempWidth:     number      // tolerance band around preference
}

export const LIFE_TYPES: LifeTypeDef[] = [
  { id: 'mycelium',  name: 'Mycelium',     emoji: '\u{1F344}', baseGrowth: 0.018, techContrib: 0.3, wisdomContrib: 0.8, tempPref: 0.3, tempWidth: 0.35 },
  { id: 'plant',     name: 'Verdant',      emoji: '\u{1F33F}', baseGrowth: 0.030, techContrib: 0.2, wisdomContrib: 0.5, tempPref: 0.5, tempWidth: 0.30 },
  { id: 'mammal',    name: 'Mammalian',    emoji: '\u{1F43E}', baseGrowth: 0.024, techContrib: 0.9, wisdomContrib: 0.4, tempPref: 0.55, tempWidth: 0.30 },
  { id: 'reptile',   name: 'Reptilian',    emoji: '\u{1F98E}', baseGrowth: 0.022, techContrib: 0.7, wisdomContrib: 0.3, tempPref: 0.7, tempWidth: 0.25 },
  { id: 'crystal',   name: 'Crystalline',  emoji: '\u{1F48E}', baseGrowth: 0.010, techContrib: 0.5, wisdomContrib: 0.9, tempPref: 0.5, tempWidth: 0.50 },
  { id: 'spore',     name: 'Sporecloud',   emoji: '\u{1F32B}\uFE0F', baseGrowth: 0.026, techContrib: 0.4, wisdomContrib: 0.4, tempPref: 0.5, tempWidth: 0.45 },
  { id: 'symbiont',  name: 'Symbiont',     emoji: '\u{1F517}', baseGrowth: 0.015, techContrib: 0.6, wisdomContrib: 0.7, tempPref: 0.5, tempWidth: 0.40 },
  { id: 'aether',    name: 'Aetheric',     emoji: '\u{2728}',  baseGrowth: 0.012, techContrib: 0.8, wisdomContrib: 1.0, tempPref: 0.5, tempWidth: 0.50 },
]

const LIFE_MAP = new Map(LIFE_TYPES.map(lt => [lt.id, lt]))

// ---------------------------------------------------------------------------
// Harmony Matrix  (-1 = antagonism, +1 = harmony)
// ---------------------------------------------------------------------------
const H: Record<string, number> = {
  'mycelium:plant':    0.8,
  'mycelium:crystal':  0.4,
  'mycelium:spore':    0.3,
  'plant:reptile':    -0.6,
  'plant:spore':       0.2,
  'plant:symbiont':    0.4,
  'mammal:reptile':   -0.8,
  'mammal:symbiont':   0.6,
  'mammal:aether':    -0.5,
  'reptile:crystal':   0.2,
  'reptile:spore':    -0.3,
  'crystal:aether':    0.9,
  'crystal:symbiont':  0.3,
  'spore:symbiont':    0.2,
  'symbiont:aether':   0.4,
}

function harmony(a: LifeType, b: LifeType): number {
  if (a === b) return 0
  const key1 = `${a}:${b}`
  const key2 = `${b}:${a}`
  return H[key1] ?? H[key2] ?? 0
}

// ---------------------------------------------------------------------------
// Relic
// ---------------------------------------------------------------------------
export interface Relic {
  cellIdx:     number
  type:        'tech' | 'wisdom'
  tier:        1 | 2 | 3
  discovered:  boolean
  mesh:        THREE.Mesh
  label:       string
}

const RELIC_NAMES: Record<string, string[]> = {
  tech:   ['Fractal Engine', 'Resonant Core', 'Phase Lattice', 'Void Compass'],
  wisdom: ['Ancient Codex', 'Dream Archive', 'Star Memory', 'Silence Stone'],
}

// ---------------------------------------------------------------------------
// LifeNode — one active life type in the simulation
// ---------------------------------------------------------------------------
export interface LifeNode {
  def:         LifeTypeDef
  population:  number     // 0.0 → 1.0
  growth:      number     // computed each tick
}

// ---------------------------------------------------------------------------
// Display data for the HUD (consumed by main.ts)
// ---------------------------------------------------------------------------
export interface LifeSimDisplay {
  types:       { def: LifeTypeDef; population: number }[]
  techLevel:   number
  wisdomLevel: number
  funnel:      boolean
  funnelTimer: number     // seconds remaining in funnel (0 if not in funnel)
  outcome:     LifeSimOutcome
}

export interface LifeSimEvent {
  type: 'relic-found'
  relic: Relic
}

export type LifeSimOutcome = 'playing' | 'survived' | 'collapsed'

// ---------------------------------------------------------------------------
// LifeView
// ---------------------------------------------------------------------------
export class LifeView {
  readonly group = new THREE.Group()

  private nodes:        LifeNode[] = []
  private relics:       Relic[] = []
  private techLevel   = 0
  private wisdomLevel = 0
  private tempNorm:     number
  private seed:         number

  // Funnel
  private funnel       = false
  private funnelTimer  = 0
  private readonly FUNNEL_DURATION = 22   // seconds
  private _outcome:    LifeSimOutcome = 'playing'

  // Timers
  private _tick        = 0
  private _wisdomBoost = 0    // remaining seconds of wisdom-relic harmony buff

  // Visual: sprite dots on the planet surface for each life type
  private dotMeshes: THREE.InstancedMesh[] = []
  private planetView: PlanetView

  // Relic visibility threshold
  private readonly RELIC_VISIBLE_POP = 0.25

  constructor(
    planetView: PlanetView,
    tempNorm: number,
    seed: number,
  ) {
    this.planetView = planetView
    this.tempNorm   = tempNorm
    this.seed       = seed

    // Seed life types from the planet's filled zones
    this.seedLifeFromZones(planetView.zones)
    this.createRelics(planetView)
    this.createVisuals(planetView)
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get outcome(): LifeSimOutcome { return this._outcome }

  get displayData(): LifeSimDisplay {
    return {
      types:       this.nodes.map(n => ({ def: n.def, population: n.population })),
      techLevel:   this.techLevel,
      wisdomLevel: this.wisdomLevel,
      funnel:      this.funnel,
      funnelTimer: this.funnel ? Math.max(0, this.funnelTimer) : 0,
      outcome:     this._outcome,
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(dt: number) {
    if (this._outcome !== 'playing') return
    this._tick += dt
    this._wisdomBoost = Math.max(0, this._wisdomBoost - dt)

    // Growth step
    this.tickGrowth(dt)

    // Check funnel entry
    if (!this.funnel) {
      const totalPop = this.nodes.reduce((s, n) => s + n.population, 0)
      const maxPop   = Math.max(...this.nodes.map(n => n.population))
      if (totalPop >= 0.85 || maxPop >= 0.7) {
        this.funnel      = true
        this.funnelTimer = this.FUNNEL_DURATION
      }
    }

    // Funnel countdown
    if (this.funnel) {
      this.funnelTimer -= dt
      if (this.funnelTimer <= 0) {
        this.resolveFunnel()
      }
    }

    // Accumulate tech & wisdom
    for (const n of this.nodes) {
      this.techLevel   = Math.min(1, this.techLevel   + n.population * n.def.techContrib   * 0.003 * dt)
      this.wisdomLevel = Math.min(1, this.wisdomLevel + n.population * n.def.wisdomContrib * 0.003 * dt)
    }

    // Late arrival: aether appears after tick > 40s if not already present
    if (this._tick > 40 && !this.nodes.find(n => n.def.id === 'aether')) {
      const aeDef = LIFE_MAP.get('aether')!
      if (this.nodes.length < 6) {
        this.nodes.push({ def: aeDef, population: 0.05, growth: 0 })
      }
    }

    // Update visuals
    this.updateVisuals()
  }

  // ── Pointer interaction (relic clicking) ─────────────────────────────────
  onPointerDown(raycaster: THREE.Raycaster): LifeSimEvent | null {
    if (this._outcome !== 'playing') return null
    const totalPop = this.nodes.reduce((s, n) => s + n.population, 0)
    if (totalPop < this.RELIC_VISIBLE_POP) return null

    for (const relic of this.relics) {
      if (relic.discovered) continue
      const hits = raycaster.intersectObject(relic.mesh)
      if (hits.length > 0) {
        relic.discovered = true
        this.applyRelic(relic)
        return { type: 'relic-found', relic }
      }
    }
    return null
  }

  // ── Dispose ──────────────────────────────────────────────────────────────
  dispose() {
    this.group.traverse(obj => {
      const o = obj as THREE.Mesh
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
      else (o.material as THREE.Material)?.dispose()
    })
  }

  // ── Private: seeding ─────────────────────────────────────────────────────
  private seedLifeFromZones(zones: ResonanceZone[]) {
    const rng = this.makeRNG(this.seed ^ 0xbeef)

    // Map elements to preferred life types
    const ELEM_LIFE: Record<ElementKey, LifeType[]> = {
      fire:  ['reptile', 'crystal'],
      water: ['plant', 'mycelium'],
      earth: ['mammal', 'symbiont'],
      air:   ['spore', 'plant'],
    }

    // Collect unique life types from filled zones
    const picked = new Set<LifeType>()
    for (const z of zones) {
      if (!z.filled) continue
      const candidates = ELEM_LIFE[z.element]
      const choice = candidates[Math.floor(rng() * candidates.length)]
      picked.add(choice)
    }

    // Ensure at least 3 types
    const allTypes: LifeType[] = ['mycelium', 'plant', 'mammal', 'reptile', 'crystal', 'spore', 'symbiont']
    while (picked.size < 3) {
      picked.add(allTypes[Math.floor(rng() * allTypes.length)])
    }
    // Cap at 5 initial types
    const arr = [...picked].slice(0, 5)

    for (const id of arr) {
      const def = LIFE_MAP.get(id)!
      this.nodes.push({
        def,
        population: 0.05 + rng() * 0.10,
        growth: 0,
      })
    }
  }

  // ── Private: growth ──────────────────────────────────────────────────────
  private tickGrowth(dt: number) {
    const harmonyMult = this.funnel ? 3.0 : 1.0
    const wisdomBuff  = this._wisdomBoost > 0 ? 0.3 : 0

    for (const node of this.nodes) {
      // Base growth (logistic cap)
      let delta = node.def.baseGrowth * (1 - node.population) * dt

      // Temperature affinity
      const tempDist = Math.abs(this.tempNorm - node.def.tempPref)
      if (tempDist > node.def.tempWidth) {
        delta *= 0.5   // outside comfort zone
      }

      // Harmony/antagonism from other types
      for (const other of this.nodes) {
        if (other === node) continue
        const h = harmony(node.def.id, other.def.id) + wisdomBuff
        if (h > 0) {
          // Harmony boost: both types benefit proportionally
          delta += h * other.population * 0.008 * dt
        } else if (h < 0) {
          // Antagonism: suppresses growth (amplified during funnel)
          delta += h * harmonyMult * other.population * 0.012 * dt
        }
      }

      node.growth      = delta / Math.max(dt, 0.001)  // store rate for display
      node.population  = Math.max(0.001, Math.min(1.0, node.population + delta))
    }

    // Remove extinct types (pop < 0.005)
    this.nodes = this.nodes.filter(n => n.population >= 0.005)
  }

  // ── Private: funnel resolution ───────────────────────────────────────────
  private resolveFunnel() {
    let harmonySum = 0
    let antagonismSum = 0
    let pairCount = 0

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const h = harmony(this.nodes[i].def.id, this.nodes[j].def.id)
        if (h > 0) harmonySum += h
        else if (h < 0) antagonismSum += Math.abs(h)
        pairCount++
      }
    }

    const harmonyScore = antagonismSum > 0.01
      ? harmonySum / antagonismSum
      : harmonySum > 0 ? 10 : 1

    const diversity = this.nodes.filter(n => n.population > 0.05).length
    const maxPop    = Math.max(...this.nodes.map(n => n.population))

    if (harmonyScore > 1.2 && diversity >= 3) {
      this._outcome = 'survived'
    } else if (harmonyScore <= 0.8 || maxPop > 0.9 || diversity < 2) {
      this._outcome = 'collapsed'
    } else {
      // Borderline — extend funnel for another 10s to give player time to find relics
      this.funnelTimer = 10
      // If it comes back here again, force an outcome
      if (this._tick > 120) {
        this._outcome = diversity >= 2 ? 'survived' : 'collapsed'
      }
    }
  }

  // ── Private: relics ──────────────────────────────────────────────────────
  private createRelics(planetView: PlanetView) {
    const rng = this.makeRNG(this.seed ^ 0xdead)
    const count = 2 + Math.floor(rng() * 3)   // 2–4 relics
    const usedCells = new Set<number>()

    for (let i = 0; i < count; i++) {
      // Pick a random cell not already used
      let cellIdx: number
      let attempts = 0
      do {
        cellIdx = Math.floor(rng() * planetView.cellCount)
        attempts++
      } while (usedCells.has(cellIdx) && attempts < 50)
      usedCells.add(cellIdx)

      const type: 'tech' | 'wisdom' = rng() < 0.5 ? 'tech' : 'wisdom'
      const tier  = (1 + Math.floor(rng() * 3)) as 1 | 2 | 3
      const names = RELIC_NAMES[type]
      const label = names[Math.floor(rng() * names.length)]

      // Small icosahedron on planet surface
      const geo = new THREE.IcosahedronGeometry(0.028 + tier * 0.008, 0)
      const color = type === 'tech' ? 0x44ddff : 0xffcc44
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,   // starts invisible, fades in as population grows
      })
      const mesh = new THREE.Mesh(geo, mat)

      // Position on planet surface
      const pos = planetView.cellCentroids[cellIdx].clone().multiplyScalar(1.02)
      mesh.position.copy(pos)

      this.group.add(mesh)
      this.relics.push({ cellIdx, type, tier, discovered: false, mesh, label })
    }
  }

  private applyRelic(relic: Relic) {
    const boost = relic.tier * 0.12
    if (relic.type === 'tech') {
      this.techLevel = Math.min(1, this.techLevel + boost)
      // Tech relic: boost dominant type's growth temporarily via population bump
      const dominant = this.nodes.reduce((a, b) => a.population > b.population ? a : b, this.nodes[0])
      if (dominant) dominant.population = Math.min(1, dominant.population + 0.05 * relic.tier)
    } else {
      this.wisdomLevel = Math.min(1, this.wisdomLevel + boost)
      // Wisdom relic: harmony buff for 30s
      this._wisdomBoost = 30
    }

    // Visual: dim the relic mesh
    const mat = relic.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.15
    mat.color.set(0x888888)
  }

  // ── Private: visuals ─────────────────────────────────────────────────────
  private createVisuals(planetView: PlanetView) {
    // For each life node, create an InstancedMesh of small dots spread across
    // the planet surface in zones associated with that life type's element affinity.
    // We'll update instance counts/visibility in updateVisuals().
    // For simplicity, we create a small sphere per life type placed on random cells.

    const rng = this.makeRNG(this.seed ^ 0xcafe)
    const cellCount = planetView.cellCount

    for (const node of this.nodes) {
      const dotCount = Math.min(60, Math.floor(cellCount * 0.12))
      const geo = new THREE.SphereGeometry(0.015, 4, 4)

      // Pick a color based on life type
      const color = this.lifeColor(node.def.id)
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0 })
      const inst = new THREE.InstancedMesh(geo, mat, dotCount)
      inst.userData.lifeType = node.def.id

      const dummy = new THREE.Object3D()
      for (let d = 0; d < dotCount; d++) {
        const ci = Math.floor(rng() * cellCount)
        const pos = planetView.cellCentroids[ci].clone().multiplyScalar(1.015 + rng() * 0.01)
        dummy.position.copy(pos)
        dummy.scale.setScalar(0.5 + rng() * 1.0)
        dummy.updateMatrix()
        inst.setMatrixAt(d, dummy.matrix)
      }
      inst.instanceMatrix.needsUpdate = true
      this.group.add(inst)
      this.dotMeshes.push(inst)
    }
  }

  private updateVisuals() {
    const t = this._tick

    // Life type dots: opacity tracks population
    for (let i = 0; i < this.dotMeshes.length; i++) {
      const inst = this.dotMeshes[i]
      const node = this.nodes.find(n => n.def.id === inst.userData.lifeType)
      const pop  = node ? node.population : 0
      const mat  = inst.material as THREE.MeshBasicMaterial

      // Pulse during funnel
      const funnelPulse = this.funnel ? 0.5 + Math.sin(t * 6) * 0.5 : 1.0
      mat.opacity = Math.min(0.85, pop * 1.2) * funnelPulse

      // If type is extinct, hide completely
      if (!node || pop < 0.005) mat.opacity = 0
    }

    // Relics: pulse and fade in based on total population
    const totalPop = this.nodes.reduce((s, n) => s + n.population, 0)
    for (const relic of this.relics) {
      if (relic.discovered) continue
      const mat = relic.mesh.material as THREE.MeshBasicMaterial
      const visibility = Math.max(0, (totalPop - this.RELIC_VISIBLE_POP) / 0.3)
      const pulse = 0.5 + Math.sin(t * 3 + relic.cellIdx * 0.1) * 0.5
      mat.opacity = visibility * pulse * 0.8

      // Gentle float
      const basePos = this.planetView.cellCentroids[relic.cellIdx]
      const lift = 1.02 + Math.sin(t * 2.0 + relic.cellIdx) * 0.008
      relic.mesh.position.copy(basePos).multiplyScalar(lift)
      relic.mesh.rotation.y = t * 1.5
    }
  }

  private lifeColor(id: LifeType): THREE.Color {
    switch (id) {
      case 'mycelium':  return new THREE.Color(0xcc88ff)
      case 'plant':     return new THREE.Color(0x44cc22)
      case 'mammal':    return new THREE.Color(0xffaa44)
      case 'reptile':   return new THREE.Color(0x44bb88)
      case 'crystal':   return new THREE.Color(0x88ddff)
      case 'spore':     return new THREE.Color(0xaaaacc)
      case 'symbiont':  return new THREE.Color(0xff88cc)
      case 'aether':    return new THREE.Color(0xeeeeff)
    }
  }

  private makeRNG(seed: number) {
    let s = ((seed ^ 0xdeadbeef) >>> 0) || 1
    return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
  }
}

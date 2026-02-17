import * as THREE from 'three'
import { buildSurfaceMesh } from './hexsphere'

export type ElementKey = 'fire' | 'water' | 'earth' | 'air'
export type ElementMix = Record<ElementKey, number>
export const DEFAULT_MIX: ElementMix = { fire: 0.25, water: 0.25, earth: 0.25, air: 0.25 }
const KEYS: ElementKey[] = ['fire', 'water', 'earth', 'air']

export type SeedEventKey = 'meteor' | 'solar_storm' | 'volcano' | 'tidal_wave' | 'ice_age' | 'lightning'

export interface SeedEvent {
  key: SeedEventKey
  label: string
  emoji: string
  flashColor: THREE.Color
  seeds: number
  seedElement: ElementKey
}

export const SEED_EVENTS: SeedEvent[] = [
  { key: 'meteor',      label: 'Meteor Strike',   emoji: '☄',  flashColor: new THREE.Color(0xff8844), seeds: 4, seedElement: 'fire'  },
  { key: 'solar_storm', label: 'Solar Storm',     emoji: '☀',  flashColor: new THREE.Color(0xffdd44), seeds: 1, seedElement: 'fire'  },
  { key: 'volcano',     label: 'Volcano',         emoji: '🌋', flashColor: new THREE.Color(0xff4400), seeds: 2, seedElement: 'earth' },
  { key: 'tidal_wave',  label: 'Tidal Wave',      emoji: '🌊', flashColor: new THREE.Color(0x0088ff), seeds: 3, seedElement: 'water' },
  { key: 'ice_age',     label: 'Ice Age',         emoji: '❄',  flashColor: new THREE.Color(0x88ccff), seeds: 1, seedElement: 'air'   },
  { key: 'lightning',   label: 'Lightning Storm', emoji: '⚡', flashColor: new THREE.Color(0xeeeeff), seeds: 6, seedElement: 'air'   },
]

export const ELEMENT_COLORS: Record<ElementKey, THREE.Color> = {
  fire:  new THREE.Color(0xff5500),
  water: new THREE.Color(0x0055ff),
  earth: new THREE.Color(0x44bb22),
  air:   new THREE.Color(0x88bbff),
}

// How each element spreads
const ELEMENT_SPREAD_RATE: Record<ElementKey, number> = { fire: 3.2, water: 0.75, earth: 0.5, air: 1.8 }
// How naturally each element "takes hold" (conflicts with others slow it)
const ELEMENT_HARMONY: Record<ElementKey, Record<ElementKey, number>> = {
  fire:  { fire: 1.0, water: 0.1, earth: 0.6, air: 0.7 },
  water: { fire: 0.1, water: 1.0, earth: 0.7, air: 0.6 },
  earth: { fire: 0.5, water: 0.6, earth: 1.0, air: 0.4 },
  air:   { fire: 0.6, water: 0.5, earth: 0.3, air: 1.0 },
}

function makePRNG(seed: number) {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

interface CellState {
  phase:    number          // 0 = dark, 1 = fully lit
  queued:   boolean
  element:  ElementKey | null
}

export type PlanetOutcome = 'playing' | 'won' | 'lost'

export class PlanetView {
  readonly group      = new THREE.Group()
  readonly cellCount:   number
  readonly cellCentroids: THREE.Vector3[]  // unit-sphere positions, for hit-testing
  readonly resonance:   ElementMix         // planet's hidden preferred mix

  private adj:      number[][]
  private setCell:  (i: number, r: number, g: number, b: number) => void
  private flush:    () => void
  private cells:    CellState[]
  private frontier: number[]
  private color:    THREE.Color
  private spreadAccum = 0
  private topCell:    number
  private paused  = true

  private flashPhase = 0
  private flashColor = new THREE.Color()

  private _outcome:     PlanetOutcome = 'playing'
  private _litFraction  = 0
  private timePlaying   = 0

  constructor(seed: number, color: THREE.Color) {
    this.color = color.clone()
    const surface = buildSurfaceMesh(4, 1.0)
    this.group.add(surface.mesh)
    this.cellCount = surface.cellCount
    this.adj       = surface.adj
    this.setCell   = surface.setCell
    this.flush     = surface.flush
    this.topCell   = surface.topCell
    this.cellCentroids = surface.cellCentroids

    // Derive resonance from seed
    const rand = makePRNG(seed ^ 0xface)
    const raw = KEYS.map(() => rand() ** 1.5)
    const total = raw.reduce((a, b) => a + b, 0)
    this.resonance = KEYS.reduce((o, k, i) => { o[k] = raw[i] / total; return o }, {} as ElementMix)

    // Start dark and paused
    this.cells    = Array.from({ length: this.cellCount }, () => ({ phase: 0, queued: false, element: null }))
    this.frontier = []

    const { r, g, b } = color
    for (let i = 0; i < this.cellCount; i++) surface.setCell(i, r * 0.03, g * 0.03, b * 0.03)
    surface.flush()

    this.group.add(new THREE.AmbientLight(0x111133, 1))
  }

  get outcome():     PlanetOutcome { return this._outcome }
  get litFraction(): number        { return this._litFraction }

  /** Element mix computed from what's actually painted on the planet */
  get currentMix(): ElementMix {
    const counts: Record<ElementKey, number> = { fire: 0, water: 0, earth: 0, air: 0 }
    let total = 0
    for (const c of this.cells) {
      if (c.element && c.phase > 0.1) { counts[c.element]++; total++ }
    }
    if (total === 0) return { ...DEFAULT_MIX }
    return KEYS.reduce((o, k) => { o[k] = counts[k] / total; return o }, {} as ElementMix)
  }

  /** Match score of current painted mix vs resonance (0 = terrible, 1 = perfect) */
  get matchScore(): number {
    const mix = this.currentMix
    const dot  = KEYS.reduce((acc, k) => acc + mix[k] * this.resonance[k], 0)
    return Math.max(0, Math.min(1, (dot - 0.25) / 0.75))
  }

  get dominantElement(): ElementKey {
    return KEYS.reduce((best, k) => this.resonance[k] > this.resonance[best] ? k : best, KEYS[0])
  }

  /** Find nearest cell to a point in world-space (accounts for group rotation). */
  nearestCell(worldPoint: THREE.Vector3): number {
    // Transform hit point into the group's local space so rotation is accounted for
    const local = this.group.worldToLocal(worldPoint.clone()).normalize()
    let best = 0, bestDot = -Infinity
    for (let i = 0; i < this.cellCount; i++) {
      const d = local.dot(this.cellCentroids[i])
      if (d > bestDot) { bestDot = d; best = i }
    }
    return best
  }

  /** Paint a cell with an element — starts a spread wave from that point. */
  paint(cellIdx: number, element: ElementKey) {
    if (this.paused || this._outcome !== 'playing') return
    const c = this.cells[cellIdx]
    if (c.queued && c.element === element) return  // already this element, no-op
    c.element = element
    if (!c.queued) {
      c.queued = true
      c.phase  = 0.01
      this.frontier.push(cellIdx)
    }
  }

  /** Start from a seeding event. */
  reset(event: SeedEvent) {
    this._outcome    = 'playing'
    this.timePlaying = 0
    this.spreadAccum = 0

    this.cells    = Array.from({ length: this.cellCount }, () => ({ phase: 0, queued: false, element: null }))
    this.frontier = []

    this.flashColor.copy(event.flashColor)
    this.flashPhase = 1.0

    const step = Math.floor(this.cellCount / event.seeds)
    for (let s = 0; s < event.seeds; s++) {
      const si = (this.topCell + s * step) % this.cellCount
      this.cells[si].phase   = 0.01
      this.cells[si].queued  = true
      this.cells[si].element = event.seedElement
      this.frontier.push(si)
    }

    const { r, g, b } = this.color
    for (let i = 0; i < this.cellCount; i++) this.setCell(i, r * 0.03, g * 0.03, b * 0.03)
    this.flush()
    this.paused = false
  }

  update(dt: number) {
    // Flash overrides everything briefly
    if (this.flashPhase > 0) {
      this.flashPhase = Math.max(0, this.flashPhase - dt * 2.2)
      const fp = this.flashPhase
      const { r: fr, g: fg, b: fb } = this.flashColor
      const { r, g, b } = this.color
      for (let i = 0; i < this.cellCount; i++) {
        const t = this.cells[i].phase
        const base = t * 0.9 + 0.03
        this.setCell(i, r * base * (1 - fp) + fr * fp, g * base * (1 - fp) + fg * fp, b * base * (1 - fp) + fb * fp)
      }
      this.flush()
      return
    }

    if (this.paused || this._outcome !== 'playing') return
    this.timePlaying += dt

    const { r: pr, g: pg, b: pb } = this.color

    // Recolor ALL active cells every frame — immediately reflects current state
    for (let i = 0; i < this.cellCount; i++) {
      const c = this.cells[i]
      if (c.phase <= 0) continue
      const el = c.element ?? 'earth'
      const ec = ELEMENT_COLORS[el]
      // Blend element color with planet base color
      const t  = c.phase
      const blend = 0.4 + t * 0.5        // element color dominates as cell fills
      const brightness = t * (0.7 + t * 0.3)
      this.setCell(i,
        (pr * (1 - blend) + ec.r * blend) * brightness,
        (pg * (1 - blend) + ec.g * blend) * brightness,
        (pb * (1 - blend) + ec.b * blend) * brightness,
      )
    }

    // Advance frontier
    const nextFrontier: number[] = []
    const readyToSpread: number[] = []

    for (const ci of this.frontier) {
      const el   = this.cells[ci].element ?? 'earth'
      const rate = ELEMENT_SPREAD_RATE[el]
      this.cells[ci].phase = Math.min(1, this.cells[ci].phase + dt * rate * 1.6)
      if (this.cells[ci].phase >= 1) readyToSpread.push(ci)
      else nextFrontier.push(ci)
    }

    // Spread to neighbours
    this.spreadAccum += dt
    const maxRate = Math.max(...KEYS.map(k => ELEMENT_SPREAD_RATE[k]))
    const spreadInterval = 0.08 / maxRate
    if (this.spreadAccum >= spreadInterval) {
      this.spreadAccum = 0
      for (const ci of readyToSpread) {
        const el = this.cells[ci].element ?? 'earth'
        const rate = ELEMENT_SPREAD_RATE[el]
        for (const ni of this.adj[ci]) {
          if (this.cells[ni].queued) continue
          const existing = this.cells[ni].element
          const harmony  = existing ? ELEMENT_HARMONY[el][existing] : 1.0
          // Probability of spreading — element harmony and resonance match both matter
          const resMul = 0.5 + this.resonance[el]
          if (Math.random() > harmony * resMul * (rate / maxRate)) continue
          this.cells[ni].queued  = true
          this.cells[ni].phase   = 0.01
          this.cells[ni].element = el
          nextFrontier.push(ni)
        }
      }
    } else {
      nextFrontier.push(...readyToSpread)
    }

    this.frontier = nextFrontier
    this.flush()

    // Lit fraction & outcome
    let litCount = 0
    for (let i = 0; i < this.cellCount; i++) if (this.cells[i].phase > 0.5) litCount++
    this._litFraction = litCount / this.cellCount

    if (this._litFraction >= 0.82) this._outcome = 'won'
    else if (this.frontier.length === 0 && this._litFraction < 0.22 && this.timePlaying > 5) this._outcome = 'lost'
  }

  get complete(): boolean { return this._outcome !== 'playing' }

  dispose() {
    this.group.traverse(obj => {
      const o = obj as THREE.Mesh
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
      else (o.material as THREE.Material)?.dispose()
    })
  }
}

import * as THREE from 'three'
import { buildSurfaceMesh } from './hexsphere'

export type ElementKey = 'fire' | 'water' | 'earth' | 'air'
export type ElementMix = Record<ElementKey, number>
export const DEFAULT_MIX: ElementMix = { fire: 0.25, water: 0.25, earth: 0.25, air: 0.25 }
const KEYS: ElementKey[] = ['fire', 'water', 'earth', 'air']

export type SeedEventKey = 'meteor' | 'solar_storm' | 'volcano' | 'tidal_wave' | 'ice_age' | 'lightning'

export interface SeedEvent {
  key:          SeedEventKey
  label:        string
  emoji:        string
  flashColor:   THREE.Color
  preFill:      number          // zones pre-filled by this event (0-2)
  preFillEl:    ElementKey      // element used for pre-fill
}

export const SEED_EVENTS: SeedEvent[] = [
  { key: 'meteor',      label: 'Meteor Strike',   emoji: '☄',  flashColor: new THREE.Color(0xff8844), preFill: 1, preFillEl: 'fire'  },
  { key: 'solar_storm', label: 'Solar Storm',     emoji: '☀',  flashColor: new THREE.Color(0xffdd44), preFill: 0, preFillEl: 'fire'  },
  { key: 'volcano',     label: 'Volcano',         emoji: '🌋', flashColor: new THREE.Color(0xff4400), preFill: 1, preFillEl: 'earth' },
  { key: 'tidal_wave',  label: 'Tidal Wave',      emoji: '🌊', flashColor: new THREE.Color(0x0088ff), preFill: 1, preFillEl: 'water' },
  { key: 'ice_age',     label: 'Ice Age',         emoji: '❄',  flashColor: new THREE.Color(0x88ccff), preFill: 1, preFillEl: 'air'   },
  { key: 'lightning',   label: 'Lightning Storm', emoji: '⚡', flashColor: new THREE.Color(0xeeeeff), preFill: 2, preFillEl: 'air'   },
]

export const ELEMENT_COLORS: Record<ElementKey, THREE.Color> = {
  fire:  new THREE.Color(0xff5500),
  water: new THREE.Color(0x0055ff),
  earth: new THREE.Color(0x44bb22),
  air:   new THREE.Color(0x88bbff),
}

const ELEMENT_EMOJI: Record<ElementKey, string> = { fire: '🔥', water: '💧', earth: '🌿', air: '🌀' }
export { ELEMENT_EMOJI }

function makePRNG(seed: number) {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

/** A resonance zone: BFS blob of cells wanting a specific element */
export interface ResonanceZone {
  cells:   number[]
  element: ElementKey
  filled:  boolean      // true once correctly attuned by the player
}

/** One step in a challenge: paint the given zone with the given element */
export interface ChallengeStep {
  zoneIdx: number
  element: ElementKey
}

/** Snapshot of the live challenge state for the HUD */
export interface ChallengeDisplay {
  steps:          ChallengeStep[]
  stepIdx:        number     // which step is active (0-based)
  stepTimer:      number     // seconds remaining on this step
  timePerStep:    number     // total seconds allowed per step
  completedCount: number     // successful pattern completions so far
  attunement:     number     // 0–1
  failFlash:      number     // >0 while fail animation plays
  successFlash:   number     // >0 while success animation plays
}

export type PlanetOutcome = 'playing' | 'won' | 'lost'

export class PlanetView {
  readonly group        = new THREE.Group()
  readonly cellCount:     number
  readonly cellCentroids: THREE.Vector3[]
  readonly tempNorm:      number

  private adj:       number[][]
  private setCell:   (i: number, r: number, g: number, b: number) => void
  private flush:     () => void
  private cellZone:  Int16Array  // zone index per cell, -1 = no zone
  private color:     THREE.Color
  private paused     = true

  // Cell paint state — element currently painted on each cell (null = bare)
  private cellEl: (ElementKey | null)[]

  // Challenge state
  private challenge:      ChallengeStep[] = []
  private _stepIdx        = 0
  private _stepTimer      = 0
  private _timePerStep    = 8
  private _completedCount = 0
  private _attunement     = 0
  private _failFlash      = 0
  private _successFlash   = 0
  private _timePlaying    = 0
  private _lifeTime       = 0
  private _outcome:       PlanetOutcome = 'playing'

  private flashPhase = 0
  private flashColor = new THREE.Color()
  private _failCooldown = 0    // brief immunity after a fail (prevents drag multi-fail)

  readonly zones: ResonanceZone[] = []

  // ── Constructor ──────────────────────────────────────────────────────────
  constructor(seed: number, color: THREE.Color, tempNorm: number = 0.5) {
    this.tempNorm = tempNorm
    this.color    = color.clone()

    const surface       = buildSurfaceMesh(4, 1.0)
    this.group.add(surface.mesh)
    this.cellCount      = surface.cellCount
    this.adj            = surface.adj
    this.setCell        = surface.setCell
    this.flush          = surface.flush
    this.cellCentroids  = surface.cellCentroids
    this.cellZone       = new Int16Array(this.cellCount).fill(-1)
    this.cellEl         = new Array(this.cellCount).fill(null)

    // Generate resonance zones via seeded BFS
    const zrand     = makePRNG(seed ^ 0x1234abcd)
    const zoneCount = 4 + Math.floor(zrand() * 3)   // 4–6 zones
    const ZONE_SIZE = Math.floor(this.cellCount / (zoneCount * 2.2))

    for (let z = 0; z < zoneCount; z++) {
      const center   = Math.floor(zrand() * this.cellCount)
      const el: ElementKey = KEYS[Math.floor(zrand() * 4)]
      const visited  = new Set<number>([center])
      const front    = [center]
      while (visited.size < ZONE_SIZE && front.length) {
        const ci = front.splice(Math.floor(zrand() * front.length), 1)[0]
        for (const ni of this.adj[ci]) {
          if (!visited.has(ni) && this.cellZone[ni] === -1) {
            visited.add(ni); this.cellZone[ni] = z; front.push(ni)
          }
        }
        this.cellZone[ci] = z
      }
      this.zones.push({ cells: [...visited], element: el, filled: false })
    }

    // Paint initial hints
    this._paintSurface(0)
    this.group.add(new THREE.AmbientLight(0x111133, 1))
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get outcome():     PlanetOutcome { return this._outcome }
  get attunement():  number        { return this._attunement }

  /** Challenge data for the HUD — null while paused */
  get challengeDisplay(): ChallengeDisplay | null {
    if (this.paused || this._outcome !== 'playing') return null
    return {
      steps:          this.challenge,
      stepIdx:        this._stepIdx,
      stepTimer:      this._stepTimer,
      timePerStep:    this._timePerStep,
      completedCount: this._completedCount,
      attunement:     this._attunement,
      failFlash:      this._failFlash,
      successFlash:   this._successFlash,
    }
  }

  /** The element required right now — for highlighting the element picker */
  get requiredElement(): ElementKey | null {
    if (this.paused || this._outcome !== 'playing' || !this.challenge.length) return null
    return this.challenge[this._stepIdx]?.element ?? null
  }

  // ── Paint ─────────────────────────────────────────────────────────────────
  /** Find nearest cell to a world-space hit point (accounts for group rotation). */
  nearestCell(worldPoint: THREE.Vector3): number {
    const local = this.group.worldToLocal(worldPoint.clone()).normalize()
    let best = 0, bestDot = -Infinity
    for (let i = 0; i < this.cellCount; i++) {
      const d = local.dot(this.cellCentroids[i])
      if (d > bestDot) { bestDot = d; best = i }
    }
    return best
  }

  /**
   * Called when player paints cell `cellIdx` with `element`.
   * - Correct zone + correct element → advance challenge step
   * - Zone cell with wrong element → fail the challenge
   * - Non-zone cell → neutral (no penalty, lets player spin/look around)
   */
  paint(cellIdx: number, element: ElementKey) {
    if (this.paused || this._outcome !== 'playing' || !this.challenge.length) return
    if (this._failCooldown > 0) return   // brief immunity after a fail
    const step    = this.challenge[this._stepIdx]
    const cellZi  = this.cellZone[cellIdx]

    if (cellZi === step.zoneIdx) {
      // Painting in the target zone
      if (element === step.element) {
        this._advanceStep()
      } else {
        // Wrong element in the right zone — interrupt
        this._failChallenge()
      }
    } else if (cellZi >= 0 && !this.zones[cellZi].filled) {
      // Painting in a different unfilled zone — interrupt
      this._failChallenge()
    }
    // Painting on bare ground or already-filled zone is neutral
  }

  // ── Reset (called from event picker) ─────────────────────────────────────
  reset(event: SeedEvent) {
    this._outcome      = 'playing'
    this._timePlaying  = 0
    this._attunement   = 0
    this._completedCount = 0
    this._failFlash    = 0
    this._successFlash = 0
    this.cellEl.fill(null)
    for (const z of this.zones) z.filled = false

    this.flashColor.copy(event.flashColor)
    this.flashPhase = 1.0

    // Pre-fill zones from the seeding event (gives a head-start)
    const eligibleZones = this.zones
      .map((z, i) => ({ z, i }))
      .filter(({ z }) => z.element === event.preFillEl || event.preFill > 0)
    for (let p = 0; p < Math.min(event.preFill, this.zones.length); p++) {
      const pick = eligibleZones[p] ?? { z: this.zones[p], i: p }
      this._fillZone(pick.i, pick.z.element)
    }

    this.paused = false
    this._generateChallenge()
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(dt: number) {
    if (this.flashPhase > 0) {
      this.flashPhase = Math.max(0, this.flashPhase - dt * 2.2)
      const fp = this.flashPhase
      const { r: fr, g: fg, b: fb } = this.flashColor
      for (let i = 0; i < this.cellCount; i++) {
        const { r, g, b } = this._cellBaseColor(i)
        this.setCell(i, r * (1 - fp) + fr * fp, g * (1 - fp) + fg * fp, b * (1 - fp) + fb * fp)
      }
      this.flush()
      return
    }

    if (this._outcome === 'won') {
      this._lifeTime += dt
      const lt = this._lifeTime
      for (let i = 0; i < this.cellCount; i++) {
        const cent = this.cellCentroids[i]
        const wave = Math.max(0, Math.min(1, (lt * 0.6 - (1 - cent.y) * 0.5)))
        const pulse = 0.8 + Math.sin(lt * 3.0 + i * 0.04) * 0.2
        const zi = this.cellZone[i]
        const el = (zi >= 0 ? this.zones[zi].element : null) ?? 'earth'
        const ec = ELEMENT_COLORS[el]
        this.setCell(i,
          (ec.r * (1 - wave) + 0.1 * wave) * pulse,
          (ec.g * (1 - wave) + 0.75 * wave) * pulse,
          (ec.b * (1 - wave) + 0.2 * wave) * pulse,
        )
      }
      this.flush()
      return
    }

    if (this.paused || this._outcome !== 'playing') return
    this._timePlaying  += dt
    this._failFlash     = Math.max(0, this._failFlash - dt * 3)
    this._successFlash  = Math.max(0, this._successFlash - dt * 3)
    this._failCooldown  = Math.max(0, this._failCooldown - dt)

    // Challenge timer
    if (this.challenge.length > 0) {
      this._stepTimer -= dt
      if (this._stepTimer <= 0) {
        // Time ran out — interrupt
        this._attunement = Math.max(0, this._attunement - 0.05)
        this._failFlash  = 1.0
        this._generateChallenge()
      }
    }

    this._paintSurface(this._timePlaying)

    // Lose condition: attunement collapsed after playing for a while
    if (this._attunement <= 0 && this._timePlaying > 20) {
      this._outcome = 'lost'
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Returns the baseline RGB for a cell (used for surface painting & flash blending). */
  private _cellBaseColor(i: number): { r: number; g: number; b: number } {
    const zi  = this.cellZone[i]
    const el  = this.cellEl[i]

    if (el !== null) {
      // Painted from a successful fill
      const ec = ELEMENT_COLORS[el]
      return { r: ec.r * 0.45, g: ec.g * 0.45, b: ec.b * 0.45 }
    }
    if (zi >= 0) {
      const ec = ELEMENT_COLORS[this.zones[zi].element]
      return { r: ec.r * 0.10, g: ec.g * 0.10, b: ec.b * 0.10 }
    }
    const { r, g, b } = this.color
    return { r: r * 0.03, g: g * 0.03, b: b * 0.03 }
  }

  /** Full surface repaint each frame. */
  private _paintSurface(t: number) {
    const activeZone    = this.challenge.length > 0 ? this.challenge[this._stepIdx]?.zoneIdx ?? -1 : -1
    const activeEl      = this.challenge.length > 0 ? this.challenge[this._stepIdx]?.element  : null
    const timerFrac     = this._timePerStep > 0 ? this._stepTimer / this._timePerStep : 0
    const urgency       = timerFrac < 0.3       // last 30% of time → extra pulse speed
    const pulseSpeed    = urgency ? 9 : 5
    const pulse         = 0.65 + Math.sin(t * pulseSpeed) * 0.35
    const failPulse     = this._failFlash
    const successPulse  = this._successFlash

    for (let i = 0; i < this.cellCount; i++) {
      const zi = this.cellZone[i]
      const base = this._cellBaseColor(i)
      let { r, g, b } = base

      if (zi === activeZone && activeEl !== null) {
        // Target zone — bright pulsing highlight
        const ec = ELEMENT_COLORS[activeEl]
        const bright = urgency ? pulse * 1.1 : pulse * 0.9
        r = ec.r * bright
        g = ec.g * bright
        b = ec.b * bright
      }

      // Fail flash: bleed red over target zone
      if (failPulse > 0 && zi === activeZone) {
        r = r * (1 - failPulse) + failPulse
        g = g * (1 - failPulse)
        b = b * (1 - failPulse)
      }

      // Success flash: bleed bright white-green over filled zone
      if (successPulse > 0 && zi >= 0 && this.zones[zi].filled) {
        r = r * (1 - successPulse) + 0.4 * successPulse
        g = g * (1 - successPulse) + successPulse
        b = b * (1 - successPulse) + 0.4 * successPulse
      }

      // Gentle pulse on faint zone hints (not active zone)
      if (zi >= 0 && zi !== activeZone && !this.zones[zi].filled && this.cellEl[i] === null) {
        const hint = 0.08 + Math.sin(t * 1.8 + i * 0.05) * 0.03
        const ec   = ELEMENT_COLORS[this.zones[zi].element]
        r = ec.r * hint; g = ec.g * hint; b = ec.b * hint
      }

      this.setCell(i, r, g, b)
    }
    this.flush()
  }

  /** Fill all cells of a zone with an element (visually and logically). */
  private _fillZone(zoneIdx: number, element: ElementKey) {
    for (const ci of this.zones[zoneIdx].cells) {
      this.cellEl[ci] = element
    }
    this.zones[zoneIdx].filled  = true
    this.zones[zoneIdx].element = element
  }

  /** Called when the player paints the target zone correctly. */
  private _advanceStep() {
    const step = this.challenge[this._stepIdx]
    this._fillZone(step.zoneIdx, step.element)
    this._stepIdx++

    if (this._stepIdx >= this.challenge.length) {
      // Pattern complete!
      const bonus         = 0.10 + (this.challenge.length - 1) * 0.04
      this._attunement    = Math.min(1, this._attunement + bonus)
      this._successFlash  = 1.0
      this._completedCount++
      if (this._attunement >= 1.0) {
        this._outcome = 'won'
      } else {
        this._generateChallenge()
      }
    } else {
      // More steps to go — reset timer for next step
      this._stepTimer = Math.max(2.0, this._timePerStep + this._tempBonus(this.challenge[this._stepIdx].element))
    }
  }

  /** Called when the player makes a wrong move. */
  private _failChallenge() {
    this._attunement  = Math.max(0, this._attunement - 0.07)
    this._failFlash   = 1.0
    this._failCooldown = 0.6   // brief drag immunity
    this._generateChallenge()
  }

  /**
   * Hot/cold world time modifier per element.
   * Hot worlds give fire more time; cold worlds give water/air more time.
   */
  private _tempBonus(el: ElementKey): number {
    if (this.tempNorm > 0.65) {
      return el === 'fire' ? 2.0 : -1.0
    }
    if (this.tempNorm < 0.35) {
      return (el === 'water' || el === 'air') ? 1.0 : -1.5
    }
    return 0
  }

  /** Generate a new challenge pattern based on current difficulty. */
  private _generateChallenge() {
    const n   = this._completedCount
    // Step count: 1 → 2 → 3 → 4, doubling every 2 completions, capped at 4
    const stepCount   = Math.min(4, 1 + Math.floor(n / 2))
    // Time per step: starts at 9s, decreases to min 3s
    this._timePerStep = Math.max(3.0, 9.0 - n * 0.5)

    // Pick unfilled zones preferentially, fall back to any zone
    const unfilled = this.zones.map((z, i) => i).filter(i => !this.zones[i].filled)
    const pool     = unfilled.length >= stepCount ? unfilled : this.zones.map((_, i) => i)

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }

    this.challenge = pool.slice(0, stepCount).map(zi => ({
      zoneIdx: zi,
      element: this.zones[zi].element,
    }))

    this._stepIdx  = 0
    this._stepTimer = Math.max(2.0, this._timePerStep + this._tempBonus(this.challenge[0].element))
  }

  /** Narrative text for a failed planet. */
  static randomEonTale(): string {
    const TALES = [
      'ten thousand years of silence passed. then a comet struck and the elements stirred again.',
      'the atmosphere collapsed. slowly, over eons, volcanic pressure rebuilt it from nothing.',
      'ice age. a long dark. a faint warmth from the core kept the deep waters liquid.',
      'the star dimmed. then, in a burst of stellar fury, it re-ignited everything.',
      'dust and stone for a million years — until a passing moon drew tidal heat from the mantle.',
      'the world exhaled its oceans into space. in time, comets returned them drop by drop.',
      'silence for an age. then lightning carved the first complex molecules in the atmosphere.',
      'the crust hardened. cracked. the planet breathed again through ten thousand rifts.',
    ]
    return TALES[Math.floor(Math.random() * TALES.length)]
  }

  dispose() {
    this.group.traverse(obj => {
      const o = obj as THREE.Mesh
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
      else (o.material as THREE.Material)?.dispose()
    })
  }
}

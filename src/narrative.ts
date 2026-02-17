// Edge-scrolling narrative engine — pure DOM, no Three.js
// Paragraphs scroll along random screen edges during the life-sim phase.

export type NarrativeMood = 'ambient' | 'emergence' | 'tension' | 'funnel' | 'survived' | 'collapsed'

const PARAGRAPHS: Record<NarrativeMood, string[]> = {
  ambient: [
    'in the silence between tides, something stirs beneath the crust.',
    'a thin film of chemistry clings to warm stone. it is not alive. not yet.',
    'minerals arrange themselves in patterns no crystal should remember.',
    'the atmosphere thickens. rain falls for the first time in a thousand years.',
    'deep vents breathe heat into darkness. around them, molecules dance.',
    'sunlight splits water. oxygen drifts upward like a secret.',
    'the first membrane forms — a boundary between self and everything else.',
    'tidal pools concentrate what the ocean dilutes. complexity finds its nursery.',
  ],
  emergence: [
    'something replicates. imperfectly. the imperfections are the point.',
    'networks of filament spread through the substrate like whispered rumor.',
    'the first predator emerges. the first prey learns to hide.',
    'photosynthesis poisons the atmosphere with oxygen. life adapts, or doesn\'t.',
    'colonies form. cooperation is discovered, then rediscovered, then weaponized.',
    'roots crack stone. patience is the oldest form of power.',
    'the surface greens. from orbit, the change would be unmistakable.',
    'species multiply. niches fill. the web tightens.',
    'symbiosis: two failures become one success.',
    'the soil deepens. the dead nourish the living. a cycle closes.',
  ],
  tension: [
    'resources thin. growth curves flatten against invisible ceilings.',
    'the dominant species reshapes the world in its image. the world notices.',
    'temperature shifts. migration patterns break. old alliances dissolve.',
    'competition sharpens. what was shared becomes scarce.',
    'the ecosystem trembles. a frequency of change it has never known.',
    'somewhere deep in the web, a thread snaps. the vibration spreads.',
    'intelligence looks up at the stars and wonders if it is alone.',
    'the tools grow faster than the wisdom to wield them.',
  ],
  funnel: [
    'THE GREAT FILTER APPROACHES.',
    'civilizations teeter here. most fall.',
    'the question is not whether they can survive — but whether they choose to.',
    'war, plague, collapse, or transcendence. the funnel does not care which.',
    'every dominant species faces this moment. the math is unforgiving.',
    'cooperation or extinction. there is no third option at this scale.',
    'the planet holds its breath.',
  ],
  survived: [
    'they made it through. barely. beautifully.',
    'the scars remain, but the scars teach.',
    'a civilization that survived its own power. this is rare. this matters.',
    'they look up now with different eyes. the stars are not destinations — they are neighbors.',
    'the first ships are clumsy, hopeful things. they carry seeds.',
    'what was learned in the funnel becomes the foundation of everything after.',
  ],
  collapsed: [
    'silence returns to the surface. the ruins cool.',
    'it was not inevitable. that is the cruelest part.',
    'the atmosphere thins. the oceans retreat. chemistry simplifies.',
    'somewhere in the rubble, a spore waits.',
    'the planet turns. seasons pass without witnesses.',
    'perhaps next time. perhaps.',
  ],
}

type Edge = 'top' | 'right' | 'bottom' | 'left'

let styleInjected = false

function injectStyles() {
  if (styleInjected) return
  styleInjected = true
  const s = document.createElement('style')
  s.textContent = `
    @keyframes narrativeScrollRight {
      from { transform: translateX(-100%); }
      to   { transform: translateX(100vw); }
    }
    @keyframes narrativeScrollLeft {
      from { transform: translateX(100vw); }
      to   { transform: translateX(-100%); }
    }
    @keyframes narrativeScrollDown {
      from { transform: translateY(-100%); }
      to   { transform: translateY(100vh); }
    }
    @keyframes narrativeScrollUp {
      from { transform: translateY(100vh); }
      to   { transform: translateY(-100%); }
    }
  `
  document.head.appendChild(s)
}

export class NarrativeEngine {
  private container: HTMLElement
  private active: HTMLElement[] = []
  private timer = 0
  private nextInterval = 0
  private mood: NarrativeMood = 'ambient'
  private usedIndices: Partial<Record<NarrativeMood, Set<number>>> = {}
  private running = false

  constructor() {
    injectStyles()
    // Create or reuse the overlay container
    let el = document.getElementById('narrative-overlay')
    if (!el) {
      el = document.createElement('div')
      el.id = 'narrative-overlay'
      el.style.cssText = `
        position:fixed; inset:0; pointer-events:none; z-index:5;
        overflow:hidden;
      `
      document.body.appendChild(el)
    }
    this.container = el
    this.scheduleNext()
  }

  setMood(mood: NarrativeMood) {
    this.mood = mood
  }

  start() {
    this.running = true
    this.container.style.display = 'block'
    this.scheduleNext()
  }

  stop() {
    this.running = false
    this.container.style.display = 'none'
    for (const el of this.active) el.remove()
    this.active = []
  }

  update(dt: number) {
    if (!this.running) return
    this.timer -= dt
    if (this.timer <= 0) {
      this.spawnParagraph()
      this.scheduleNext()
    }
  }

  private scheduleNext() {
    this.nextInterval = 12 + Math.random() * 8   // 12–20s
    this.timer = this.nextInterval
  }

  private pickText(): string {
    const pool = PARAGRAPHS[this.mood]
    if (!this.usedIndices[this.mood]) this.usedIndices[this.mood] = new Set()
    const used = this.usedIndices[this.mood]!
    // Reset if we've used most of the pool
    if (used.size >= pool.length - 1) used.clear()
    let idx: number
    do { idx = Math.floor(Math.random() * pool.length) } while (used.has(idx))
    used.add(idx)
    return pool[idx]
  }

  private spawnParagraph() {
    // Max 2 visible at once
    while (this.active.length >= 2) {
      const old = this.active.shift()
      old?.remove()
    }

    const text = this.pickText()
    const edge: Edge = (['top', 'right', 'bottom', 'left'] as Edge[])[Math.floor(Math.random() * 4)]
    const el = document.createElement('p')
    el.textContent = text

    const isFunnel = this.mood === 'funnel'
    const fontSize = isFunnel ? '13px' : '11px'
    const color = isFunnel
      ? 'rgba(255,100,50,0.45)'
      : this.mood === 'collapsed'
      ? 'rgba(180,120,80,0.3)'
      : this.mood === 'survived'
      ? 'rgba(100,255,180,0.35)'
      : 'rgba(255,255,255,0.22)'

    const duration = isFunnel ? '18s' : '28s'

    const base = `
      position:absolute; white-space:nowrap;
      font-family:'Courier New',monospace; font-size:${fontSize};
      letter-spacing:.14em; color:${color}; pointer-events:none;
    `

    switch (edge) {
      case 'top':
        el.style.cssText = `${base}
          top:14px; left:0;
          animation:narrativeScrollRight ${duration} linear forwards;`
        break
      case 'bottom':
        el.style.cssText = `${base}
          bottom:14px; left:0;
          animation:narrativeScrollLeft ${duration} linear forwards;`
        break
      case 'left':
        el.style.cssText = `${base}
          left:14px; top:0; writing-mode:vertical-rl;
          animation:narrativeScrollDown ${duration} linear forwards;`
        break
      case 'right':
        el.style.cssText = `${base}
          right:14px; top:0; writing-mode:vertical-rl;
          animation:narrativeScrollUp ${duration} linear forwards;`
        break
    }

    this.container.appendChild(el)
    this.active.push(el)

    // Auto-remove when animation ends
    el.addEventListener('animationend', () => {
      el.remove()
      const idx = this.active.indexOf(el)
      if (idx >= 0) this.active.splice(idx, 1)
    })
  }

  dispose() {
    this.stop()
    this.container.remove()
  }
}

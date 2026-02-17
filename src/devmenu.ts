// Dev Menu — full control panel for designing and tuning music

export interface MusicParams {
  energy: number      // 0-1: tempo, attack, density
  brightness: number  // 0-1: filter cutoff
  density: number     // 0-1: note probability
  movement: number    // 0-1: LFO speed, delay
}

export interface DevMenuCallbacks {
  onBPMChange?: (bpm: number) => void
  onSwingChange?: (swing: number) => void
  onPlay?: () => void
  onStop?: () => void
  onParamsChange?: (params: Partial<MusicParams>) => void
  onTrackToggle?: (track: string, enabled: boolean) => void
  onTrackLevel?: (track: string, level: number) => void
  onPreset?: (preset: 'fire' | 'water' | 'earth' | 'air') => void
  onMasterVolume?: (volume: number) => void
}

const TRACKS = ['kick', 'bass', 'hihat', 'perc', 'arp', 'pad', 'lead'] as const

export class DevMenu {
  private container: HTMLDivElement
  private visible = false
  private params: MusicParams = { energy: 0.5, brightness: 0.5, density: 0.5, movement: 0.5 }
  private bpm = 120
  private swing = 0
  private masterVolume = 0.8
  private trackStates: Record<string, boolean> = {}
  private trackLevels: Record<string, number> = {}
  private callbacks: DevMenuCallbacks

  constructor(callbacks: DevMenuCallbacks = {}) {
    this.callbacks = callbacks
    // Initialize track states
    TRACKS.forEach(t => {
      this.trackStates[t] = false
      this.trackLevels[t] = 1
    })
    this.container = this.buildUI()
    document.body.appendChild(this.container)
    this.setupKeyboardToggle()
  }

  private buildUI(): HTMLDivElement {
    const panel = document.createElement('div')
    panel.style.cssText = `
      position: fixed; top: 18px; right: 18px; width: 300px;
      background: rgba(0, 4, 12, 0.94); border: 1px solid rgba(100, 100, 140, 0.3);
      border-radius: 6px; font-family: 'Courier New', monospace; font-size: 10px;
      color: rgba(255, 255, 255, 0.75); display: none; z-index: 100;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5); max-height: 90vh; overflow-y: auto;
    `

    // Header
    const header = document.createElement('div')
    header.style.cssText = `
      padding: 10px 14px; border-bottom: 1px solid rgba(100, 100, 140, 0.2);
      display: flex; justify-content: space-between; align-items: center;
      letter-spacing: 0.14em; color: rgba(255, 255, 255, 0.5);
      position: sticky; top: 0; background: rgba(0, 4, 12, 0.98); z-index: 1;
    `
    header.innerHTML = `<span>MUSIC DEV</span><span style="cursor:pointer;color:rgba(255,255,255,0.3)" id="devmenu-close">[×]</span>`
    panel.appendChild(header)

    // Content
    const content = document.createElement('div')
    content.style.cssText = `padding: 12px 14px; display: flex; flex-direction: column; gap: 16px;`

    // Transport section
    content.appendChild(this.buildSection('Transport', [
      this.buildSlider('BPM', 60, 180, this.bpm, v => { this.bpm = v; this.callbacks.onBPMChange?.(v) }, v => String(Math.round(v))),
      this.buildSlider('Swing', 0, 0.5, this.swing, v => { this.swing = v; this.callbacks.onSwingChange?.(v) }, v => (v * 100).toFixed(0) + '%'),
      this.buildSlider('Master', 0, 1, this.masterVolume, v => { this.masterVolume = v; this.callbacks.onMasterVolume?.(v) }, v => (v * 100).toFixed(0) + '%'),
      this.buildButtons([
        { label: '▶ Play', onClick: () => this.callbacks.onPlay?.() },
        { label: '■ Stop', onClick: () => this.callbacks.onStop?.() },
      ]),
    ]))

    // Mix parameters section
    content.appendChild(this.buildSection('Mix Parameters', [
      this.buildSlider('Energy', 0, 1, this.params.energy, v => this.updateParam('energy', v)),
      this.buildSlider('Bright', 0, 1, this.params.brightness, v => this.updateParam('brightness', v)),
      this.buildSlider('Density', 0, 1, this.params.density, v => this.updateParam('density', v)),
      this.buildSlider('Movement', 0, 1, this.params.movement, v => this.updateParam('movement', v)),
    ]))

    // Tracks section
    content.appendChild(this.buildSection('Tracks', [
      this.buildTrackControls(),
    ]))

    // Presets section
    content.appendChild(this.buildSection('Element Presets', [
      this.buildPresetButtons(),
    ]))

    panel.appendChild(content)

    // Close button handler
    setTimeout(() => {
      panel.querySelector('#devmenu-close')?.addEventListener('click', () => this.hide())
    }, 0)

    return panel
  }

  private buildSection(title: string, children: HTMLElement[]): HTMLElement {
    const section = document.createElement('div')
    section.style.cssText = `display: flex; flex-direction: column; gap: 8px;`

    const header = document.createElement('div')
    header.style.cssText = `
      color: rgba(255, 255, 255, 0.4); letter-spacing: 0.12em;
      font-size: 9px; text-transform: uppercase; margin-bottom: 2px;
    `
    header.textContent = `▸ ${title}`
    section.appendChild(header)

    children.forEach(c => section.appendChild(c))
    return section
  }

  private buildSlider(
    label: string,
    min: number,
    max: number,
    value: number,
    onChange: (v: number) => void,
    format: (v: number) => string = v => v.toFixed(2)
  ): HTMLElement {
    const row = document.createElement('div')
    row.style.cssText = `display: flex; align-items: center; gap: 8px;`

    const labelEl = document.createElement('span')
    labelEl.style.cssText = `width: 55px; color: rgba(255, 255, 255, 0.55);`
    labelEl.textContent = label

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(min)
    slider.max = String(max)
    slider.step = String((max - min) / 100)
    slider.value = String(value)
    slider.style.cssText = `
      flex: 1; height: 4px; -webkit-appearance: none; background: rgba(100, 100, 140, 0.3);
      border-radius: 2px; outline: none; cursor: pointer;
    `

    const valueEl = document.createElement('span')
    valueEl.style.cssText = `width: 40px; text-align: right; color: rgba(255, 255, 255, 0.65);`
    valueEl.textContent = format(value)

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value)
      valueEl.textContent = format(v)
      onChange(v)
    })

    row.appendChild(labelEl)
    row.appendChild(slider)
    row.appendChild(valueEl)
    return row
  }

  private buildButtons(buttons: { label: string; onClick: () => void }[]): HTMLElement {
    const row = document.createElement('div')
    row.style.cssText = `display: flex; gap: 8px; margin-top: 4px;`

    buttons.forEach(({ label, onClick }) => {
      const btn = document.createElement('button')
      btn.style.cssText = `
        flex: 1; padding: 6px 12px; background: rgba(60, 60, 100, 0.3);
        border: 1px solid rgba(100, 100, 140, 0.3); border-radius: 3px;
        color: rgba(255, 255, 255, 0.65); cursor: pointer; font-family: inherit;
        font-size: 10px; letter-spacing: 0.08em; transition: all 0.15s;
      `
      btn.textContent = label
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(80, 80, 140, 0.4)'
        btn.style.borderColor = 'rgba(140, 140, 180, 0.5)'
      })
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(60, 60, 100, 0.3)'
        btn.style.borderColor = 'rgba(100, 100, 140, 0.3)'
      })
      btn.addEventListener('click', onClick)
      row.appendChild(btn)
    })

    return row
  }

  private buildTrackControls(): HTMLElement {
    const container = document.createElement('div')
    container.style.cssText = `display: flex; flex-direction: column; gap: 6px;`

    TRACKS.forEach(track => {
      const row = document.createElement('div')
      row.style.cssText = `display: flex; align-items: center; gap: 8px;`

      // Toggle button
      const toggle = document.createElement('button')
      toggle.style.cssText = `
        width: 20px; height: 20px; border-radius: 3px; border: 1px solid rgba(100, 100, 140, 0.4);
        background: rgba(40, 40, 80, 0.3); color: rgba(255, 255, 255, 0.5);
        cursor: pointer; font-size: 10px; padding: 0; transition: all 0.15s;
      `
      toggle.textContent = '○'
      toggle.addEventListener('click', () => {
        this.trackStates[track] = !this.trackStates[track]
        toggle.textContent = this.trackStates[track] ? '●' : '○'
        toggle.style.background = this.trackStates[track] ? 'rgba(80, 120, 80, 0.5)' : 'rgba(40, 40, 80, 0.3)'
        toggle.style.color = this.trackStates[track] ? 'rgba(120, 255, 120, 0.9)' : 'rgba(255, 255, 255, 0.5)'
        this.callbacks.onTrackToggle?.(track, this.trackStates[track])
      })

      // Track name
      const label = document.createElement('span')
      label.style.cssText = `width: 40px; color: rgba(255, 255, 255, 0.55); text-transform: uppercase; font-size: 9px;`
      label.textContent = track

      // Level slider
      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = '0'
      slider.max = '1'
      slider.step = '0.01'
      slider.value = '1'
      slider.style.cssText = `
        flex: 1; height: 3px; -webkit-appearance: none; background: rgba(100, 100, 140, 0.3);
        border-radius: 2px; outline: none; cursor: pointer;
      `
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value)
        this.trackLevels[track] = v
        this.callbacks.onTrackLevel?.(track, v)
      })

      row.appendChild(toggle)
      row.appendChild(label)
      row.appendChild(slider)
      container.appendChild(row)
    })

    return container
  }

  private buildPresetButtons(): HTMLElement {
    const row = document.createElement('div')
    row.style.cssText = `display: flex; gap: 6px;`

    const presets: { key: 'fire' | 'water' | 'earth' | 'air'; color: string }[] = [
      { key: 'fire', color: '#ff5500' },
      { key: 'water', color: '#0088ff' },
      { key: 'earth', color: '#44aa22' },
      { key: 'air', color: '#88bbff' },
    ]

    presets.forEach(({ key, color }) => {
      const btn = document.createElement('button')
      btn.style.cssText = `
        flex: 1; padding: 6px 8px; background: ${color}15;
        border: 1px solid ${color}44; border-radius: 3px;
        color: ${color}; cursor: pointer; font-family: inherit;
        font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
        transition: all 0.15s;
      `
      btn.textContent = key
      btn.addEventListener('mouseenter', () => {
        btn.style.background = `${color}30`
        btn.style.borderColor = color
      })
      btn.addEventListener('mouseleave', () => {
        btn.style.background = `${color}15`
        btn.style.borderColor = `${color}44`
      })
      btn.addEventListener('click', () => this.callbacks.onPreset?.(key))
      row.appendChild(btn)
    })

    return row
  }

  private updateParam(key: keyof MusicParams, value: number) {
    this.params[key] = value
    this.callbacks.onParamsChange?.({ [key]: value })
  }

  private setupKeyboardToggle() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
        e.preventDefault()
        this.toggle()
      }
    })
  }

  toggle() {
    this.visible ? this.hide() : this.show()
  }

  show() {
    this.visible = true
    this.container.style.display = 'block'
  }

  hide() {
    this.visible = false
    this.container.style.display = 'none'
  }

  isVisible(): boolean {
    return this.visible
  }

  setParams(params: Partial<MusicParams>) {
    Object.assign(this.params, params)
  }

  setBPM(bpm: number) {
    this.bpm = bpm
  }

  /** Update track toggle UI state */
  setTrackState(track: string, enabled: boolean) {
    this.trackStates[track] = enabled
  }

  dispose() {
    this.container.remove()
  }
}

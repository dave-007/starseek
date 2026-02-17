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
  onTrackParamsChange?: (track: string, params: Partial<MusicParams>) => void
  onTrackToggle?: (track: string, enabled: boolean) => void
  onTrackLevel?: (track: string, level: number) => void
  onPreset?: (preset: 'fire' | 'water' | 'earth' | 'air') => { bpm: number; swing: number } | void
  onMasterVolume?: (volume: number) => void
  onTrackSelect?: (track: string) => MusicParams | void
}

const TRACKS = ['kick', 'bass', 'hihat', 'perc', 'arp', 'pad', 'lead'] as const
type TrackName = typeof TRACKS[number]

const DEFAULT_PARAMS: MusicParams = { energy: 0.5, brightness: 0.5, density: 0.5, movement: 0.5 }

export class DevMenu {
  private container: HTMLDivElement
  private visible = false
  private mouseOver = false
  private bpm = 120
  private swing = 0
  private masterVolume = 0.8
  private trackStates: Record<string, boolean> = {}
  private trackLevels: Record<string, number> = {}
  private trackParams: Record<string, MusicParams> = {}
  private selectedTrack: TrackName = 'kick'
  private trackToggleButtons: Map<string, HTMLButtonElement> = new Map()
  private trackNameLabels: Map<string, HTMLSpanElement> = new Map()
  private trackLevelSliders: Map<string, HTMLInputElement> = new Map()
  private paramSliders: Map<keyof MusicParams, { slider: HTMLInputElement; valueEl: HTMLSpanElement }> = new Map()
  private bpmSlider: { slider: HTMLInputElement; valueEl: HTMLSpanElement } | null = null
  private swingSlider: { slider: HTMLInputElement; valueEl: HTMLSpanElement } | null = null
  private selectedTrackLabel: HTMLSpanElement | null = null
  private callbacks: DevMenuCallbacks

  constructor(callbacks: DevMenuCallbacks = {}) {
    this.callbacks = callbacks
    // Initialize track states - all off, levels at 50%
    TRACKS.forEach(t => {
      this.trackStates[t] = false
      this.trackLevels[t] = 0.5
      this.trackParams[t] = { ...DEFAULT_PARAMS }
    })
    this.container = this.buildUI()
    document.body.appendChild(this.container)
    this.setupKeyboardToggle()
    this.setupMouseTracking()
  }

  private setupMouseTracking() {
    this.container.addEventListener('mouseenter', () => {
      this.mouseOver = true
    })
    this.container.addEventListener('mouseleave', () => {
      this.mouseOver = false
    })
  }

  /** Check if the mouse is currently over the menu */
  isMouseOver(): boolean {
    return this.visible && this.mouseOver
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
      this.buildSliderWithRef('BPM', 60, 180, this.bpm, (v, refs) => {
        this.bpm = v
        this.bpmSlider = refs
        this.callbacks.onBPMChange?.(v)
      }, v => String(Math.round(v))),
      this.buildSliderWithRef('Swing', 0, 0.5, this.swing, (v, refs) => {
        this.swing = v
        this.swingSlider = refs
        this.callbacks.onSwingChange?.(v)
      }, v => (v * 100).toFixed(0) + '%'),
      this.buildSlider('Master', 0, 1, this.masterVolume, v => { this.masterVolume = v; this.callbacks.onMasterVolume?.(v) }, v => (v * 100).toFixed(0) + '%'),
      this.buildButtons([
        { label: '▶ Play', onClick: () => this.callbacks.onPlay?.() },
        { label: '■ Stop', onClick: () => this.callbacks.onStop?.() },
      ]),
    ]))

    // Mix parameters section - shows params for selected track
    content.appendChild(this.buildSection('Track Parameters', [
      this.buildSelectedTrackHeader(),
      this.buildParamSlider('Energy', 'energy'),
      this.buildParamSlider('Bright', 'brightness'),
      this.buildParamSlider('Density', 'density'),
      this.buildParamSlider('Movement', 'movement'),
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

  private buildSelectedTrackHeader(): HTMLElement {
    const row = document.createElement('div')
    row.style.cssText = `display: flex; align-items: center; gap: 8px; margin-bottom: 4px;`

    const label = document.createElement('span')
    label.style.cssText = `color: rgba(255, 255, 255, 0.4); font-size: 9px;`
    label.textContent = 'Controlling:'

    this.selectedTrackLabel = document.createElement('span')
    this.selectedTrackLabel.style.cssText = `
      color: rgba(120, 180, 255, 0.9); font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.1em; font-weight: bold;
    `
    this.selectedTrackLabel.textContent = this.selectedTrack

    row.appendChild(label)
    row.appendChild(this.selectedTrackLabel)
    return row
  }

  private buildParamSlider(label: string, key: keyof MusicParams): HTMLElement {
    const row = document.createElement('div')
    row.style.cssText = `display: flex; align-items: center; gap: 8px;`

    const labelEl = document.createElement('span')
    labelEl.style.cssText = `width: 55px; color: rgba(255, 255, 255, 0.55);`
    labelEl.textContent = label

    const value = this.trackParams[this.selectedTrack][key]

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = '1'
    slider.step = '0.01'
    slider.value = String(value)
    slider.style.cssText = `
      flex: 1; height: 4px; -webkit-appearance: none; background: rgba(100, 100, 140, 0.3);
      border-radius: 2px; outline: none; cursor: pointer;
    `

    const valueEl = document.createElement('span')
    valueEl.style.cssText = `width: 40px; text-align: right; color: rgba(255, 255, 255, 0.65);`
    valueEl.textContent = value.toFixed(2)

    this.paramSliders.set(key, { slider, valueEl })

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value)
      valueEl.textContent = v.toFixed(2)
      this.trackParams[this.selectedTrack][key] = v
      this.callbacks.onTrackParamsChange?.(this.selectedTrack, { [key]: v })
    })

    row.appendChild(labelEl)
    row.appendChild(slider)
    row.appendChild(valueEl)
    return row
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

  private buildSliderWithRef(
    label: string,
    min: number,
    max: number,
    value: number,
    onChange: (v: number, refs: { slider: HTMLInputElement; valueEl: HTMLSpanElement }) => void,
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

    // Store refs on first call
    setTimeout(() => onChange(value, { slider, valueEl }), 0)

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value)
      valueEl.textContent = format(v)
      onChange(v, { slider, valueEl })
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

      // Toggle button (on/off)
      const toggle = document.createElement('button')
      toggle.style.cssText = `
        width: 20px; height: 20px; border-radius: 3px; border: 1px solid rgba(100, 100, 140, 0.4);
        background: rgba(40, 40, 80, 0.3); color: rgba(255, 255, 255, 0.5);
        cursor: pointer; font-size: 10px; padding: 0; transition: all 0.15s;
      `
      toggle.textContent = '○'
      this.trackToggleButtons.set(track, toggle)
      toggle.addEventListener('click', (e) => {
        e.stopPropagation()
        this.trackStates[track] = !this.trackStates[track]
        this.updateToggleButtonVisual(toggle, this.trackStates[track])
        this.callbacks.onTrackToggle?.(track, this.trackStates[track])
      })

      // Track name (clickable to select)
      const label = document.createElement('span')
      const isSelected = track === this.selectedTrack
      label.style.cssText = `
        width: 40px; text-transform: uppercase; font-size: 9px; cursor: pointer;
        transition: all 0.15s; padding: 2px 4px; border-radius: 2px;
        ${isSelected ? 'color: rgba(120, 180, 255, 0.9); background: rgba(60, 100, 180, 0.3);' : 'color: rgba(255, 255, 255, 0.55);'}
      `
      label.textContent = track
      this.trackNameLabels.set(track, label)

      label.addEventListener('click', () => {
        this.selectTrack(track)
      })
      label.addEventListener('mouseenter', () => {
        if (track !== this.selectedTrack) {
          label.style.color = 'rgba(180, 200, 255, 0.8)'
        }
      })
      label.addEventListener('mouseleave', () => {
        if (track !== this.selectedTrack) {
          label.style.color = 'rgba(255, 255, 255, 0.55)'
          label.style.background = 'transparent'
        }
      })

      // Level slider
      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = '0'
      slider.max = '1'
      slider.step = '0.01'
      slider.value = String(this.trackLevels[track])
      slider.style.cssText = `
        flex: 1; height: 3px; -webkit-appearance: none; background: rgba(100, 100, 140, 0.3);
        border-radius: 2px; outline: none; cursor: pointer;
      `
      this.trackLevelSliders.set(track, slider)
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

  private selectTrack(track: TrackName) {
    // Update visual for previous selection
    const prevLabel = this.trackNameLabels.get(this.selectedTrack)
    if (prevLabel) {
      prevLabel.style.color = 'rgba(255, 255, 255, 0.55)'
      prevLabel.style.background = 'transparent'
    }

    // Update to new selection
    this.selectedTrack = track
    const newLabel = this.trackNameLabels.get(track)
    if (newLabel) {
      newLabel.style.color = 'rgba(120, 180, 255, 0.9)'
      newLabel.style.background = 'rgba(60, 100, 180, 0.3)'
    }

    // Update header
    if (this.selectedTrackLabel) {
      this.selectedTrackLabel.textContent = track
    }

    // Get params from engine if callback provided
    const engineParams = this.callbacks.onTrackSelect?.(track)
    if (engineParams) {
      this.trackParams[track] = { ...engineParams }
    }

    // Update parameter sliders
    this.updateParamSliders()
  }

  private updateParamSliders() {
    const params = this.trackParams[this.selectedTrack]
    for (const [key, refs] of this.paramSliders) {
      const value = params[key]
      refs.slider.value = String(value)
      refs.valueEl.textContent = value.toFixed(2)
    }
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
      btn.addEventListener('click', () => {
        const result = this.callbacks.onPreset?.(key)
        if (result) {
          this.updateTransportSliders(result.bpm, result.swing)
        }
      })
      row.appendChild(btn)
    })

    return row
  }

  private updateTransportSliders(bpm: number, swing: number) {
    this.bpm = bpm
    this.swing = swing
    if (this.bpmSlider) {
      this.bpmSlider.slider.value = String(bpm)
      this.bpmSlider.valueEl.textContent = String(Math.round(bpm))
    }
    if (this.swingSlider) {
      this.swingSlider.slider.value = String(swing)
      this.swingSlider.valueEl.textContent = (swing * 100).toFixed(0) + '%'
    }
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

  /** Update track toggle UI state and visual */
  setTrackState(track: string, enabled: boolean) {
    this.trackStates[track] = enabled
    const toggle = this.trackToggleButtons.get(track)
    if (toggle) {
      this.updateToggleButtonVisual(toggle, enabled)
    }
  }

  /** Update track params from external source */
  setTrackParams(track: string, params: MusicParams) {
    this.trackParams[track] = { ...params }
    if (track === this.selectedTrack) {
      this.updateParamSliders()
    }
  }

  /** Update BPM slider from external source */
  setBPM(bpm: number) {
    this.bpm = bpm
    if (this.bpmSlider) {
      this.bpmSlider.slider.value = String(bpm)
      this.bpmSlider.valueEl.textContent = String(Math.round(bpm))
    }
  }

  /** Update swing slider from external source */
  setSwing(swing: number) {
    this.swing = swing
    if (this.swingSlider) {
      this.swingSlider.slider.value = String(swing)
      this.swingSlider.valueEl.textContent = (swing * 100).toFixed(0) + '%'
    }
  }

  /** Update track level slider from external source */
  setTrackLevel(track: string, level: number) {
    this.trackLevels[track] = level
    const slider = this.trackLevelSliders.get(track)
    if (slider) {
      slider.value = String(level)
    }
  }

  private updateToggleButtonVisual(toggle: HTMLButtonElement, enabled: boolean) {
    toggle.textContent = enabled ? '●' : '○'
    toggle.style.background = enabled ? 'rgba(80, 120, 80, 0.5)' : 'rgba(40, 40, 80, 0.3)'
    toggle.style.color = enabled ? 'rgba(120, 255, 120, 0.9)' : 'rgba(255, 255, 255, 0.5)'
  }

  dispose() {
    this.container.remove()
  }
}

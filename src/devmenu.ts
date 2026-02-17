// Dev Menu — toggleable panel for tuning music parameters

export interface DevMenuCallbacks {
  onBPMChange?: (bpm: number) => void
  onPlay?: () => void
  onStop?: () => void
}

export class DevMenu {
  private container: HTMLDivElement
  private visible = false
  private bpm = 120
  private callbacks: DevMenuCallbacks

  constructor(callbacks: DevMenuCallbacks = {}) {
    this.callbacks = callbacks
    this.container = this.buildUI()
    document.body.appendChild(this.container)
    this.setupKeyboardToggle()
  }

  private buildUI(): HTMLDivElement {
    const panel = document.createElement('div')
    panel.style.cssText = `
      position: fixed; top: 18px; right: 18px; width: 240px;
      background: rgba(0, 4, 12, 0.92); border: 1px solid rgba(100, 100, 140, 0.3);
      border-radius: 6px; font-family: 'Courier New', monospace; font-size: 10px;
      color: rgba(255, 255, 255, 0.75); display: none; z-index: 100;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    `

    // Header
    const header = document.createElement('div')
    header.style.cssText = `
      padding: 10px 14px; border-bottom: 1px solid rgba(100, 100, 140, 0.2);
      display: flex; justify-content: space-between; align-items: center;
      letter-spacing: 0.14em; color: rgba(255, 255, 255, 0.5);
    `
    header.innerHTML = `<span>DEV MENU</span><span style="cursor:pointer;color:rgba(255,255,255,0.3)" id="devmenu-close">[×]</span>`
    panel.appendChild(header)

    // Content
    const content = document.createElement('div')
    content.style.cssText = `padding: 12px 14px; display: flex; flex-direction: column; gap: 12px;`

    // Transport section
    content.appendChild(this.buildSection('Transport', [
      this.buildSlider('BPM', 60, 180, this.bpm, v => { this.bpm = v; this.callbacks.onBPMChange?.(v) }, v => String(Math.round(v))),
      this.buildButtons([
        { label: '▶ Play', onClick: () => this.callbacks.onPlay?.() },
        { label: '■ Stop', onClick: () => this.callbacks.onStop?.() },
      ]),
    ]))

    // Instructions
    const instructions = document.createElement('div')
    instructions.style.cssText = `
      color: rgba(255, 255, 255, 0.35); font-size: 9px; line-height: 1.5;
      border-top: 1px solid rgba(100, 100, 140, 0.15); padding-top: 10px; margin-top: 4px;
    `
    instructions.innerHTML = `
      <div style="margin-bottom: 6px; color: rgba(255,255,255,0.5);">Controls:</div>
      <div>• Move mouse near orbits to fade tracks in/out</div>
      <div>• Press \` to toggle this menu</div>
    `
    content.appendChild(instructions)

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
    labelEl.style.cssText = `width: 50px; color: rgba(255, 255, 255, 0.55);`
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
    valueEl.style.cssText = `width: 35px; text-align: right; color: rgba(255, 255, 255, 0.65);`
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

  setBPM(bpm: number) {
    this.bpm = bpm
  }

  dispose() {
    this.container.remove()
  }
}

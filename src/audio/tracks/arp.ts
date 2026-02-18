// Arp Track - arpeggiated synth pattern

import * as Tone from 'tone'
import type { Track, TrackParams } from './index'
import { DEFAULT_TRACK_PARAMS } from './index'
import { SCALES, midiToFreq } from '../scales'

export class ArpTrack implements Track {
  private synth: Tone.PolySynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private filter: Tone.Filter
  private muted = true
  private baseGain = 0.25
  private level = 1
  private scale = SCALES.pentatonicMinor
  private root = 60 // C4
  private params: TrackParams = { ...DEFAULT_TRACK_PARAMS }

  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0)
    this.gain.connect(output)

    this.filter = new Tone.Filter({
      frequency: 3000,
      type: 'lowpass',
      rolloff: -12,
    })
    this.filter.connect(this.gain)

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.2,
        release: 0.3,
      },
    })
    this.synth.connect(this.filter)
  }

  start() {
    if (this.sequence) return

    // Build arp pattern from scale
    const notes = this.scale.slice(0, 4).map(n => this.root + n)
    // Rising and falling arp
    const pattern = [
      notes[0], notes[1], notes[2], notes[3],
      notes[3], notes[2], notes[1], notes[0],
      notes[0], notes[2], notes[1], notes[3],
      notes[2], notes[0], notes[3], notes[1],
    ]

    this.sequence = new Tone.Sequence(
      (time, note) => {
        if (this.muted) return
        // Density affects whether note plays
        if (Math.random() > this.params.density * 1.1 + 0.45) return
        // Energy affects velocity
        const velocity = 0.3 + this.params.energy * 0.5
        this.synth.triggerAttackRelease(midiToFreq(note), '32n', time, velocity)
      },
      pattern,
      '16n'
    )
    this.sequence.start(0)
  }

  stop() {
    this.sequence?.stop()
    this.sequence?.dispose()
    this.sequence = null
    this.synth.releaseAll()
  }

  setScale(scale: number[], root: number) {
    this.scale = scale
    this.root = root
    if (this.sequence) {
      this.stop()
      this.start()
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.updateGain()
    if (muted) this.synth.releaseAll()
  }

  isMuted() {
    return this.muted
  }

  setLevel(level: number) {
    this.level = Math.max(0, Math.min(1, level))
    this.updateGain()
  }

  setParams(params: Partial<TrackParams>) {
    Object.assign(this.params, params)
    // Brightness affects filter cutoff
    this.filter.frequency.linearRampTo(1000 + this.params.brightness * 5000, 0.1)
    // Movement could affect detune or other modulation (simplified here)
  }

  getParams(): TrackParams {
    return { ...this.params }
  }

  private updateGain() {
    const target = this.muted ? 0 : this.baseGain * this.level
    this.gain.gain.linearRampTo(target, 0.08)
  }

  dispose() {
    this.stop()
    this.synth.dispose()
    this.filter.dispose()
    this.gain.dispose()
  }
}

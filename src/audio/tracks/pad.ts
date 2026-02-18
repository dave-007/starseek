// Pad Track - sustained chords

import * as Tone from 'tone'
import type { Track, TrackParams } from './index'
import { DEFAULT_TRACK_PARAMS } from './index'
import { SCALES, midiToFreq } from '../scales'

export class PadTrack implements Track {
  private synth: Tone.PolySynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private filter: Tone.Filter
  private lfo: Tone.LFO
  private muted = true
  private baseGain = 0.2
  private level = 1
  private scale = SCALES.pentatonicMinor
  private root = 48 // C3
  private params: TrackParams = { ...DEFAULT_TRACK_PARAMS }

  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0)
    this.gain.connect(output)

    this.filter = new Tone.Filter({
      frequency: 2000,
      type: 'lowpass',
      rolloff: -12,
    })
    this.filter.connect(this.gain)

    // LFO for movement parameter
    this.lfo = new Tone.LFO({
      frequency: 0.5,
      min: 800,
      max: 2500,
    })
    this.lfo.connect(this.filter.frequency)
    this.lfo.start()

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.5,
        decay: 0.3,
        sustain: 0.6,
        release: 1.0,
      },
    })
    this.synth.connect(this.filter)
  }

  start() {
    if (this.sequence) return

    // Play chord every 2 bars
    const chord1 = [this.root, this.root + this.scale[2], this.root + this.scale[4]]
    const chord2 = [this.root + this.scale[1], this.root + this.scale[3], this.root + 12]

    const pattern = [chord1, null, null, null, null, null, null, null,
                     chord2, null, null, null, null, null, null, null]

    this.sequence = new Tone.Sequence(
      (time, chord: number[] | null) => {
        if (this.muted || !chord) return
        const freqs = chord.map((n: number) => midiToFreq(n))
        this.synth.triggerAttackRelease(freqs, '2n', time, 0.4)
      },
      pattern,
      '8n'
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
    // Brightness affects filter cutoff range
    const minFreq = 500 + this.params.brightness * 800
    const maxFreq = 1500 + this.params.brightness * 3000
    this.lfo.min = minFreq
    this.lfo.max = maxFreq
    // Movement affects LFO speed
    this.lfo.frequency.linearRampTo(0.1 + this.params.movement * 1.5, 0.1)
    // Energy affects attack
    // Note: PolySynth doesn't have direct envelope access after creation, so we skip this
  }

  getParams(): TrackParams {
    return { ...this.params }
  }

  private updateGain() {
    const target = this.muted ? 0 : this.baseGain * this.level
    this.gain.gain.linearRampTo(target, 0.12)
  }

  dispose() {
    this.stop()
    this.synth.dispose()
    this.filter.dispose()
    this.lfo.dispose()
    this.gain.dispose()
  }
}

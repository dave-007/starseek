// Bass Track - driving bassline

import * as Tone from 'tone'
import type { Track, TrackParams } from './index'
import { DEFAULT_TRACK_PARAMS } from './index'
import { SCALES, midiToFreq } from '../scales'

export class BassTrack implements Track {
  private synth: Tone.MonoSynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private muted = true
  private baseGain = 0.5
  private level = 1
  private scale = SCALES.pentatonicMinor
  private root = 36 // C2
  private params: TrackParams = { ...DEFAULT_TRACK_PARAMS }

  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0)
    this.gain.connect(output)

    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: {
        Q: 3,
        type: 'lowpass',
        rolloff: -24,
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.2,
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.2,
        baseFrequency: 100,
        octaves: 2.5,
      },
    })
    this.synth.connect(this.gain)
  }

  start() {
    if (this.sequence) return

    // Driving bassline pattern - root and fifth
    const r = this.root
    const fifth = this.root + 7
    const pattern = [
      r, null, r, null, r, null, fifth, null,
      r, null, r, null, fifth, null, r, null,
    ]

    this.sequence = new Tone.Sequence(
      (time, note) => {
        if (this.muted || note === null) return
        // Density affects whether note plays
        if (Math.random() > this.params.density * 1.3 + 0.35) return
        this.synth.triggerAttackRelease(midiToFreq(note), '16n', time)
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
  }

  setScale(scale: number[], root: number) {
    this.scale = scale
    this.root = root
    // Rebuild sequence if running
    if (this.sequence) {
      this.stop()
      this.start()
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.updateGain()
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
    // Energy affects envelope
    const attack = 0.001 + (1 - this.params.energy) * 0.05
    const decay = 0.1 + (1 - this.params.energy) * 0.2
    this.synth.envelope.attack = attack
    this.synth.envelope.decay = decay
    // Brightness affects filter
    const baseFreq = 50 + this.params.brightness * 200
    const octaves = 1 + this.params.brightness * 3
    this.synth.filterEnvelope.baseFrequency = baseFreq
    this.synth.filterEnvelope.octaves = octaves
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
    this.gain.dispose()
  }
}

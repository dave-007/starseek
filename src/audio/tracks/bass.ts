// Bass Track - driving bassline

import * as Tone from 'tone'
import type { Track } from './index'
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

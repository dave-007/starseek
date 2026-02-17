// Hi-Hat Track - driving eighth notes

import * as Tone from 'tone'
import type { Track } from './index'

export class HiHatTrack implements Track {
  private synth: Tone.MetalSynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private muted = true
  private baseGain = 0.15
  private level = 1

  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0)
    this.gain.connect(output)

    this.synth = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.08,
        release: 0.01,
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    })
    this.synth.connect(this.gain)
  }

  start() {
    if (this.sequence) return

    // Driving eighths with accents
    const pattern = [0.8, 0.4, 0.8, 0.4, 0.8, 0.4, 0.8, 0.4,
                     0.8, 0.4, 0.8, 0.4, 0.8, 0.4, 0.8, 0.6]

    this.sequence = new Tone.Sequence(
      (time, vel) => {
        if (this.muted) return
        this.synth.triggerAttackRelease('16n', time, vel)
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

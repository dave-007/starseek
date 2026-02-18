// Hi-Hat Track - driving eighth notes

import * as Tone from 'tone'
import type { Track, TrackParams } from './index'
import { DEFAULT_TRACK_PARAMS } from './index'

export class HiHatTrack implements Track {
  private synth: Tone.MetalSynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private muted = true
  private baseGain = 0.15
  private level = 1
  private params: TrackParams = { ...DEFAULT_TRACK_PARAMS }

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
        // Density affects whether note plays
        if (Math.random() > this.params.density * 1.2 + 0.4) return
        // Energy affects velocity
        const velocity = vel * (0.5 + this.params.energy * 0.5)
        this.synth.triggerAttackRelease('16n', time, velocity)
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

  setParams(params: Partial<TrackParams>) {
    Object.assign(this.params, params)
    // Energy affects decay
    const decay = 0.03 + (1 - this.params.energy) * 0.1
    this.synth.envelope.decay = decay
    // Brightness affects resonance
    this.synth.resonance = 2000 + this.params.brightness * 6000
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

// Kick Track - four-on-the-floor foundation

import * as Tone from 'tone'
import type { Track, TrackParams } from './index'
import { DEFAULT_TRACK_PARAMS } from './index'

export class KickTrack implements Track {
  private synth: Tone.MembraneSynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private muted = true
  private baseGain = 0.7
  private level = 1
  private params: TrackParams = { ...DEFAULT_TRACK_PARAMS }

  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0)
    this.gain.connect(output)

    this.synth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0.01,
        release: 0.4,
      },
    })
    this.synth.connect(this.gain)
  }

  start() {
    if (this.sequence) return

    // Four-on-the-floor with variation
    const pattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]

    this.sequence = new Tone.Sequence(
      (time, hit) => {
        if (this.muted || !hit) return
        // Density affects whether note plays
        if (Math.random() > this.params.density * 1.5 + 0.25) return
        // Energy affects velocity
        const velocity = 0.5 + this.params.energy * 0.5
        this.synth.triggerAttackRelease('C1', '8n', time, velocity)
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
    const decay = 0.15 + (1 - this.params.energy) * 0.3
    this.synth.envelope.decay = decay
    // Brightness affects octaves (pitch sweep range)
    this.synth.octaves = 4 + this.params.brightness * 4
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

// Percussion Track - snare/clap on 2 and 4

import * as Tone from 'tone'
import type { Track, TrackParams } from './index'
import { DEFAULT_TRACK_PARAMS } from './index'

export class PercTrack implements Track {
  private noise: Tone.NoiseSynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private filter: Tone.Filter
  private muted = true
  private baseGain = 0.4
  private level = 1
  private params: TrackParams = { ...DEFAULT_TRACK_PARAMS }

  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0)
    this.gain.connect(output)

    this.filter = new Tone.Filter({
      frequency: 5000,
      type: 'highpass',
    })
    this.filter.connect(this.gain)

    this.noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.15,
        sustain: 0,
        release: 0.1,
      },
    })
    this.noise.connect(this.filter)
  }

  start() {
    if (this.sequence) return

    // Snare on 2 and 4
    const pattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]

    this.sequence = new Tone.Sequence(
      (time, hit) => {
        if (this.muted || !hit) return
        // Density affects whether note plays
        if (Math.random() > this.params.density * 1.5 + 0.25) return
        this.noise.triggerAttackRelease('16n', time)
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
    const decay = 0.08 + (1 - this.params.energy) * 0.15
    this.noise.envelope.decay = decay
    // Brightness affects filter
    this.filter.frequency.linearRampTo(2000 + this.params.brightness * 8000, 0.1)
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
    this.noise.dispose()
    this.filter.dispose()
    this.gain.dispose()
  }
}

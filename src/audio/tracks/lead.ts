// Lead Track - melodic lead synth

import * as Tone from 'tone'
import type { Track } from './index'
import { SCALES, midiToFreq } from '../scales'

export class LeadTrack implements Track {
  private synth: Tone.MonoSynth
  private sequence: Tone.Sequence | null = null
  private gain: Tone.Gain
  private delay: Tone.FeedbackDelay
  private muted = true
  private baseGain = 0.2
  private level = 1
  private scale = SCALES.pentatonicMinor
  private root = 72 // C5

  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0)
    this.gain.connect(output)

    this.delay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.3,
      wet: 0.3,
    })
    this.delay.connect(this.gain)

    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      filter: {
        Q: 2,
        type: 'lowpass',
        rolloff: -12,
      },
      envelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.4,
        release: 0.4,
      },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.3,
        sustain: 0.2,
        release: 0.3,
        baseFrequency: 400,
        octaves: 3,
      },
    })
    this.synth.connect(this.delay)
  }

  start() {
    if (this.sequence) return

    // Melodic pattern using scale
    const s = this.scale
    const r = this.root
    const pattern = [
      r + s[4], null, r + s[2], null, r + s[3], null, r + s[1], null,
      r + s[0], null, null, null, r + s[2], null, r + s[4], null,
      r + s[3], null, r + s[1], null, r + s[0], null, null, null,
      r + s[2], null, r + s[4], null, r + s[3], null, r + s[2], null,
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
    this.delay.dispose()
    this.gain.dispose()
  }
}

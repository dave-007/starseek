// Track system - each planet is a musical layer

import * as Tone from 'tone'

export interface TrackParams {
  energy: number      // 0-1: envelope attack/decay, velocity
  brightness: number  // 0-1: filter cutoff frequency
  density: number     // 0-1: note probability
  movement: number    // 0-1: modulation, delay wet
}

export const DEFAULT_TRACK_PARAMS: TrackParams = {
  energy: 0.5,
  brightness: 0.5,
  density: 0.5,
  movement: 0.5,
}

export interface Track {
  start(): void
  stop(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  setLevel(level: number): void  // 0-1 continuous volume control
  setParams(params: Partial<TrackParams>): void
  getParams(): TrackParams
  dispose(): void
}

export { KickTrack } from './kick'
export { HiHatTrack } from './hihat'
export { BassTrack } from './bass'
export { ArpTrack } from './arp'
export { PadTrack } from './pad'
export { PercTrack } from './perc'
export { LeadTrack } from './lead'

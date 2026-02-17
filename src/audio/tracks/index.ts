// Track system - each planet is a musical layer

import * as Tone from 'tone'

export interface Track {
  start(): void
  stop(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  setLevel(level: number): void  // 0-1 continuous volume control
  dispose(): void
}

export { KickTrack } from './kick'
export { HiHatTrack } from './hihat'
export { BassTrack } from './bass'
export { ArpTrack } from './arp'
export { PadTrack } from './pad'
export { PercTrack } from './perc'
export { LeadTrack } from './lead'

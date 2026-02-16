import * as THREE from 'three'
import { generateLifeStory } from './stories'

function makePRNG(seed: number) {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

const ELEMENT_PALETTES = {
  fire:  [0xff3300, 0xff7700, 0xffaa00, 0xff5500],
  water: [0x0055ff, 0x0099ff, 0x00ddff, 0x0077cc],
  earth: [0x44aa22, 0x886633, 0x559944, 0xaa8844],
  air:   [0xbbccff, 0xddeeff, 0xaabbdd, 0xeef0ff],
}
type Element = keyof typeof ELEMENT_PALETTES

const HOT_COLOR  = new THREE.Color(0xff4400)
const WARM_COLOR = new THREE.Color(0xffaa44)
const COLD_COLOR = new THREE.Color(0x4499ff)
const ICE_COLOR  = new THREE.Color(0x99ccff)

function tempTint(t: number): THREE.Color {
  if (t > 0.65) return HOT_COLOR.clone().lerp(WARM_COLOR, (1 - t) / 0.35)
  if (t > 0.35) return WARM_COLOR.clone().lerp(COLD_COLOR, (0.65 - t) / 0.3)
  return COLD_COLOR.clone().lerp(ICE_COLOR, (0.35 - t) / 0.35)
}

function tempLabel(t: number): string {
  if (t > 0.80) return 'Scorched'
  if (t > 0.60) return 'Hot World'
  if (t > 0.40) return 'Temperate'
  if (t > 0.20) return 'Cold World'
  return 'Frozen'
}

function makeOrbitLine(radius: number, color: THREE.Color): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.18 })
  )
}

export interface PlanetInfo {
  mesh:       THREE.Mesh
  rings:      THREE.Mesh[]
  baseColor:  THREE.Color
  tint:       THREE.Color
  tempNorm:   number         // 0 = coldest, 1 = hottest
  pulseSpeed: number
  label:      string
  ringTime:   number
  isGoldilocks: boolean
  lifeStory?: string         // only for Goldilocks planets
  goldilocksGlow?: THREE.Mesh
  glowTime:   number
}

export class SolarSystem {
  readonly group       = new THREE.Group()
  readonly star:         THREE.Mesh
  readonly planetInfos:  PlanetInfo[] = []

  private starGlow:      THREE.Mesh
  private starRings:     THREE.Mesh[] = []
  private starBaseColor: THREE.Color
  private sysPulseSpeed: number
  private starRingTime = 0

  private orbitAngles: number[] = []
  private orbitRadii:  number[] = []
  private orbitSpeeds: number[] = []
  private moonData:    { mesh: THREE.Mesh; dist: number; speed: number; angle: number }[][] = []

  constructor(seed: number, systemColor: THREE.Color, pulseSpeed: number) {
    // rand  → structure: star size, orbit radii, count
    // rand2 → appearance: element, colour, planet size, moons
    const rand  = makePRNG(seed)
    const rand2 = makePRNG(seed + 10000)

    this.sysPulseSpeed = pulseSpeed
    this.starBaseColor = systemColor.clone()

    // --- Star ---
    const starRadius = 0.28 + rand() * 0.28

    this.star = new THREE.Mesh(
      new THREE.SphereGeometry(starRadius, 32, 32),
      new THREE.MeshBasicMaterial({ color: systemColor.clone() })
    )
    this.group.add(this.star)

    this.starGlow = new THREE.Mesh(
      new THREE.SphereGeometry(starRadius * 2.2, 32, 32),
      new THREE.MeshBasicMaterial({ color: systemColor.clone(), transparent: true, opacity: 0.08, side: THREE.BackSide })
    )
    this.group.add(this.starGlow)

    for (let r = 0; r < 3; r++) {
      const ir = starRadius * 1.3
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(ir, ir * 1.5, 64),
        new THREE.MeshBasicMaterial({ color: systemColor.clone(), transparent: true, opacity: 0, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      this.group.add(ring)
      this.starRings.push(ring)
    }

    this.group.add(new THREE.PointLight(systemColor, 2.5, 40))
    this.group.add(new THREE.AmbientLight(0x111122, 0.6))

    // --- Compute orbit radii first so we know the range for temperature ---
    const count   = 3 + Math.floor(rand() * 6)
    const radii: number[] = []
    let orbitR = starRadius * 2.8 + 0.3
    for (let i = 0; i < count; i++) {
      orbitR += 0.45 + rand() * 0.85
      radii.push(orbitR)
    }
    const minR = radii[0], maxR = radii[count - 1]

    // --- Build planets ---
    const elements: Element[] = ['fire', 'water', 'earth', 'air']

    for (let i = 0; i < count; i++) {
      const r = radii[i]
      // Compress extremes toward 0.5 so most planets land in the goldilocks band
      const raw = count > 1 ? 1 - (r - minR) / (maxR - minR) : 0.5
      const tempNorm = 0.5 + (raw - 0.5) * 0.55  // range ≈ 0.23–0.78, centred on temperate
      const tint     = tempTint(tempNorm)

      const el       = elements[Math.floor(rand2() * 4)]
      const palette  = ELEMENT_PALETTES[el]
      const baseRaw  = new THREE.Color(palette[Math.floor(rand2() * palette.length)])
      const blend    = Math.abs(tempNorm - 0.5) * 0.9   // 0 at goldilocks, ~0.45 at extremes
      const displayC = baseRaw.clone().lerp(tint, blend)

      const size = 0.055 + rand2() * 0.14

      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 22, 22),
        new THREE.MeshStandardMaterial({
          color: displayC.clone(),
          roughness: 0.6 + rand2() * 0.35,
          metalness: rand2() * 0.25,
          emissive: displayC.clone(),
          emissiveIntensity: 0.06,
        })
      )
      this.group.add(planetMesh)
      this.group.add(makeOrbitLine(r, displayC))

      // Kepler: inner planets orbit faster (speed ∝ 1/√r)
      const keplerSpeed = 0.28 / Math.sqrt(r)

      // Moons
      const moonCount = rand2() > 0.55 ? 1 + Math.floor(rand2() * 2) : 0
      const moons: { mesh: THREE.Mesh; dist: number; speed: number; angle: number }[] = []
      for (let m = 0; m < moonCount; m++) {
        const md = size * 2.4 + rand2() * size * 2.8
        const ms = size * (0.12 + rand2() * 0.22)
        const moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(ms, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.9 })
        )
        moons.push({ mesh: moonMesh, dist: md, speed: 1.0 + rand2() * 2.5, angle: rand2() * Math.PI * 2 })
        planetMesh.add(moonMesh)
      }

      // Per-planet hover rings — temperature coloured, children of planet mesh
      const rings: THREE.Mesh[] = []
      for (let r2 = 0; r2 < 3; r2++) {
        const ir = size * 1.6
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(ir, ir * 1.45, 48),
          new THREE.MeshBasicMaterial({ color: tint.clone(), transparent: true, opacity: 0, side: THREE.DoubleSide })
        )
        ring.rotation.x = -Math.PI / 2
        planetMesh.add(ring)
        rings.push(ring)
      }

      // Goldilocks zone: tempNorm between 0.40 and 0.60
      const isGoldilocks = tempNorm >= 0.40 && tempNorm <= 0.60
      let goldilocksGlow: THREE.Mesh | undefined
      let lifeStory: string | undefined

      if (isGoldilocks) {
        // Persistent glow aura for habitable planets
        const glowSize = size * 1.8
        goldilocksGlow = new THREE.Mesh(
          new THREE.SphereGeometry(glowSize, 16, 16),
          new THREE.MeshBasicMaterial({
            color: 0x44ffaa,
            transparent: true,
            opacity: 0.12,
            side: THREE.BackSide,
          })
        )
        planetMesh.add(goldilocksGlow)

        // Generate a story fragment for this planet
        const storySeed = seed * 1000 + i * 7
        lifeStory = generateLifeStory(storySeed)
      }

      this.planetInfos.push({
        mesh: planetMesh,
        rings,
        baseColor: displayC.clone(),
        tint,
        tempNorm,
        pulseSpeed: 0.4 + tempNorm * 1.2,
        label: tempLabel(tempNorm),
        ringTime: 0,
        isGoldilocks,
        lifeStory,
        goldilocksGlow,
        glowTime: rand2() * Math.PI * 2,  // offset for variety
      })
      this.orbitAngles.push(rand2() * Math.PI * 2)
      this.orbitRadii.push(r)
      this.orbitSpeeds.push(keplerSpeed)
      this.moonData.push(moons)
    }

    // Asteroid belt
    const rand3 = makePRNG(seed + 7)
    if (count >= 3 && rand3() > 0.5) {
      const bi  = 1 + Math.floor(rand3() * (count - 2))
      const br  = this.orbitRadii[bi] + 0.15
      const n   = 300 + Math.floor(rand3() * 200)
      const pos = new Float32Array(n * 3)
      for (let k = 0; k < n; k++) {
        const a = rand3() * Math.PI * 2; const rv = br + (rand3() - 0.5) * 0.35
        pos[k*3] = Math.cos(a)*rv; pos[k*3+1] = (rand3()-0.5)*0.06; pos[k*3+2] = Math.sin(a)*rv
      }
      const bg = new THREE.BufferGeometry()
      bg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      this.group.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x887755, size: 0.012 })))
    }

    this.group.rotation.x = 0.28
  }

  update(dt: number, starHovered = false, hoveredPlanetIdx = -1) {
    // Star
    const starMat = this.star.material as THREE.MeshBasicMaterial
    starMat.color.lerp(starHovered ? new THREE.Color(0xffffff) : this.starBaseColor, 0.12)
    const glowMat = this.starGlow.material as THREE.MeshBasicMaterial
    glowMat.opacity += ((starHovered ? 0.22 : 0.08) - glowMat.opacity) * 0.1

    this.starRingTime += dt * this.sysPulseSpeed
    const starPeak = starHovered ? 0.75 : 0.3
    for (let i = 0; i < this.starRings.length; i++) {
      const phase = (this.starRingTime + i / 3) % 1
      this.starRings[i].scale.setScalar(1 + phase * (starHovered ? 3.5 : 2.2))
      ;(this.starRings[i].material as THREE.MeshBasicMaterial).opacity = (1 - phase) * starPeak
    }

    // Planets
    for (let i = 0; i < this.planetInfos.length; i++) {
      const pi  = this.planetInfos[i]
      const hov = i === hoveredPlanetIdx

      this.orbitAngles[i] += this.orbitSpeeds[i] * dt
      pi.mesh.position.set(
        Math.cos(this.orbitAngles[i]) * this.orbitRadii[i],
        0,
        Math.sin(this.orbitAngles[i]) * this.orbitRadii[i]
      )
      pi.mesh.rotation.y += dt * 0.4

      for (const m of this.moonData[i]) {
        m.angle += m.speed * dt
        m.mesh.position.set(Math.cos(m.angle) * m.dist, 0, Math.sin(m.angle) * m.dist)
      }

      // Highlight
      const mat = pi.mesh.material as THREE.MeshStandardMaterial
      mat.color.lerp(hov ? new THREE.Color(0xffffff) : pi.baseColor, 0.12)
      mat.emissiveIntensity += ((hov ? 0.35 : 0.06) - mat.emissiveIntensity) * 0.1

      // Goldilocks glow: gentle breathing animation
      if (pi.goldilocksGlow) {
        pi.glowTime += dt * 0.8
        const glowMat = pi.goldilocksGlow.material as THREE.MeshBasicMaterial
        const breath = 0.10 + Math.sin(pi.glowTime) * 0.06
        glowMat.opacity = hov ? breath + 0.08 : breath
        pi.goldilocksGlow.scale.setScalar(1 + Math.sin(pi.glowTime * 0.7) * 0.08)
      }

      // Rings: fully invisible until hovered, then pulse in tint colour
      pi.ringTime += dt * pi.pulseSpeed
      const peak = hov ? 0.7 : 0.0
      for (let r = 0; r < pi.rings.length; r++) {
        const phase = (pi.ringTime + r / 3) % 1
        pi.rings[r].scale.setScalar(1 + phase * 2.5)
        const mat2 = pi.rings[r].material as THREE.MeshBasicMaterial
        mat2.opacity += ((1 - phase) * peak - mat2.opacity) * 0.3
      }
    }
  }

  dispose() {
    this.group.traverse(obj => {
      const o = obj as THREE.Mesh
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
      else (o.material as THREE.Material)?.dispose()
    })
  }
}

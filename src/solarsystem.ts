import * as THREE from 'three'
import { generateLifeStory } from './stories'

const _tempAxis = new THREE.Vector3()

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
  private orbitLines:  THREE.Line[] = []
  private orbitBaseColors: THREE.Color[] = []

  // Expose orbit radii for proximity detection
  getOrbitRadii(): number[] { return this.orbitRadii }

  // Get proximity info for each orbit (0 = on orbit, 1 = far away)
  getOrbitProximities(distanceFromCenter: number, threshold = 0.4): number[] {
    return this.orbitRadii.map(r => {
      const dist = Math.abs(distanceFromCenter - r)
      return Math.min(1, dist / threshold)
    })
  }
  private moonData:    { mesh: THREE.Mesh; dist: number; speed: number; angle: number }[][] = []

  // Asteroid belts — InstancedMesh with per-asteroid tumble data
  private belts: {
    mesh:     THREE.InstancedMesh
    count:    number
    angles:   Float32Array   // orbital angle
    radii:    Float32Array   // orbital radius
    speeds:   Float32Array   // orbital speed
    yOffsets: Float32Array
    rotAxes:  Float32Array   // xyz packed, 3 per asteroid
    rotAngles:Float32Array   // current self-rotation
    rotSpeeds:Float32Array
    scaleXZ:  Float32Array   // elongation on x/z per asteroid
  }[] = []
  private _beltDummy = new THREE.Object3D()

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
      const orbitLine = makeOrbitLine(r, displayC)
      this.group.add(orbitLine)
      this.orbitLines.push(orbitLine)
      this.orbitBaseColors.push(displayC.clone())

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

    // ── Asteroid belts ────────────────────────────────────────────────────────
    const rand3    = makePRNG(seed + 7)
    const beltCount = count >= 5 ? 2 + Math.floor(rand3() * 2) : count >= 3 ? 1 + Math.floor(rand3() * 2) : 1

    // Belt types: rocky / icy / metallic
    const BELT_COLORS = [
      [new THREE.Color(0x887755), new THREE.Color(0xaa9966), new THREE.Color(0x665544)], // rocky
      [new THREE.Color(0x99bbcc), new THREE.Color(0xaaccdd), new THREE.Color(0x7799aa)], // icy
      [new THREE.Color(0xaaaaaa), new THREE.Color(0xccccbb), new THREE.Color(0x888877)], // metallic
    ]

    // Rocky geometry variants: detail-0 icosahedron, octahedron, dodecahedron
    const BELT_GEOS = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
    ]

    const usedBeltSlots = new Set<number>()
    for (let b = 0; b < beltCount; b++) {
      // Pick a gap between planets not already used
      let slot = 1 + Math.floor(rand3() * Math.max(1, count - 1))
      let tries = 0
      while (usedBeltSlots.has(slot) && tries++ < 8) slot = 1 + Math.floor(rand3() * Math.max(1, count - 1))
      usedBeltSlots.add(slot)

      const beltR   = (this.orbitRadii[slot - 1] ?? 1.0) * 0.5 + (this.orbitRadii[slot] ?? this.orbitRadii[slot - 1] + 1.0) * 0.5
      const spread  = 0.25 + rand3() * 0.35
      const n       = 55 + Math.floor(rand3() * 75)
      const bType   = Math.floor(rand3() * 3)
      const geoIdx  = Math.floor(rand3() * 3)
      const geo     = BELT_GEOS[geoIdx]
      const colors  = BELT_COLORS[bType]

      const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: bType === 2 ? 0.6 : 0.05 })
      const instMesh = new THREE.InstancedMesh(geo, mat, n)
      instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      instMesh.castShadow = false

      const angles    = new Float32Array(n)
      const radii     = new Float32Array(n)
      const speeds    = new Float32Array(n)
      const yOffsets  = new Float32Array(n)
      const rotAxes   = new Float32Array(n * 3)
      const rotAngles = new Float32Array(n)
      const rotSpeeds = new Float32Array(n)
      const scaleXZ   = new Float32Array(n * 2)

      const colBuf = new THREE.Color()
      for (let k = 0; k < n; k++) {
        angles[k]    = rand3() * Math.PI * 2
        radii[k]     = beltR + (rand3() - 0.5) * spread
        speeds[k]    = 0.06 / Math.sqrt(beltR) * (0.7 + rand3() * 0.6)
        yOffsets[k]  = (rand3() - 0.5) * 0.12
        rotAxes[k*3]     = rand3() - 0.5
        rotAxes[k*3 + 1] = rand3() - 0.5
        rotAxes[k*3 + 2] = rand3() - 0.5
        // Normalise rotation axis
        const al = Math.sqrt(rotAxes[k*3]**2 + rotAxes[k*3+1]**2 + rotAxes[k*3+2]**2) || 1
        rotAxes[k*3] /= al; rotAxes[k*3+1] /= al; rotAxes[k*3+2] /= al
        rotAngles[k] = rand3() * Math.PI * 2
        rotSpeeds[k] = 0.4 + rand3() * 1.8
        scaleXZ[k*2]     = 0.55 + rand3() * 0.7   // irregular x
        scaleXZ[k*2 + 1] = 0.55 + rand3() * 0.7   // irregular z

        // Random tint from palette
        const ci = Math.floor(rand3() * colors.length)
        colBuf.copy(colors[ci]).offsetHSL(0, 0, (rand3() - 0.5) * 0.12)
        instMesh.setColorAt(k, colBuf)
      }
      if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true

      this.group.add(instMesh)
      this.belts.push({ mesh: instMesh, count: n, angles, radii, speeds, yOffsets, rotAxes, rotAngles, rotSpeeds, scaleXZ })
    }

    // Note: BELT_GEOS are referenced by InstancedMeshes and disposed via SolarSystem.dispose()

    this.group.rotation.x = 0.28
  }

  update(dt: number, starHovered = false, hoveredPlanetIdx = -1, activePlanets: number[] = [], orbitProximities: number[] = []) {
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
      const active = activePlanets.includes(i)

      // Slow orbit to 15% speed when hovered so it's easier to click
      const orbitMul = hov ? 0.15 : 1.0
      this.orbitAngles[i] += this.orbitSpeeds[i] * dt * orbitMul
      pi.mesh.position.set(
        Math.cos(this.orbitAngles[i]) * this.orbitRadii[i],
        0,
        Math.sin(this.orbitAngles[i]) * this.orbitRadii[i]
      )
      // Faster spin when playing music
      pi.mesh.rotation.y += dt * (active ? 1.2 : 0.4)

      for (const m of this.moonData[i]) {
        m.angle += m.speed * dt
        m.mesh.position.set(Math.cos(m.angle) * m.dist, 0, Math.sin(m.angle) * m.dist)
      }

      // Highlight - brighter when active (playing music)
      const mat = pi.mesh.material as THREE.MeshStandardMaterial
      const targetColor = hov ? new THREE.Color(0xffffff) : pi.baseColor
      mat.color.lerp(targetColor, 0.12)
      const targetEmissive = active ? 0.5 : (hov ? 0.35 : 0.06)
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.1

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

      // Orbit line: glow based on mouse proximity OR active track state
      const orbitLine = this.orbitLines[i]
      if (orbitLine) {
        const orbitMat = orbitLine.material as THREE.LineBasicMaterial
        const proximity = orbitProximities[i] ?? 1  // 0 = on orbit, 1 = far
        const isActive = active  // track is playing for this planet

        const baseOpacity = 0.18
        const activeOpacity = 0.55   // steady glow when track is active
        const hoverOpacity = 0.75    // brighter on hover

        // Active orbits have a steady glow; hovering adds extra brightness
        let targetOpacity = baseOpacity
        if (isActive) {
          targetOpacity = activeOpacity + (1 - proximity) * (hoverOpacity - activeOpacity)
        } else {
          targetOpacity = baseOpacity + (1 - proximity) * (hoverOpacity - baseOpacity)
        }
        orbitMat.opacity += (targetOpacity - orbitMat.opacity) * 0.15

        // Also brighten color when active or close
        const baseColor = this.orbitBaseColors[i]
        const glowColor = new THREE.Color(0xffffff)
        const colorBlend = isActive ? Math.max(0.35, (1 - proximity) * 0.5) : (1 - proximity) * 0.5
        const targetColor = baseColor.clone().lerp(glowColor, colorBlend)
        orbitMat.color.lerp(targetColor, 0.15)
      }
    }

    // ── Asteroid belt tumble update ───────────────────────────────────────────
    const d = this._beltDummy
    for (const belt of this.belts) {
      for (let k = 0; k < belt.count; k++) {
        belt.angles[k]    += belt.speeds[k] * dt
        belt.rotAngles[k] += belt.rotSpeeds[k] * dt

        d.position.set(
          Math.cos(belt.angles[k]) * belt.radii[k],
          belt.yOffsets[k],
          Math.sin(belt.angles[k]) * belt.radii[k]
        )
        const ax = belt.rotAxes[k*3], ay = belt.rotAxes[k*3+1], az = belt.rotAxes[k*3+2]
        _tempAxis.set(ax, ay, az)
        d.quaternion.setFromAxisAngle(_tempAxis, belt.rotAngles[k])
        const size = 0.025 + ((k * 7 + 13) % 19) / 19 * 0.055  // varied but consistent per asteroid
        d.scale.set(size * belt.scaleXZ[k*2], size * (0.5 + (k % 5) * 0.12), size * belt.scaleXZ[k*2+1])
        d.updateMatrix()
        belt.mesh.setMatrixAt(k, d.matrix)
      }
      belt.mesh.instanceMatrix.needsUpdate = true
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

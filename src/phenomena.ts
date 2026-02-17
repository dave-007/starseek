/**
 * Solar system phenomena — toggleable ambient animations.
 * Each phenomenon is a self-contained group that updates each frame.
 */

import * as THREE from 'three'
import type { PlanetInfo } from './solarsystem'

function makePRNG(seed: number) {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

export type PhenomenonKey = 'radio' | 'ufo' | 'comet' | 'lights' | 'formation' | 'anomaly'

export interface Phenomenon {
  readonly group: THREE.Group
  update(dt: number, planets: PlanetInfo[]): void
  dispose(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RADIO SIGNALS — expanding ring pulses from habitable planets
// ─────────────────────────────────────────────────────────────────────────────
export function createRadio(planets: PlanetInfo[]): Phenomenon {
  const group = new THREE.Group()
  const habitable = planets.filter(p => p.isGoldilocks)
  const ringData: { ring: THREE.Mesh; phase: number; planet: PlanetInfo }[] = []

  for (const p of habitable) {
    for (let i = 0; i < 4; i++) {
      const r = 0.18
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r * 1.08, 64),
        new THREE.MeshBasicMaterial({ color: 0x44ffcc, transparent: true, opacity: 0, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      group.add(ring)
      ringData.push({ ring, phase: i / 4, planet: p })
    }
  }

  return {
    group,
    update(dt, planets) {
      for (const d of ringData) {
        d.phase = (d.phase + dt * 0.22) % 1
        d.ring.position.copy(d.planet.mesh.position)
        const scale = 1 + d.phase * 18
        d.ring.scale.setScalar(scale)
        ;(d.ring.material as THREE.MeshBasicMaterial).opacity = (1 - d.phase) * 0.35
      }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UFO SCOUT — a small disc that drifts between planets
// ─────────────────────────────────────────────────────────────────────────────
export function createUFO(seed: number, planets: PlanetInfo[]): Phenomenon {
  const group   = new THREE.Group()
  const rand    = makePRNG(seed ^ 0xff0)

  // Body: flat saucer
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.14, 0.07, 24),
    new THREE.MeshStandardMaterial({ color: 0x99ccdd, metalness: 0.8, roughness: 0.2, emissive: new THREE.Color(0x224466), emissiveIntensity: 0.4 })
  )
  // Dome on top
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xaaeeff, metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.75 })
  )
  dome.position.y = 0.035
  // Glow ring under
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.13, 0.24, 32),
    new THREE.MeshBasicMaterial({ color: 0x00eeff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  )
  glowRing.rotation.x = -Math.PI / 2
  glowRing.position.y = -0.04

  group.add(body); group.add(dome); group.add(glowRing)

  let target = new THREE.Vector3()
  let time   = 0
  let hoverTime = 0
  let hovering  = false
  let glowPhase = 0

  function pickTarget() {
    if (planets.length === 0) { target.set((rand()-0.5)*12, (rand()-0.5)*3, (rand()-0.5)*12); return }
    const p = planets[Math.floor(rand() * planets.length)]
    target.copy(p.mesh.position).add(new THREE.Vector3((rand()-0.5)*1.5, (rand()-0.5)*0.8, (rand()-0.5)*1.5))
  }

  // Start near a random planet
  if (planets.length) group.position.copy(planets[0].mesh.position)
  pickTarget()

  return {
    group,
    update(dt, currentPlanets) {
      time += dt; glowPhase += dt * 2.5

      const gmat = glowRing.material as THREE.MeshBasicMaterial
      gmat.opacity = 0.3 + Math.sin(glowPhase) * 0.25

      if (hovering) {
        hoverTime += dt
        group.rotation.y += dt * 0.8
        group.position.y += Math.sin(time * 1.5) * 0.002
        if (hoverTime > 3 + rand() * 4) { hovering = false; hoverTime = 0; pickTarget() }
      } else {
        // Update target to follow the planet (it moves)
        const dist = group.position.distanceTo(target)
        if (dist < 0.4) {
          hovering = true
        } else {
          const speed = Math.min(dist * 0.6, 3.5)
          const dir = target.clone().sub(group.position).normalize()
          group.position.addScaledVector(dir, speed * dt)
          group.rotation.y += dt * 1.2
          // Tilt in direction of travel
          group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, -dir.x * 0.3, 0.05)
        }
      }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMET — periodic streaker with particle tail
// ─────────────────────────────────────────────────────────────────────────────
export function createComet(seed: number): Phenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xc0e7)

  const HEAD_R = 0.12
  const head   = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xddeeff })
  )

  const TAIL_N  = 80
  const tailPos = new Float32Array(TAIL_N * 3)
  const tailGeo = new THREE.BufferGeometry()
  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3))
  const tail = new THREE.Points(tailGeo, new THREE.PointsMaterial({
    color: 0x88ccff, size: 0.06, transparent: true, opacity: 0.7,
    vertexColors: false, sizeAttenuation: true,
  }))

  // Glow around head
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R * 2.5, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.18, side: THREE.BackSide })
  )

  group.add(head); group.add(tail); group.add(glow)

  const PERIOD = 14 + rand() * 8   // seconds between comets

  let t      = rand()               // start at random phase
  let startP = new THREE.Vector3()
  let endP   = new THREE.Vector3()
  let ctrlP  = new THREE.Vector3()

  function resetPath() {
    const angle = rand() * Math.PI * 2
    const dist  = 16 + rand() * 6
    startP.set(Math.cos(angle) * dist, (rand()-0.5)*3, Math.sin(angle) * dist)
    endP.set(-startP.x * (0.8+rand()*0.4), (rand()-0.5)*3, -startP.z * (0.8+rand()*0.4))
    ctrlP.set((rand()-0.5)*5, (rand()-0.5)*2, (rand()-0.5)*5)
    t = 0
  }
  resetPath()

  const _tmpA = new THREE.Vector3(), _tmpB = new THREE.Vector3(), _tmpC = new THREE.Vector3()

  return {
    group,
    update(dt) {
      t += dt / PERIOD
      if (t > 1.2) resetPath()

      const tc = Math.max(0, Math.min(1, t))
      // Quadratic bezier
      _tmpA.lerpVectors(startP, ctrlP, tc)
      _tmpB.lerpVectors(ctrlP, endP, tc)
      head.position.lerpVectors(_tmpA, _tmpB, tc)
      glow.position.copy(head.position)

      // Tail: trail of past positions
      for (let k = TAIL_N - 1; k > 0; k--) {
        tailPos[k*3]   = tailPos[(k-1)*3]
        tailPos[k*3+1] = tailPos[(k-1)*3+1]
        tailPos[k*3+2] = tailPos[(k-1)*3+2]
      }
      tailPos[0] = head.position.x; tailPos[1] = head.position.y; tailPos[2] = head.position.z
      tailGeo.attributes.position.needsUpdate = true

      // Fade out when far from centre
      const vis = t > 0 && t < 1.1
      head.visible = glow.visible = tail.visible = vis
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CITY LIGHTS — tiny glow points on the night side of planets
// ─────────────────────────────────────────────────────────────────────────────
export function createCityLights(seed: number, planets: PlanetInfo[]): Phenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xc177)

  const lightGroups: { pts: THREE.Points; planet: PlanetInfo; localDirs: THREE.Vector3[]; twinkle: number[] }[] = []

  for (const p of planets) {
    const count = p.isGoldilocks ? 28 : Math.floor(rand() * 8)
    if (count === 0) continue

    const pos = new Float32Array(count * 3)
    const localDirs: THREE.Vector3[] = []

    for (let k = 0; k < count; k++) {
      // Random point on unit sphere surface
      const theta = rand() * Math.PI * 2
      const phi   = Math.acos(2 * rand() - 1)
      const r     = p.mesh.geometry.boundingSphere?.radius ?? 0.1
      const v = new THREE.Vector3(Math.sin(phi)*Math.cos(theta), Math.sin(phi)*Math.sin(theta), Math.cos(phi))
      localDirs.push(v.clone())
      pos[k*3] = v.x * r * 1.02; pos[k*3+1] = v.y * r * 1.02; pos[k*3+2] = v.z * r * 1.02
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: p.isGoldilocks ? 0xffeeaa : 0xffcc66,
      size: p.isGoldilocks ? 0.04 : 0.025,
      transparent: true, opacity: 0.9, sizeAttenuation: true,
    }))
    p.mesh.add(pts)   // parent to planet so it orbits with it
    lightGroups.push({ pts, planet: p, localDirs, twinkle: localDirs.map(() => rand() * Math.PI * 2) })
  }

  let time = 0
  return {
    group,   // empty — lights parented to planet meshes directly
    update(dt) {
      time += dt
      for (const lg of lightGroups) {
        // Night-side culling: hide lights facing the star (origin)
        const planetPos = lg.planet.mesh.position  // star is at (0,0,0) in group space
        const toStar = planetPos.clone().negate().normalize()
        const positions = (lg.pts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
        for (let k = 0; k < lg.localDirs.length; k++) {
          // World direction of this light point
          const worldDir = lg.localDirs[k].clone().applyQuaternion(lg.planet.mesh.quaternion)
          const nightSide = worldDir.dot(toStar) < -0.1   // roughly night side
          const twinkle = nightSide ? (0.5 + Math.sin(time * 3 + lg.twinkle[k]) * 0.5) : 0
          // Scale point to 0 when day side (hiding it)
          positions[k*3]   = lg.localDirs[k].x * (lg.planet.mesh.geometry.boundingSphere?.radius ?? 0.1) * 1.02 * (nightSide ? 1 : 0)
          positions[k*3+1] = lg.localDirs[k].y * (lg.planet.mesh.geometry.boundingSphere?.radius ?? 0.1) * 1.02 * (nightSide ? 1 : 0)
          positions[k*3+2] = lg.localDirs[k].z * (lg.planet.mesh.geometry.boundingSphere?.radius ?? 0.1) * 1.02 * (nightSide ? 1 : 0)
          lg.twinkle[k] = lg.twinkle[k]  // keep phase
        }
        lg.pts.geometry.attributes.position.needsUpdate = true
        ;(lg.pts.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(time * 0.8) * 0.2
      }
    },
    dispose() {
      for (const lg of lightGroups) { lg.planet.mesh.remove(lg.pts); lg.pts.geometry.dispose() }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FORMATION — V-formation of lights crossing the system
// ─────────────────────────────────────────────────────────────────────────────
export function createFormation(seed: number): Phenomenon {
  const group  = new THREE.Group()
  const rand   = makePRNG(seed ^ 0xf04f)
  const COUNT  = 5

  // Formation offsets in V shape
  const offsets = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.5, 0, 0.45), new THREE.Vector3(0.5, 0, 0.45),
    new THREE.Vector3(-1.0, 0, 0.9),  new THREE.Vector3(1.0, 0, 0.9),
  ]

  const lights: THREE.Mesh[] = []
  for (let i = 0; i < COUNT; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    // Ring glow per light
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.25 })
    )
    m.add(g); group.add(m); lights.push(m)
  }

  const PERIOD = 20 + rand() * 10
  let t    = rand()
  let from = new THREE.Vector3(), to = new THREE.Vector3()
  let up   = new THREE.Vector3(0, 1, 0)
  let dir  = new THREE.Vector3()
  let side = new THREE.Vector3()

  function resetPath() {
    const angle = rand() * Math.PI * 2
    const dist  = 18 + rand() * 4
    from.set(Math.cos(angle)*dist, (rand()-0.5)*4, Math.sin(angle)*dist)
    to.set(-from.x*(0.7+rand()*0.6), (rand()-0.5)*4, -from.z*(0.7+rand()*0.6))
    dir.copy(to).sub(from).normalize()
    side.crossVectors(dir, up).normalize()
    t = 0
  }
  resetPath()

  const _q = new THREE.Quaternion()
  return {
    group,
    update(dt) {
      t += dt / PERIOD
      if (t > 1.15) resetPath()
      const tc = Math.max(0, Math.min(1, t))
      const base = from.clone().lerp(to, tc)
      dir.copy(to).sub(from).normalize()
      side.crossVectors(dir, up).normalize()

      // Occasional formation rotation around forward axis
      const roll = Math.sin(t * 0.8) * 0.4
      _q.setFromAxisAngle(dir, roll)

      for (let i = 0; i < COUNT; i++) {
        const off = offsets[i].clone().applyQuaternion(_q)
        const sp  = side.clone().multiplyScalar(off.x)
        lights[i].position.copy(base).add(sp).add(new THREE.Vector3(0, off.y + off.z*0.1, 0))
        lights[i].visible = tc > 0 && tc < 1
      }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ANOMALY — slowly rotating wireframe polyhedron that pulses
// ─────────────────────────────────────────────────────────────────────────────
export function createAnomaly(seed: number): Phenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xa0e0)

  const geo1  = new THREE.OctahedronGeometry(0.5, 0)
  const geo2  = new THREE.OctahedronGeometry(0.35, 0)

  const mat1  = new THREE.MeshBasicMaterial({ color: 0x8844ff, wireframe: true })
  const mat2  = new THREE.MeshBasicMaterial({ color: 0xff44aa, wireframe: true })

  const outer = new THREE.Mesh(geo1, mat1)
  const inner = new THREE.Mesh(geo2, mat2)
  // Glow core
  const core  = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.7 })
  )

  group.add(outer); group.add(inner); group.add(core)

  let time   = 0
  let driftV = new THREE.Vector3((rand()-0.5)*0.4, (rand()-0.5)*0.2, (rand()-0.5)*0.4)
  const DRIFT_RANGE = 6

  return {
    group,
    update(dt) {
      time += dt
      outer.rotation.x += dt * 0.3; outer.rotation.y += dt * 0.5; outer.rotation.z += dt * 0.2
      inner.rotation.x -= dt * 0.45; inner.rotation.y -= dt * 0.25
      const pulse = 0.85 + Math.sin(time * 2.2) * 0.18
      core.scale.setScalar(pulse)
      ;(core.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(time * 2.2) * 0.2
      // Slow drift, bounce at boundary
      group.position.addScaledVector(driftV, dt)
      if (Math.abs(group.position.x) > DRIFT_RANGE) driftV.x *= -1
      if (Math.abs(group.position.y) > DRIFT_RANGE * 0.4) driftV.y *= -1
      if (Math.abs(group.position.z) > DRIFT_RANGE) driftV.z *= -1
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// =============================================================================
// GALAXY PHENOMENA — toggleable star-layer animations
// =============================================================================

export type GalaxyPhenomenonKey = 'nebulae' | 'signalweb' | 'streams' | 'wormhole' | 'pulsars' | 'void' | 'messier' | 'randomoddness'

export interface GalaxyPhenomenon {
  readonly group: THREE.Group
  update(dt: number): void
  dispose(): void
}

export function createNebulae(seed: number): GalaxyPhenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xeb01a)
  const COLORS = [0xff44aa, 0x4488ff, 0xff8822, 0x44ffcc, 0xaa44ff]
  const clouds: { mesh: THREE.Mesh; rotSpeed: THREE.Vector3; phase: number }[] = []
  for (let i = 0; i < 5; i++) {
    const theta = rand() * Math.PI * 2, phi = Math.acos(2 * rand() - 1), r = 1.4 + rand() * 1.2
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 + rand() * 0.5, 12, 12),
      new THREE.MeshBasicMaterial({ color: COLORS[i % COLORS.length], transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    mesh.position.set(Math.sin(phi)*Math.cos(theta)*r, Math.sin(phi)*Math.sin(theta)*r, Math.cos(phi)*r)
    group.add(mesh)
    clouds.push({ mesh, rotSpeed: new THREE.Vector3((rand()-.5)*.12, (rand()-.5)*.12, 0), phase: rand()*Math.PI*2 })
  }
  return {
    group,
    update(dt) {
      for (const c of clouds) { c.mesh.rotation.x += c.rotSpeed.x*dt; c.mesh.rotation.y += c.rotSpeed.y*dt; c.phase += dt*.3; (c.mesh.material as THREE.MeshBasicMaterial).opacity = .055+Math.sin(c.phase)*.025; c.mesh.scale.setScalar(1+Math.sin(c.phase*.7)*.08) }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

export function createSignalWeb(seed: number, systemPositions: THREE.Vector3[]): GalaxyPhenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0x519a1)
  const edges: { a: THREE.Vector3; b: THREE.Vector3 }[] = []
  for (let i = 0; i < systemPositions.length; i++)
    for (let j = i+1; j < systemPositions.length; j++)
      if (systemPositions[i].distanceTo(systemPositions[j]) < 1.4) edges.push({ a: systemPositions[i], b: systemPositions[j] })
  for (const e of edges) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([e.a.clone().multiplyScalar(1.01), e.b.clone().multiplyScalar(1.01)]), new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.14 }))
    group.add(line)
  }
  const pulses: { mesh: THREE.Mesh; edge: typeof edges[0]; t: number; speed: number }[] = []
  for (let i = 0; i < Math.min(edges.length*2, 16); i++) {
    const edge = edges[Math.floor(rand()*edges.length)]; if (!edge) continue
    const m = new THREE.Mesh(new THREE.SphereGeometry(.016,6,6), new THREE.MeshBasicMaterial({ color: 0x88ccff }))
    group.add(m); pulses.push({ mesh: m, edge, t: rand(), speed: .06+rand()*.12 })
  }
  return {
    group,
    update(dt) { for (const p of pulses) { p.t = (p.t+dt*p.speed)%1; p.mesh.position.lerpVectors(p.edge.a, p.edge.b, p.t).multiplyScalar(1.01) } },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

export function createStarStreams(seed: number): GalaxyPhenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0x57ea4)
  const N = 400, pos = new Float32Array(N*3)
  const params: { theta: number; phi: number; dTheta: number; dPhi: number; r: number }[] = []
  for (let k = 0; k < N; k++) {
    const arm = Math.floor(rand()*3), armOff = (arm/3)*Math.PI*2, t = rand()
    const theta = armOff + t*Math.PI*2.5, phi = Math.PI*.5+(rand()-.5)*.6, r = 1.02+rand()*.04
    params.push({ theta, phi, dTheta: .15+rand()*.2, dPhi: (rand()-.5)*.05, r })
    pos[k*3] = Math.sin(phi)*Math.cos(theta)*r; pos[k*3+1] = Math.sin(phi)*Math.sin(theta)*r; pos[k*3+2] = Math.cos(phi)*r
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaabbff, size: .014, transparent: true, opacity: .55, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false })))
  return {
    group,
    update(dt) {
      for (let k = 0; k < N; k++) { const p = params[k]; p.theta += p.dTheta*dt*.08; p.phi = Math.max(.1,Math.min(Math.PI-.1,p.phi+p.dPhi*dt*.05)); pos[k*3]=Math.sin(p.phi)*Math.cos(p.theta)*p.r; pos[k*3+1]=Math.sin(p.phi)*Math.sin(p.theta)*p.r; pos[k*3+2]=Math.cos(p.phi)*p.r }
      geo.attributes.position.needsUpdate = true
    },
    dispose() { geo.dispose() }
  }
}

export function createWormhole(seed: number): GalaxyPhenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xb04e)
  const theta = rand()*Math.PI*2
  group.position.set(Math.cos(theta)*1.8, (rand()-.5)*.5, Math.sin(theta)*1.8)
  const rings: { mesh: THREE.Mesh; rotSpeed: number; phase: number }[] = []
  const COLS = [0xaa44ff, 0xff44cc, 0x4488ff]
  for (let i = 0; i < 5; i++) {
    const r = .06+i*.04
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r*1.25, 48), new THREE.MeshBasicMaterial({ color: COLS[i%3], transparent: true, opacity: .5-i*.07, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }))
    rings.push({ mesh: ring, rotSpeed: 1.2+i*.5, phase: i*.4 }); group.add(ring)
  }
  group.add(new THREE.Mesh(new THREE.CircleGeometry(.055,32), new THREE.MeshBasicMaterial({ color: 0x000004, side: THREE.DoubleSide })))
  let time = 0
  return {
    group,
    update(dt) { time += dt; for (const r of rings) { r.phase += r.rotSpeed*dt; r.mesh.rotation.z = r.phase; (r.mesh.material as THREE.MeshBasicMaterial).opacity = (.38+Math.sin(time*1.5+r.phase)*.12)*(1-rings.indexOf(r)*.12) }; group.rotation.y += dt*.2 },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

export function createPulsars(seed: number, systemPositions: THREE.Vector3[]): GalaxyPhenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0x9a15e)
  const chosen = [...systemPositions].sort(() => rand()-.5).slice(0, Math.min(3, systemPositions.length))
  const data: { beacon: THREE.Mesh; beam: THREE.Mesh; period: number; phase: number }[] = []
  for (const pos of chosen) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.022,8,8), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    beacon.position.copy(pos).multiplyScalar(1.015)
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(.008,.5), new THREE.MeshBasicMaterial({ color: 0xaaffff, transparent: true, opacity: .6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }))
    beam.position.copy(pos).multiplyScalar(1.015); beam.lookAt(0,0,0)
    group.add(beacon); group.add(beam); data.push({ beacon, beam, period: .8+rand()*1.2, phase: rand()*Math.PI*2 })
  }
  return {
    group,
    update(dt) { for (const p of data) { p.phase += dt*(Math.PI*2/p.period); const pulse = Math.max(0,Math.sin(p.phase*8))**3; (p.beacon.material as THREE.MeshBasicMaterial).color.setScalar(.4+pulse*.6); p.beacon.scale.setScalar(1+pulse*3); (p.beam.material as THREE.MeshBasicMaterial).opacity = pulse*.7; p.beam.rotation.z = p.phase*.5 } },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

export function createVoid(seed: number): GalaxyPhenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0x701d)
  const SIZE  = .45+rand()*.3
  const core  = new THREE.Mesh(new THREE.SphereGeometry(SIZE,16,16), new THREE.MeshBasicMaterial({ color: 0x000006, transparent: true, opacity: .88, depthWrite: false }))
  const halo  = new THREE.Mesh(new THREE.SphereGeometry(SIZE*1.6,16,16), new THREE.MeshBasicMaterial({ color: 0x220033, transparent: true, opacity: .18, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }))
  group.add(core); group.add(halo)
  const a = rand()*Math.PI*2; group.position.set(Math.cos(a)*2.2, (rand()-.5)*.6, Math.sin(a)*2.2)
  const driftV = new THREE.Vector3(-group.position.x*.04, (rand()-.5)*.02, -group.position.z*.04)
  let time = 0
  return {
    group,
    update(dt) { time += dt; group.position.addScaledVector(driftV, dt); (halo.material as THREE.MeshBasicMaterial).opacity = .15+Math.sin(time*.5)*.05; if (group.position.length()>3.5) { const a2 = Math.random()*Math.PI*2; group.position.set(Math.cos(a2)*2.2,(Math.random()-.5)*.6,Math.sin(a2)*2.2); driftV.set(-group.position.x*.04,(Math.random()-.5)*.02,-group.position.z*.04) } },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// =============================================================================
// MESSIER / DEEP-SKY OBJECTS — recognisable catalogue objects scattered around
// =============================================================================

interface MessierDef {
  name: string
  r: number; theta: number; phi: number
  build: (g: THREE.Group) => void
}

export function createMessierObjects(seed: number): GalaxyPhenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xf01e)  // position jitter

  const DEFS: MessierDef[] = [
    // M1 — Crab Nebula: spiky irregular explosion remnant
    {
      name: 'M1 Crab', r: 1.9, theta: 0.4, phi: 1.1,
      build(g) {
        const COLS = [0xff8833, 0xff4422, 0xffaa44]
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.06 + i * 0.04, 0),
            new THREE.MeshBasicMaterial({ color: COLS[i], wireframe: i === 0, transparent: true, opacity: 0.65 - i * 0.15, blending: THREE.AdditiveBlending, depthWrite: false })
          )
          m.scale.set(1 + rand() * 0.6, 1 + rand() * 0.6, 0.5 + rand() * 0.4)
          g.add(m)
        }
      }
    },
    // M42 — Orion Nebula: large diffuse blue/pink glow
    {
      name: 'M42 Orion', r: 2.1, theta: 2.4, phi: 1.6,
      build(g) {
        const COLS = [0x4488ff, 0xff44aa, 0xaaeeff]
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(0.18 + i * 0.09, 8, 8),
            new THREE.MeshBasicMaterial({ color: COLS[i], transparent: true, opacity: 0.07 - i * 0.018, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
          )
          m.position.set((rand() - 0.5) * 0.12, (rand() - 0.5) * 0.1, 0)
          g.add(m)
        }
        // Hot center stars
        for (let i = 0; i < 4; i++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), new THREE.MeshBasicMaterial({ color: 0xaaddff }))
          s.position.set((rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08, 0)
          g.add(s)
        }
      }
    },
    // M57 — Ring Nebula: glowing torus ring
    {
      name: 'M57 Ring', r: 1.7, theta: 4.2, phi: 0.8,
      build(g) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.1, 0.038, 16, 48),
          new THREE.MeshBasicMaterial({ color: 0x88ffee, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
        )
        g.add(ring)
        const inner = new THREE.Mesh(
          new THREE.CircleGeometry(0.065, 24),
          new THREE.MeshBasicMaterial({ color: 0x4488aa, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
        )
        g.add(inner)
        // Central white dwarf
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.007, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })))
      }
    },
    // M31 — Andromeda: large tilted oval disc
    {
      name: 'M31 Andromeda', r: 2.4, theta: 5.8, phi: 1.3,
      build(g) {
        for (let i = 0; i < 3; i++) {
          const d = new THREE.Mesh(
            new THREE.CircleGeometry(0.28 - i * 0.06, 32),
            new THREE.MeshBasicMaterial({ color: 0xffeecc, transparent: true, opacity: 0.04 + i * 0.01, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
          )
          d.rotation.x = 1.2; d.rotation.z = 0.3
          g.add(d)
        }
        // Bright core
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff8ee, transparent: true, opacity: 0.8 })))
      }
    },
    // M13 — Hercules Cluster: dense sphere of tiny stars
    {
      name: 'M13 Hercules', r: 1.8, theta: 1.0, phi: 0.55,
      build(g) {
        const N = 120
        const pos = new Float32Array(N * 3)
        for (let i = 0; i < N; i++) {
          const r = Math.pow(rand(), 0.5) * 0.14  // concentrated core
          const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1)
          pos[i*3]   = Math.sin(ph) * Math.cos(th) * r
          pos[i*3+1] = Math.sin(ph) * Math.sin(th) * r
          pos[i*3+2] = Math.cos(ph) * r
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffeecc, size: 0.007, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false })))
      }
    },
    // M51 — Whirlpool: two interacting galaxy discs
    {
      name: 'M51 Whirlpool', r: 2.0, theta: 3.1, phi: 1.9,
      build(g) {
        // Main galaxy disc
        for (let i = 0; i < 2; i++) {
          const d = new THREE.Mesh(
            new THREE.CircleGeometry(0.16 - i * 0.04, 24),
            new THREE.MeshBasicMaterial({ color: 0xaabbff, transparent: true, opacity: 0.06 - i * 0.01, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
          )
          d.rotation.x = 0.5
          g.add(d)
        }
        // Companion galaxy
        const companion = new THREE.Group()
        companion.position.set(0.22, 0.1, 0)
        companion.add(new THREE.Mesh(
          new THREE.CircleGeometry(0.07, 16),
          new THREE.MeshBasicMaterial({ color: 0x8899ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
        ))
        companion.children[0].rotation.x = 0.4
        g.add(companion)
        // Tidal bridge
        const bridgePts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.22, 0.1, 0)]
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bridgePts), new THREE.LineBasicMaterial({ color: 0x667799, transparent: true, opacity: 0.18 })))
      }
    },
  ]

  // Build all objects and position them
  const labels: { mesh: THREE.Sprite; time: number }[] = []
  for (const def of DEFS) {
    const objGroup = new THREE.Group()
    def.build(objGroup)
    const theta = def.theta + (rand() - 0.5) * 0.4
    const phi   = Math.max(0.2, Math.min(Math.PI - 0.2, def.phi + (rand() - 0.5) * 0.3))
    const r     = def.r
    objGroup.position.set(
      Math.sin(phi) * Math.cos(theta) * r,
      Math.cos(phi) * r,
      Math.sin(phi) * Math.sin(theta) * r
    )
    group.add(objGroup)
    // Tiny text label using canvas sprite
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 28
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(180,200,255,0.7)'; ctx.font = '11px monospace'
    ctx.fillText(def.name, 4, 18)
    const tex = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false }))
    sprite.scale.set(0.4, 0.09, 1)
    sprite.position.copy(objGroup.position).addScaledVector(sprite.position.clone().normalize(), 0.1)
    group.add(sprite)
    labels.push({ mesh: sprite, time: 0 })
  }

  let time = 0
  return {
    group,
    update(dt) {
      time += dt
      // Gentle label pulse
      for (const l of labels) {
        ;(l.mesh.material as THREE.SpriteMaterial).opacity = 0.35 + Math.sin(time * 0.7 + labels.indexOf(l)) * 0.18
      }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose(); (o as THREE.Sprite).material?.dispose() }) }
  }
}

// =============================================================================
// RANDOM ODDNESS — meta-toggle: randomly activates / deactivates phenomena
// (Implemented in main.ts as a special handler; this exports a stub type)
// =============================================================================
// Note: 'randomoddness' is handled directly in main.ts rather than spawning a group.
// This factory returns a no-op group so spawnGalaxyPhenomenon can handle it gracefully.
export function createRandomOddnessStub(): GalaxyPhenomenon {
  return { group: new THREE.Group(), update() {}, dispose() {} }
}

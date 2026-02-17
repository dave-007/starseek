import * as THREE from 'three'
import './style.css'
import { unlockAudio, SystemLoop } from './audio'
import { buildHexSphere } from './hexsphere'
import { SolarSystem } from './solarsystem'
import { PlanetView, DEFAULT_MIX, ElementMix, ElementKey, SEED_EVENTS, SeedEvent, ELEMENT_COLORS } from './planetview'
import {
  type Phenomenon, type PhenomenonKey,
  createRadio, createUFO, createComet, createCityLights, createFormation, createAnomaly,
  type GalaxyPhenomenon, type GalaxyPhenomenonKey,
  createNebulae, createSignalWeb, createStarStreams, createWormhole, createPulsars, createVoid,
  createMessierObjects, createRandomOddnessStub
} from './phenomena'

// ---------------------------------------------------------------------------
// Renderer & Scene
// ---------------------------------------------------------------------------
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000008)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 0, 3)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
// Cap pixel ratio to 2 for performance on high-DPI displays
const targetPixelRatio = Math.min(window.devicePixelRatio, 2)
renderer.setPixelRatio(targetPixelRatio)
document.body.appendChild(renderer.domElement)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---------------------------------------------------------------------------
// Touch Support for Mobile Devices
// ---------------------------------------------------------------------------
const simulateMouseEvent = (touchEvent: TouchEvent, mouseType: string) => {
  const touch = touchEvent.touches[0] || touchEvent.changedTouches[0]
  if (!touch) return
  
  const mouseEvent = new MouseEvent(mouseType, {
    clientX: touch.clientX,
    clientY: touch.clientY,
    bubbles: true,
    cancelable: true
  })
  
  if (mouseType === 'mousedown' || mouseType === 'mousemove') {
    renderer.domElement.dispatchEvent(mouseEvent)
  } else {
    document.dispatchEvent(mouseEvent)
  }
  touchEvent.preventDefault()
}

renderer.domElement.addEventListener('touchstart', (e) => simulateMouseEvent(e, 'mousedown'), { passive: false })
renderer.domElement.addEventListener('touchmove', (e) => simulateMouseEvent(e, 'mousemove'), { passive: false })
renderer.domElement.addEventListener('touchend', (e) => {
  const mouseEvent = new MouseEvent('mouseup', { bubbles: true })
  document.dispatchEvent(mouseEvent)
  e.preventDefault()
}, { passive: false })

// ---------------------------------------------------------------------------
// Galaxy objects
// ---------------------------------------------------------------------------
const galaxyGroup = new THREE.Group()
scene.add(galaxyGroup)

const galaxy = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.8, metalness: 0.2, transparent: true, opacity: 0.18 })
)
galaxyGroup.add(galaxy)

const hexGrid = buildHexSphere(4, 1.002, 0x4422aa)
galaxyGroup.add(hexGrid)

galaxyGroup.add(new THREE.AmbientLight(0x221133, 1.5))
const sun = new THREE.DirectionalLight(0x8866ff, 2)
sun.position.set(5, 3, 5)
galaxyGroup.add(sun)

// Stars — shared between both views
// Background stars — varied sizes and tints
;(() => {
  const N = 2200
  const pos  = new Float32Array(N * 3)
  const cols = new Float32Array(N * 3)
  const STAR_COLORS = [
    [1.0, 0.9, 0.8],   // warm white
    [0.8, 0.9, 1.0],   // cool blue
    [1.0, 0.85, 0.6],  // yellow giant
    [1.0, 0.6, 0.5],   // red giant
    [0.9, 0.9, 1.0],   // neutral
  ]
  for (let i = 0; i < N; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 200
    pos[i*3+1] = (Math.random() - 0.5) * 200
    pos[i*3+2] = (Math.random() - 0.5) * 200
    const c = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
    const bright = 0.5 + Math.random() * 0.5
    cols[i*3] = c[0] * bright; cols[i*3+1] = c[1] * bright; cols[i*3+2] = c[2] * bright
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color',    new THREE.BufferAttribute(cols, 3))
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 0.09, sizeAttenuation: true })))

  // Binary star pairs — close doubles scattered in the background
  const BINARY_COUNT = 18
  for (let b = 0; b < BINARY_COUNT; b++) {
    const cx = (Math.random()-0.5)*160, cy = (Math.random()-0.5)*160, cz = (Math.random()-0.5)*160
    const sep = 0.6 + Math.random() * 1.2
    const ang = Math.random() * Math.PI * 2
    const hue1 = Math.random(), hue2 = (hue1 + 0.3 + Math.random()*0.4) % 1
    const col1 = new THREE.Color().setHSL(hue1, 0.7, 0.7)
    const col2 = new THREE.Color().setHSL(hue2, 0.6, 0.65)
    for (const [ox, col] of [[-sep/2, col1], [sep/2, col2]] as [number, THREE.Color][]) {
      const bp = new Float32Array(3)
      bp[0] = cx + Math.cos(ang)*ox; bp[1] = cy; bp[2] = cz + Math.sin(ang)*ox
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3))
      scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: col, size: 0.22, sizeAttenuation: true })))
    }
  }

  // Star formation clusters — decorative groupings in the far background
  const CLUSTER_COUNT = 6
  for (let cl = 0; cl < CLUSTER_COUNT; cl++) {
    const cx = (Math.random()-0.5)*140, cy = (Math.random()-0.5)*140, cz = (Math.random()-0.5)*140
    const clN = 12 + Math.floor(Math.random() * 20)
    const cpos = new Float32Array(clN * 3)
    const spread = 2 + Math.random() * 4
    const hue = Math.random()
    for (let k = 0; k < clN; k++) {
      cpos[k*3]   = cx + (Math.random()-0.5)*spread
      cpos[k*3+1] = cy + (Math.random()-0.5)*spread * 0.3  // flattened disk shape
      cpos[k*3+2] = cz + (Math.random()-0.5)*spread
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cpos, 3))
    const clusterCol = new THREE.Color().setHSL(hue, 0.55, 0.7)
    scene.add(new THREE.Points(cg, new THREE.PointsMaterial({ color: clusterCol, size: 0.13, transparent: true, opacity: 0.7 })))
  }
})()

// ---------------------------------------------------------------------------
// Starting systems
// ---------------------------------------------------------------------------
interface System {
  id: number
  localPos: THREE.Vector3
  dot: THREE.Mesh
  color: THREE.Color
  rings: Array<{ mesh: THREE.Mesh; phase: number }>
  pulseSpeed: number
  maxScale: number
  audio: SystemLoop
  audioSeed: number
}

function randomSpherePoint(): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  return new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi))
}

function randomSystemColor(): THREE.Color {
  return new THREE.Color().setHSL(Math.random(), 0.7 + Math.random() * 0.3, 0.55 + Math.random() * 0.2)
}

const systems: System[] = []
const systemCount = 9

for (let i = 0; i < systemCount; i++) {
  const localPos = randomSpherePoint()
  const normal = localPos.clone().normalize()
  const color = randomSystemColor()
  const pulseSpeed = 0.3 + Math.random() * 0.7
  const maxScale = 2.0 + Math.random() * 2.5
  const dotR = 0.014 + Math.random() * 0.018

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(dotR, 12, 12),
    new THREE.MeshBasicMaterial({ color: color.clone() })
  )
  dot.position.copy(localPos)
  galaxy.add(dot)

  const rings: System['rings'] = []
  for (let r = 0; r < 3; r++) {
    const ir = dotR * 1.4
    const rm = new THREE.Mesh(
      new THREE.RingGeometry(ir, ir * 1.55, 48),
      new THREE.MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    )
    rm.position.copy(localPos.clone().multiplyScalar(1.005))
    rm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    galaxy.add(rm)
    rings.push({ mesh: rm, phase: r / 3 })
  }

  const audioSeed = Math.round((localPos.x + localPos.y + localPos.z + 3) * 1e6)
  systems.push({ id: i, localPos, dot, color, rings, pulseSpeed, maxScale, audio: new SystemLoop(audioSeed), audioSeed })
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
// "Start here?" label
const label = document.createElement('div')
label.style.cssText = `
  position:fixed; font-family:'Courier New',monospace; font-size:13px;
  letter-spacing:.12em; pointer-events:none; display:none; white-space:nowrap;
`
document.body.appendChild(label)

// Thought bubble for Goldilocks planets
const thoughtBubble = document.createElement('div')
thoughtBubble.style.cssText = `
  position:fixed; font-family:'Courier New',monospace; font-size:11px;
  line-height:1.5; letter-spacing:.06em; pointer-events:none; display:none;
  max-width:260px; padding:14px 18px; background:rgba(0,8,16,0.88);
  border:1px solid rgba(68,255,170,0.35); border-radius:8px;
  color:rgba(255,255,255,0.85); box-shadow:0 0 24px rgba(68,255,170,0.15);
`
document.body.appendChild(thoughtBubble)

// Thought bubble tail (pointer)
const bubbleTail = document.createElement('div')
bubbleTail.style.cssText = `
  position:absolute; width:0; height:0;
  border-left:8px solid transparent; border-right:8px solid transparent;
  border-top:10px solid rgba(68,255,170,0.35);
  bottom:-10px; left:20px;
`
thoughtBubble.appendChild(bubbleTail)

// Black fade overlay
const overlay = document.createElement('div')
overlay.style.cssText = `
  position:fixed; inset:0; background:#000; pointer-events:none;
  opacity:0; transition:opacity 0.4s ease;
`
document.body.appendChild(overlay)

// Corner nav — appears in any corner on hover while in solar-system view
const CORNER_MARGIN = 96  // px from edge counts as "in corner"
const cornerDefs = [
  { top: '18px',  left:  '18px',  text: '↙ start over' },
  { top: '18px',  right: '18px',  text: '↘ start over' },
  { bottom: '18px', left: '18px', text: '↗ start over' },
  { bottom: '18px', right: '18px', text: '↖ start over' },
]
const cornerEls = cornerDefs.map(def => {
  const el = document.createElement('div')
  el.textContent = def.text
  const pos = Object.entries(def)
    .filter(([k]) => k !== 'text')
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
  el.style.cssText = `
    position:fixed; ${pos};
    font-family:'Courier New',monospace; font-size:11px; letter-spacing:.12em;
    color:rgba(255,255,255,0); pointer-events:none; display:none;
    transition:color 0.25s ease; white-space:nowrap;
  `
  document.body.appendChild(el)
  return el
})

let activeCorner = -1   // which corner is currently lit (-1 = none)
let mouseScreenX = 0, mouseScreenY = 0

// ---------------------------------------------------------------------------
// Phenomena — toggleable solar system animations
// ---------------------------------------------------------------------------
const PHENOMENON_DEFS: { key: PhenomenonKey; label: string }[] = [
  { key: 'radio',     label: 'Radio Signals'  },
  { key: 'ufo',       label: 'UFO Scout'      },
  { key: 'comet',     label: 'Comet'          },
  { key: 'lights',    label: 'City Lights'    },
  { key: 'formation', label: 'Formation'      },
  { key: 'anomaly',   label: 'Anomaly'        },
]

const phenomenaActive: Partial<Record<PhenomenonKey, boolean>> = {}
const phenomenaInstances: Partial<Record<PhenomenonKey, Phenomenon>> = {}
PHENOMENON_DEFS.forEach(d => { phenomenaActive[d.key] = false })

// Left-side toggle panel — only visible in solar-system state
const phenomenaPanel = document.createElement('div')
phenomenaPanel.style.cssText = `
  position:fixed; left:18px; top:50%; transform:translateY(-50%);
  display:none; flex-direction:column; gap:6px;
`
document.body.appendChild(phenomenaPanel)

const phenomenaBtns: Partial<Record<PhenomenonKey, HTMLElement>> = {}
PHENOMENON_DEFS.forEach(({ key, label }) => {
  const btn = document.createElement('div')
  btn.style.cssText = `
    font-family:'Courier New',monospace; font-size:10px; letter-spacing:.1em;
    color:rgba(255,255,255,0.3); cursor:pointer; user-select:none;
    transition:color .15s; white-space:nowrap; padding:2px 0;
  `
  btn.textContent = `○ ${label}`
  // Accessibility improvements
  btn.setAttribute('role', 'button')
  btn.setAttribute('aria-label', `Toggle ${label} phenomenon`)
  btn.setAttribute('aria-pressed', 'false')
  btn.setAttribute('tabindex', '0')
  
  btn.addEventListener('click', () => togglePhenomenon(key))
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      togglePhenomenon(key)
    }
  })
  
  phenomenaPanel.appendChild(btn)
  phenomenaBtns[key] = btn
})

function togglePhenomenon(key: PhenomenonKey) {
  const wasOn = phenomenaActive[key]
  phenomenaActive[key] = !wasOn

  if (wasOn) {
    // Turn off: remove from scene
    const inst = phenomenaInstances[key]
    if (inst) { solarSystem?.group ? scene.remove(inst.group) : null; inst.dispose(); delete phenomenaInstances[key] }
    // Also remove from solar system group if it was added there
    const existing = phenomenaInstances[key]
    if (existing && solarSystem) { scene.remove(existing.group) }
  } else {
    // Turn on: create and add to scene
    spawnPhenomenon(key)
  }
  updatePhenomenaUI()
}

function spawnPhenomenon(key: PhenomenonKey) {
  if (!solarSystem) return
  const seed = (selectedSystem?.audioSeed ?? 0) + key.charCodeAt(0)
  let inst: Phenomenon | null = null
  switch (key) {
    case 'radio':     inst = createRadio(solarSystem.planetInfos); break
    case 'ufo':       inst = createUFO(seed, solarSystem.planetInfos); break
    case 'comet':     inst = createComet(seed); break
    case 'lights':    inst = createCityLights(seed, solarSystem.planetInfos); break
    case 'formation': inst = createFormation(seed); break
    case 'anomaly':   inst = createAnomaly(seed); break
  }
  if (inst) {
    scene.add(inst.group)
    // Apply solar system's tilt so phenomena align with the system plane
    inst.group.rotation.copy(solarSystem.group.rotation)
    phenomenaInstances[key] = inst
  }
}

function updatePhenomenaUI() {
  for (const { key } of PHENOMENON_DEFS) {
    const on  = phenomenaActive[key]
    const btn = phenomenaBtns[key]
    if (!btn) continue
    const label = PHENOMENON_DEFS.find(d => d.key === key)!.label
    btn.textContent = `${on ? '●' : '○'} ${label}`
    btn.style.color = on ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)'
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  }
}

// ---------------------------------------------------------------------------
// Galaxy phenomena — toggleable star-layer animations
// ---------------------------------------------------------------------------
const GALAXY_PHENOMENON_DEFS: { key: GalaxyPhenomenonKey; label: string }[] = [
  { key: 'nebulae',      label: 'Nebulae'        },
  { key: 'signalweb',    label: 'Signal Web'     },
  { key: 'streams',      label: 'Star Streams'   },
  { key: 'wormhole',     label: 'Wormhole'       },
  { key: 'pulsars',      label: 'Pulsars'        },
  { key: 'void',         label: 'Void'           },
  { key: 'messier',      label: 'Deep-Sky Objects'},
  { key: 'randomoddness',label: 'Random Oddness' },
]

const galaxyPhenomenaActive: Partial<Record<GalaxyPhenomenonKey, boolean>> = {}
const galaxyPhenomenaInstances: Partial<Record<GalaxyPhenomenonKey, GalaxyPhenomenon>> = {}
GALAXY_PHENOMENON_DEFS.forEach(d => { galaxyPhenomenaActive[d.key] = false })

const galaxyPhenomenaPanel = document.createElement('div')
galaxyPhenomenaPanel.style.cssText = `
  position:fixed; left:18px; top:50%; transform:translateY(-50%);
  display:flex; flex-direction:column; gap:6px;
`
document.body.appendChild(galaxyPhenomenaPanel)

const galaxyPhenomenaBtns: Partial<Record<GalaxyPhenomenonKey, HTMLElement>> = {}
GALAXY_PHENOMENON_DEFS.forEach(({ key, label }) => {
  const btn = document.createElement('div')
  btn.style.cssText = `
    font-family:'Courier New',monospace; font-size:10px; letter-spacing:.1em;
    color:rgba(255,255,255,0.3); cursor:pointer; user-select:none;
    transition:color .15s; white-space:nowrap; padding:2px 0;
  `
  btn.textContent = `○ ${label}`
  // Accessibility improvements
  btn.setAttribute('role', 'button')
  btn.setAttribute('aria-label', `Toggle ${label} galaxy phenomenon`)
  btn.setAttribute('aria-pressed', 'false')
  btn.setAttribute('tabindex', '0')
  
  btn.addEventListener('click', () => toggleGalaxyPhenomenon(key))
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleGalaxyPhenomenon(key)
    }
  })
  
  galaxyPhenomenaPanel.appendChild(btn)
  galaxyPhenomenaBtns[key] = btn
})

function toggleGalaxyPhenomenon(key: GalaxyPhenomenonKey) {
  const wasOn = galaxyPhenomenaActive[key]
  galaxyPhenomenaActive[key] = !wasOn
  if (wasOn) {
    const inst = galaxyPhenomenaInstances[key]
    if (inst) { scene.remove(inst.group); inst.dispose(); delete galaxyPhenomenaInstances[key] }
    if (key === 'randomoddness') randomOddnessActive = false
  } else {
    spawnGalaxyPhenomenon(key)
  }
  updateGalaxyPhenomenaUI()
}

function spawnGalaxyPhenomenon(key: GalaxyPhenomenonKey) {
  const seed = key.charCodeAt(0) * 9999
  const sysPositions = systems.map(s => s.localPos.clone().applyMatrix4(galaxy.matrixWorld))
  let inst: GalaxyPhenomenon | null = null
  switch (key) {
    case 'nebulae':      inst = createNebulae(seed); break
    case 'signalweb':    inst = createSignalWeb(seed, sysPositions); break
    case 'streams':      inst = createStarStreams(seed); break
    case 'wormhole':     inst = createWormhole(seed); break
    case 'pulsars':      inst = createPulsars(seed, sysPositions); break
    case 'void':         inst = createVoid(seed); break
    case 'messier':      inst = createMessierObjects(seed); break
    case 'randomoddness':inst = createRandomOddnessStub(); randomOddnessActive = true; scheduleNextOddness(); break
  }
  if (inst) { scene.add(inst.group); galaxyPhenomenaInstances[key] = inst }
}

// Random Oddness — master timer that randomly flips other phenomena on/off
let randomOddnessActive = false
let randomOddnessTimer  = 0

function scheduleNextOddness() {
  randomOddnessTimer = 6 + Math.random() * 12   // 6–18 s between events
}

function tickRandomOddness(dt: number) {
  if (!randomOddnessActive) return
  randomOddnessTimer -= dt
  if (randomOddnessTimer > 0) return
  scheduleNextOddness()
  // Pick a random non-oddness key and toggle it
  const ODDS_KEYS: GalaxyPhenomenonKey[] = ['nebulae', 'signalweb', 'streams', 'wormhole', 'pulsars', 'void', 'messier']
  const key = ODDS_KEYS[Math.floor(Math.random() * ODDS_KEYS.length)]
  toggleGalaxyPhenomenon(key)
}

function updateGalaxyPhenomenaUI() {
  for (const { key } of GALAXY_PHENOMENON_DEFS) {
    const on  = galaxyPhenomenaActive[key]
    const btn = galaxyPhenomenaBtns[key]
    if (!btn) continue
    const label = GALAXY_PHENOMENON_DEFS.find(d => d.key === key)!.label
    btn.textContent = `${on ? '●' : '○'} ${label}`
    btn.style.color = on ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)'
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  }
}

function teardownAllGalaxyPhenomena() {
  for (const key of Object.keys(galaxyPhenomenaInstances) as GalaxyPhenomenonKey[]) {
    const inst = galaxyPhenomenaInstances[key]
    if (inst) { scene.remove(inst.group); inst.dispose(); delete galaxyPhenomenaInstances[key] }
  }
  GALAXY_PHENOMENON_DEFS.forEach(d => { galaxyPhenomenaActive[d.key] = false })
  randomOddnessActive = false
  updateGalaxyPhenomenaUI()
}

function teardownAllPhenomena() {
  for (const key of Object.keys(phenomenaInstances) as PhenomenonKey[]) {
    const inst = phenomenaInstances[key]
    if (inst) { scene.remove(inst.group); inst.dispose(); delete phenomenaInstances[key] }
  }
  PHENOMENON_DEFS.forEach(d => { phenomenaActive[d.key] = false })
  updatePhenomenaUI()
}

// ---------------------------------------------------------------------------
// Story fragments — shown on hover instead of "Start here?"
// ---------------------------------------------------------------------------
const SYSTEM_STORIES = [
  'something ancient drifts here...',
  'the light took ten thousand years to reach you',
  'they called it the eye of nothing',
  'a signal repeated once, then stopped',
  'three moons, no shadows',
  'the rocks here remember water',
  'it whispers in a frequency we almost understand',
  'here the spiral arm grows thin',
  'what grew here outgrew the star',
  'the survey team never filed a report',
  'its orbit should not be possible',
  'the atmosphere is the wrong color',
  'the mathematics suggests a second sun, long gone',
  'magnetic north points inward',
  'the core sings at the same frequency as thought',
]

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
type AppState = 'galaxy' | 'zooming-in' | 'solar-system' | 'zooming-out' | 'planet'
let state: AppState = 'galaxy'
let selectedSystem: System | null = null
let solarSystem: SolarSystem | null = null
let planetView: PlanetView | null = null
let currentHoveredPlanetIdx = -1
let stickyPlanetIdx = -1       // last hovered planet — persists for a few seconds
let stickyPlanetExpiry = 0     // animTime when sticky bubble should hide
let solarCamAngle = 0  // kept for compat; replaced by theta/phi
let solarCamTheta = 0        // azimuth around Y
let solarCamPhi   = Math.PI / 3  // elevation from top (radians)
let solarCamDist  = 14
let solarCamDistTarget = 14
const SOLAR_CAM_DIST_MIN = 3
const SOLAR_CAM_DIST_MAX = 28
let solarVelTheta = 0
let solarVelPhi   = 0
let solarDragSpeed = 0
let zoomT = 0           // 0→1 for zoom-in, 1→0 for zoom-out
let zoomStartCamPos = new THREE.Vector3()
let zoomTargetCamPos = new THREE.Vector3()

function setGalaxyOpacity(alpha: number) {
  galaxy.material.opacity = 0.18 * alpha
  ;(galaxy.material as THREE.MeshStandardMaterial).transparent = true
  ;(hexGrid.material as THREE.LineBasicMaterial).opacity = 0.2 * alpha
  for (const sys of systems) {
    ;(sys.dot.material as THREE.MeshBasicMaterial).opacity = alpha
    for (const ring of sys.rings) {
      ;(ring.mesh.material as THREE.MeshBasicMaterial).opacity = alpha * 0.7
    }
  }
}

function startZoomIn(sys: System) {
  if (state !== 'galaxy') return
  state = 'zooming-in'
  selectedSystem = sys
  zoomT = 0
  zoomStartCamPos.copy(camera.position)
  // Target: from the direction of the system point, just above sphere surface
  sys.localPos.clone().applyMatrix4(galaxy.matrixWorld).normalize().multiplyScalar(1.6)
  zoomTargetCamPos.copy(sys.localPos).applyMatrix4(galaxy.matrixWorld).normalize().multiplyScalar(1.6)
  if (activeAudio) { activeAudio.stop(); activeAudio = null }
}

function enterSolarSystem() {
  hoveredSystem = null   // clear stale galaxy hover so mouseup can't retrigger zoom-in
  stickyPlanetIdx = -1
  galaxyGroup.visible = false
  galaxyPhenomenaPanel.style.display = 'none'
  const sys = selectedSystem!
  solarSystem = new SolarSystem(sys.audioSeed, sys.color, sys.pulseSpeed)
  scene.add(solarSystem.group)
  solarCamTheta = 0
  solarCamPhi   = Math.PI / 3
  solarCamDist  = 14
  solarCamDistTarget = 14
  solarVelTheta = 0
  solarVelPhi   = 0
  const cp = solarCamPos()
  camera.position.copy(cp)
  camera.lookAt(0, 0, 0)
  state = 'solar-system'
  overlay.style.opacity = '0'
  phenomenaPanel.style.display = 'flex'
}

function goBack() {
  if (state !== 'solar-system') return
  zoomOutPrompt.style.display = 'none'
  cornerEls.forEach(el => { el.style.display = 'none' })
  thoughtBubble.style.display = 'none'
  label.style.display = 'none'
  phenomenaPanel.style.display = 'none'
  teardownAllPhenomena()
  overlay.style.opacity = '1'
  setTimeout(() => {
    if (activeAudio) { activeAudio.stop(); activeAudio = null }
    if (solarSystem) { scene.remove(solarSystem.group); solarSystem.dispose(); solarSystem = null }
    galaxyGroup.visible = true
    setGalaxyOpacity(1)
    camera.position.set(0, 0, 3)
    camera.lookAt(0, 0, 0)
    galaxyPhenomenaPanel.style.display = 'flex'
    activeCorner = -1
    cornerEls.forEach(el => { el.style.color = 'rgba(255,255,255,0)'; el.style.display = 'none' })
    state = 'galaxy'
    zoomT = 0
    overlay.style.opacity = '0'
  }, 420)
}

// (solar-system back nav is via corner hover — no button)

// ---------------------------------------------------------------------------
// Element selector UI  (shown only in planet state)
// Click a button to select an element, then paint the planet by clicking/dragging
// ---------------------------------------------------------------------------
const ELEMENTS: { key: ElementKey; label: string; color: string }[] = [
  { key: 'fire',  label: 'FIRE',  color: '#ff5500' },
  { key: 'water', label: 'WATER', color: '#0099ff' },
  { key: 'earth', label: 'EARTH', color: '#44aa22' },
  { key: 'air',   label: 'AIR',   color: '#aaccff' },
]

let selectedElement: ElementKey | null = null

const elementBar = document.createElement('div')
elementBar.style.cssText = `
  position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
  display:none; gap:10px; flex-direction:row; align-items:center;
`
document.body.appendChild(elementBar)

const elementBtns: HTMLElement[] = []
ELEMENTS.forEach(({ key, label, color }) => {
  const btn = document.createElement('div')
  btn.style.cssText = `
    font-family:'Courier New',monospace; font-size:11px; letter-spacing:.12em;
    color:${color}; border:1px solid ${color}44; padding:7px 18px; cursor:pointer;
    transition:background .15s, border-color .15s, box-shadow .15s; user-select:none;
    background:${color}0d;
  `
  btn.textContent = label
  // Accessibility improvements
  btn.setAttribute('role', 'button')
  btn.setAttribute('aria-label', `Select ${label} element`)
  btn.setAttribute('aria-pressed', 'false')
  btn.setAttribute('tabindex', '0')
  
  btn.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    selectedElement = selectedElement === key ? null : key
    updateElementUI()
  })
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectedElement = selectedElement === key ? null : key
      updateElementUI()
    }
  })
  elementBar.appendChild(btn)
  elementBtns.push(btn)
})

function updateElementUI() {
  ELEMENTS.forEach(({ key, color }, i) => {
    const active = selectedElement === key
    // Subtle resonance hint: · if planet wants more of this element
    const mix = planetView?.currentMix ?? DEFAULT_MIX
    const isHinted = planetView && (planetView.resonance[key] - mix[key] > 0.14)
    const hint = isHinted ? ' ·' : ''
    elementBtns[i].textContent = `${ELEMENTS[i].label}${hint}`
    elementBtns[i].setAttribute('aria-pressed', active ? 'true' : 'false')
    if (active) {
      elementBtns[i].style.background   = `${color}44`
      elementBtns[i].style.borderColor  = color
      elementBtns[i].style.boxShadow    = `0 0 14px ${color}88`
    } else {
      elementBtns[i].style.background   = isHinted ? `${color}22` : `${color}0d`
      elementBtns[i].style.borderColor  = isHinted ? `${color}99` : `${color}44`
      elementBtns[i].style.boxShadow    = 'none'
    }
  })
}

// ---------------------------------------------------------------------------
// Seeding event picker UI
// ---------------------------------------------------------------------------
const eventPicker = document.createElement('div')
eventPicker.style.cssText = `
  position:fixed; inset:0; display:none; align-items:center; justify-content:center;
  flex-direction:column; gap:20px; background:rgba(0,0,4,0.82); z-index:10;
`
document.body.appendChild(eventPicker)

const eventTitle = document.createElement('div')
eventTitle.style.cssText = `
  font-family:'Courier New',monospace; font-size:13px; letter-spacing:.18em;
  color:rgba(255,255,255,0.55); text-transform:uppercase;
`
eventTitle.textContent = 'Choose a seeding event'
eventPicker.appendChild(eventTitle)

const eventWorldHint = document.createElement('div')
eventWorldHint.style.cssText = `
  font-family:'Courier New',monospace; font-size:10px; letter-spacing:.14em;
  color:rgba(255,200,100,0.0); transition:color 0.4s; text-align:center;
`
eventPicker.appendChild(eventWorldHint)

const eventGrid = document.createElement('div')
eventGrid.style.cssText = `display:grid; grid-template-columns:repeat(3,1fr); gap:10px; max-width:480px; width:100%;`
eventPicker.appendChild(eventGrid)

function showEventPicker(onSelect: (ev: SeedEvent) => void) {
  eventGrid.innerHTML = ''
  const all = [...SEED_EVENTS, null]  // null = random
  for (const ev of all) {
    const btn = document.createElement('div')
    const label = ev ? `${ev.emoji} ${ev.label}` : '? Random'
    const col = ev ? '#' + ev.flashColor.getHexString() : '#ffffff'
    btn.style.cssText = `
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:.1em;
      color:${col}; border:1px solid ${col}44; padding:10px 8px; cursor:pointer;
      text-align:center; transition:background .2s, border-color .2s;
      background:${col}0a; white-space:nowrap;
    `
    btn.textContent = label
    btn.addEventListener('mouseenter', () => { btn.style.background = `${col}22`; btn.style.borderColor = col })
    btn.addEventListener('mouseleave', () => { btn.style.background = `${col}0a`; btn.style.borderColor = `${col}44` })
    btn.addEventListener('click', () => {
      eventPicker.style.display = 'none'
      const chosen = ev ?? SEED_EVENTS[Math.floor(Math.random() * SEED_EVENTS.length)]
      onSelect(chosen)
    })
    eventGrid.appendChild(btn)
  }
  eventPicker.style.display = 'flex'
}

let currentPlanetIdx = -1

// Planet enter / exit
function enterPlanet(idx: number) {
  if (state !== 'solar-system' || !solarSystem) return
  const pi = solarSystem.planetInfos[idx]
  currentPlanetIdx = idx
  thoughtBubble.style.display = 'none'
  label.style.display = 'none'
  phenomenaPanel.style.display = 'none'
  overlay.style.opacity = '1'
  setTimeout(() => {
    if (solarSystem) solarSystem.group.visible = false
    selectedElement = null
    planetView = new PlanetView(idx * 999 + (selectedSystem?.audioSeed ?? 0), pi.baseColor, pi.tempNorm)
    scene.add(planetView.group)
    camera.position.set(0, 0, 2.4)
    camera.lookAt(0, 0, 0)
    state = 'planet'
    elementBar.style.display = 'flex'
    backToSystemBtn.style.display = 'block'
    restartBtn.style.display = 'block'
    planetStatus.style.display = 'block'
    updateElementUI()
    overlay.style.opacity = '0'
    // Show world-temperature hint in event picker
    if (pi.tempNorm > 0.65) {
      eventWorldHint.textContent = '🔥 hot world — fire resists all other elements'
      eventWorldHint.style.color = 'rgba(255,140,60,0.65)'
    } else if (pi.tempNorm < 0.35) {
      eventWorldHint.textContent = '❄  frozen world — fire fades quickly in the cold'
      eventWorldHint.style.color = 'rgba(120,180,255,0.65)'
    } else {
      eventWorldHint.textContent = '◌ temperate world — elements are in balance'
      eventWorldHint.style.color = 'rgba(255,255,255,0.35)'
    }
    // Planet is paused until event picker is dismissed
    showEventPicker(applyEvent)
  }, 420)
}

// Back-to-solar-system button (top-left, always visible in planet state)
const backToSystemBtn = document.createElement('div')
backToSystemBtn.textContent = '← system'
backToSystemBtn.style.cssText = `
  position:fixed; top:18px; left:18px;
  font-family:'Courier New',monospace; font-size:11px; letter-spacing:.14em;
  color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.12);
  padding:5px 14px; cursor:pointer; display:none;
  transition:color .2s, border-color .2s; background:rgba(0,0,8,0.5);
`
// Accessibility improvements
backToSystemBtn.setAttribute('role', 'button')
backToSystemBtn.setAttribute('aria-label', 'Return to solar system view')
backToSystemBtn.setAttribute('tabindex', '0')

backToSystemBtn.addEventListener('mouseenter', () => { backToSystemBtn.style.color = 'rgba(255,255,255,0.85)'; backToSystemBtn.style.borderColor = 'rgba(255,255,255,0.45)' })
backToSystemBtn.addEventListener('mouseleave', () => { backToSystemBtn.style.color = 'rgba(255,255,255,0.35)'; backToSystemBtn.style.borderColor = 'rgba(255,255,255,0.12)' })
backToSystemBtn.addEventListener('click', () => { if (state === 'planet') exitPlanet() })
backToSystemBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (state === 'planet') exitPlanet()
  }
})
document.body.appendChild(backToSystemBtn)

// Zoom-out prompt — shown in solar system when camera is near max distance
const zoomOutPrompt = document.createElement('div')
zoomOutPrompt.textContent = '↑ scroll to return to galaxy'
zoomOutPrompt.style.cssText = `
  position:fixed; bottom:18px; left:50%; transform:translateX(-50%);
  font-family:'Courier New',monospace; font-size:10px; letter-spacing:.14em;
  color:rgba(255,255,255,0); pointer-events:none; display:none; transition:color 0.8s;
  white-space:nowrap;
`
document.body.appendChild(zoomOutPrompt)

// Planet status bar (match score + coverage)
const planetStatus = document.createElement('div')
planetStatus.style.cssText = `
  position:fixed; top:18px; left:50%; transform:translateX(-50%);
  font-family:'Courier New',monospace; font-size:10px; letter-spacing:.14em;
  color:rgba(255,255,255,0.38); pointer-events:none; display:none; white-space:nowrap;
`
document.body.appendChild(planetStatus)

// Restart button (planet view) — top-right corner, unobtrusive
const restartBtn = document.createElement('div')
restartBtn.textContent = '↺ reseed'
restartBtn.style.cssText = `
  position:fixed; top:18px; right:18px;
  font-family:'Courier New',monospace; font-size:11px; letter-spacing:.14em;
  color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.12);
  padding:5px 14px; cursor:pointer; display:none;
  transition:color .2s, border-color .2s; background:rgba(0,0,8,0.5);
`
// Accessibility improvements
restartBtn.setAttribute('role', 'button')
restartBtn.setAttribute('aria-label', 'Restart planet with new seed')
restartBtn.setAttribute('tabindex', '0')

restartBtn.addEventListener('mouseenter', () => { restartBtn.style.color = 'rgba(255,255,255,0.85)'; restartBtn.style.borderColor = 'rgba(255,255,255,0.45)' })
restartBtn.addEventListener('mouseleave', () => { restartBtn.style.color = 'rgba(255,255,255,0.35)'; restartBtn.style.borderColor = 'rgba(255,255,255,0.12)' })
restartBtn.addEventListener('click', () => {
  if (state === 'planet') showEventPicker(applyEvent)
})
restartBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (state === 'planet') showEventPicker(applyEvent)
  }
})
document.body.appendChild(restartBtn)

function applyEvent(ev: SeedEvent) {
  document.getElementById('planet-outcome')?.remove()
  planetView?.reset(ev)
  // Pre-select the event's seed element so player can immediately start painting
  selectedElement = ev.seedElement
  updateElementUI()
}

function showOutcome(text: string, color: string) {
  const el = document.createElement('div')
  el.id = 'planet-outcome'
  el.style.cssText = `
    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    flex-direction:column; gap:22px; pointer-events:none;
  `
  const msg = document.createElement('div')
  msg.style.cssText = `
    font-family:'Courier New',monospace; font-size:28px; letter-spacing:.3em;
    color:${color}; text-shadow:0 0 40px ${color}; text-transform:uppercase;
    animation:fadeIn 1.2s ease;
  `
  msg.textContent = text
  const sub = document.createElement('div')
  sub.style.cssText = `
    font-family:'Courier New',monospace; font-size:11px; letter-spacing:.18em;
    color:rgba(255,255,255,0.45); pointer-events:auto; cursor:pointer;
  `
  sub.textContent = text === 'attuned' ? 'click to reseed a new world' : 'click to try again'
  sub.addEventListener('click', () => {
    el.remove()
    showEventPicker(applyEvent)
  })
  el.appendChild(msg)
  if (text !== 'attuned') {
    const tale = document.createElement('div')
    tale.style.cssText = `
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:.12em;
      color:rgba(255,255,255,0.28); max-width:420px; text-align:center;
      line-height:1.7; animation:fadeIn 2.8s ease;
    `
    tale.textContent = PlanetView.randomEonTale()
    el.appendChild(tale)
  }
  el.appendChild(sub)
  document.body.appendChild(el)
  if (!document.getElementById('planet-outcome-style')) {
    const s = document.createElement('style')
    s.id = 'planet-outcome-style'
    s.textContent = `@keyframes fadeIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }`
    document.head.appendChild(s)
  }
}

function exitPlanet() {
  if (state !== 'planet') return
  eventPicker.style.display = 'none'
  document.getElementById('planet-outcome')?.remove()
  overlay.style.opacity = '1'
  elementBar.style.display = 'none'
  backToSystemBtn.style.display = 'none'
  restartBtn.style.display = 'none'
  planetStatus.style.display = 'none'
  label.style.display = 'none'
  thoughtBubble.style.display = 'none'
  setTimeout(() => {
    if (planetView) { scene.remove(planetView.group); planetView.dispose(); planetView = null }
    if (solarSystem) solarSystem.group.visible = true
    camera.position.copy(solarCamPos())
    camera.lookAt(0, 0, 0)
    state = 'solar-system'
    phenomenaPanel.style.display = 'flex'
    overlay.style.opacity = '0'
  }, 420)
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const mouse = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
let hoveredSystem: System | null = null
let activeAudio: SystemLoop | null = null
let isDragging = false
let isPaintDragging = false
let isPlanetSpinning = false
let planetVelX = 0, planetVelY = 0
let prevMouseX = 0, prevMouseY = 0
let velX = 0, velY = 0
let dragSpeed = 0
let timeScale = 1.0
let animTime = 0
let prevT = 0
let mouseX = 0, mouseY = 0

// Safe raycaster helper with error handling
function safeRaycast(objects: THREE.Object3D | THREE.Object3D[], recursive = false): THREE.Intersection[] {
  try {
    if (Array.isArray(objects)) {
      return raycaster.intersectObjects(objects, recursive)
    } else {
      return raycaster.intersectObject(objects, recursive)
    }
  } catch (e) {
    console.error('Raycast failed:', e)
    return []
  }
}

// Compute solar camera world position from spherical coords
function solarCamPos(): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(solarCamPhi) * Math.cos(solarCamTheta) * solarCamDist,
    Math.cos(solarCamPhi) * solarCamDist,
    Math.sin(solarCamPhi) * Math.sin(solarCamTheta) * solarCamDist
  )
}

renderer.domElement.addEventListener('wheel', (e) => {
  if (state !== 'solar-system') return
  e.preventDefault()
  const delta = e.deltaY > 0 ? 1.12 : 0.89   // scroll down = zoom out
  const newDist = solarCamDistTarget * delta
  if (newDist > SOLAR_CAM_DIST_MAX && e.deltaY > 0) {
    // Scrolled past max — return to galaxy
    goBack()
    return
  }
  solarCamDistTarget = Math.max(SOLAR_CAM_DIST_MIN, Math.min(SOLAR_CAM_DIST_MAX, newDist))
}, { passive: false })

renderer.domElement.addEventListener('mousedown', (e) => {
  unlockAudio()
  if (state === 'planet') {
    prevMouseX = e.clientX; prevMouseY = e.clientY
    if (selectedElement && planetView) isPaintDragging = true
    else { isPlanetSpinning = true; planetVelX = 0; planetVelY = 0 }
    return
  }
  if (state !== 'galaxy' && state !== 'solar-system') return
  isDragging = true
  prevMouseX = e.clientX; prevMouseY = e.clientY
  if (state === 'galaxy') { velX = 0; velY = 0 }
  else { solarVelTheta = 0; solarVelPhi = 0 }
})

document.addEventListener('mouseup', (e) => {
  if (state === 'planet') {
    isPaintDragging = false
    isPlanetSpinning = false
    return
  }
  if (!isDragging) return
  isDragging = false
  const dx = e.clientX - prevMouseX
  const dy = e.clientY - prevMouseY
  if (state === 'galaxy') {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && hoveredSystem) startZoomIn(hoveredSystem)
  } else if (state === 'solar-system') {
    if (activeCorner >= 0) goBack()
    else if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && currentHoveredPlanetIdx >= 0) {
      enterPlanet(currentHoveredPlanetIdx)
    }
  }
})

document.addEventListener('mousemove', (e) => {
  mouseScreenX = e.clientX
  mouseScreenY = e.clientY
  mouseX = (e.clientX / window.innerWidth) * 2 - 1
  mouseY = -((e.clientY / window.innerHeight) * 2 - 1)
  mouse.set(mouseX, mouseY)
  if (state === 'planet' && isPlanetSpinning && planetView) {
    const dx = e.clientX - prevMouseX
    const dy = e.clientY - prevMouseY
    const scale = (Math.PI * 2) / window.innerHeight
    planetVelX = dy * scale
    planetVelY = dx * scale
    planetView.group.rotation.x += planetVelX
    planetView.group.rotation.y += planetVelY
    prevMouseX = e.clientX; prevMouseY = e.clientY
    return
  }

  if (!isDragging) return
  const dx = e.clientX - prevMouseX
  const dy = e.clientY - prevMouseY
  const scale = (Math.PI * 2) / window.innerHeight

  if (state === 'galaxy') {
    velX = dy * scale; velY = dx * scale
    dragSpeed = Math.sqrt(dx * dx + dy * dy)
    galaxy.rotation.x += velX; galaxy.rotation.y += velY
    hexGrid.rotation.copy(galaxy.rotation)
  } else if (state === 'solar-system') {
    solarVelTheta = dx * scale
    solarVelPhi   = dy * scale
    solarDragSpeed = Math.sqrt(dx * dx + dy * dy)
    solarCamTheta += solarVelTheta
    solarCamPhi = Math.max(0.05, Math.min(Math.PI - 0.05, solarCamPhi + solarVelPhi))
  }
  prevMouseX = e.clientX; prevMouseY = e.clientY
})

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

// ---------------------------------------------------------------------------
// Animate
// ---------------------------------------------------------------------------
const tempVec = new THREE.Vector3()

function animate(t: number) {
  requestAnimationFrame(animate)
  const dt = Math.min((t - prevT) * 0.001, 0.05)
  prevT = t

  if (state === 'galaxy') {
    // Time warp + inertia
    const targetScale = isDragging ? 1 + dragSpeed * 0.18 : 1.0
    timeScale += (targetScale - timeScale) * 0.06
    dragSpeed *= 0.8
    animTime += dt * timeScale

    if (!isDragging) {
      velX += (mouseY * 0.00018 - velX) * 0.027
      velY += (mouseX * 0.00018 + 0.00033 - velY) * 0.027
      galaxy.rotation.x += velX
      galaxy.rotation.y += velY
      hexGrid.rotation.copy(galaxy.rotation)
    }

    // Ring animation
    for (const sys of systems) {
      for (const ring of sys.rings) {
        const phase = (animTime * sys.pulseSpeed + ring.phase) % 1
        ring.mesh.scale.setScalar(1 + phase * (sys.maxScale - 1))
        ;(ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.7
      }
    }

    // Hover
    raycaster.setFromCamera(mouse, camera)
    const hits = safeRaycast(galaxy)
    let newHovered: System | null = null
    if (hits.length > 0) {
      const localHit = galaxy.worldToLocal(hits[0].point.clone()).normalize()
      let minDist = Infinity
      for (const sys of systems) {
        const d = localHit.distanceTo(sys.localPos)
        if (d < minDist) { minDist = d; newHovered = sys }
      }
      if (minDist > 0.22) newHovered = null
    }

    if (newHovered !== hoveredSystem) {
      if (activeAudio) { activeAudio.stop(); activeAudio = null }
      if (newHovered) { newHovered.audio.start(); activeAudio = newHovered.audio }
      hoveredSystem = newHovered
    }

    for (const sys of systems) {
      const mat = sys.dot.material as THREE.MeshBasicMaterial
      mat.color.lerp(sys === hoveredSystem ? new THREE.Color(0xffffff) : sys.color, 0.15)
    }

    // Hover zoom — gently pull camera toward hovered system
    if (hoveredSystem && !isDragging) {
      const targetDist = 2.0
      const currentDist = camera.position.length()
      camera.position.setLength(currentDist + (targetDist - currentDist) * 0.018)
    } else if (!isDragging) {
      const currentDist = camera.position.length()
      camera.position.setLength(currentDist + (3.0 - currentDist) * 0.04)
    }

    // Story fragment label + audio swell on hover
    if (hoveredSystem && !isDragging) {
      if (activeAudio) activeAudio.setVolume?.(0.8)
      tempVec.copy(hoveredSystem.localPos).applyMatrix4(galaxy.matrixWorld)
      tempVec.project(camera)
      const sx = (tempVec.x * 0.5 + 0.5) * window.innerWidth
      const sy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight
      const hex = '#' + hoveredSystem.color.getHexString()
      label.style.display = 'block'
      label.style.left = `${sx + 18}px`
      label.style.top = `${sy - 8}px`
      label.style.color = hex
      label.style.textShadow = `0 0 10px ${hex}, 0 0 22px ${hex}88`
      label.textContent = SYSTEM_STORIES[hoveredSystem.id % SYSTEM_STORIES.length]
      renderer.domElement.style.cursor = 'pointer'
    } else {
      if (activeAudio) activeAudio.setVolume?.(0.4)
      label.style.display = 'none'
      renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab'
    }

    // Update galaxy phenomena
    for (const key of Object.keys(galaxyPhenomenaInstances) as GalaxyPhenomenonKey[]) {
      galaxyPhenomenaInstances[key]?.update(dt)
    }
    tickRandomOddness(dt)

  } else if (state === 'zooming-in') {
    zoomT = Math.min(zoomT + dt / 1.4, 1)
    const e = easeInOut(zoomT)

    // Move camera toward system point
    camera.position.lerpVectors(zoomStartCamPos, zoomTargetCamPos, e)
    camera.lookAt(0, 0, 0)

    // Fade galaxy from halfway through
    const fadeT = Math.max(0, (zoomT - 0.45) / 0.55)
    setGalaxyOpacity(1 - fadeT)

    if (zoomT >= 1) {
      overlay.style.opacity = '1'
      setTimeout(enterSolarSystem, 420)
      state = 'zooming-out' // prevent re-entry; enterSolarSystem sets 'solar-system'
    }

  } else if (state === 'solar-system') {
    raycaster.setFromCamera(mouse, camera)

    const starHovered = solarSystem ? safeRaycast(solarSystem.star).length > 0 : false

    // Planet hover — check all planet meshes (cache meshes for performance)
    let hoveredPlanetIdx = -1
    if (solarSystem && !starHovered) {
      const meshes = solarSystem.planetInfos.map(p => p.mesh)
      const hits = safeRaycast(meshes)
      if (hits.length > 0) hoveredPlanetIdx = meshes.indexOf(hits[0].object as THREE.Mesh)
    }
    currentHoveredPlanetIdx = hoveredPlanetIdx  // expose for mouseup

    // Audio: star hover plays the system loop
    const wantAudio = starHovered
    if (wantAudio && !activeAudio && selectedSystem) {
      selectedSystem.audio.start(); activeAudio = selectedSystem.audio
    } else if (!wantAudio && activeAudio) {
      activeAudio.stop(); activeAudio = null
    }

    // Sticky bubble: update expiry when actively hovering, linger 3s after
    if (hoveredPlanetIdx >= 0) {
      stickyPlanetIdx   = hoveredPlanetIdx
      stickyPlanetExpiry = animTime + 3.0
    }
    const showIdx = (stickyPlanetIdx >= 0 && animTime < stickyPlanetExpiry) ? stickyPlanetIdx : -1

    // Fade bubble out over last 0.6s of linger
    const stickyAge   = stickyPlanetExpiry - animTime   // counts down to 0
    const bubbleAlpha = hoveredPlanetIdx >= 0 ? 1 : Math.max(0, Math.min(1, stickyAge / 0.6))

    if (showIdx >= 0 && solarSystem) {
      const pi = solarSystem.planetInfos[showIdx]
      tempVec.copy(pi.mesh.position).applyMatrix4(solarSystem.group.matrixWorld)
      tempVec.project(camera)
      const sx = (tempVec.x * 0.5 + 0.5) * window.innerWidth
      const sy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight
      const hex = '#' + pi.tint.getHexString()

      if (pi.isGoldilocks && pi.lifeStory) {
        label.style.display = 'none'
        thoughtBubble.style.display = 'block'
        thoughtBubble.style.opacity = String(bubbleAlpha)
        thoughtBubble.style.left = `${sx + 18}px`
        thoughtBubble.style.top  = `${sy - 80}px`
        // Safe DOM manipulation to prevent XSS
        thoughtBubble.textContent = ''
        const titleDiv = document.createElement('div')
        titleDiv.style.cssText = 'color:#44ffaa;margin-bottom:6px;font-size:10px;letter-spacing:.14em;'
        titleDiv.textContent = `✦ ${pi.label.toUpperCase()}`
        const storyDiv = document.createElement('div')
        storyDiv.textContent = pi.lifeStory
        thoughtBubble.appendChild(titleDiv)
        thoughtBubble.appendChild(storyDiv)
      } else {
        thoughtBubble.style.display = 'none'
        label.style.display = 'block'
        label.style.opacity = String(bubbleAlpha)
        label.style.left = `${sx + 14}px`
        label.style.top  = `${sy - 8}px`
        label.style.color = hex
        label.style.textShadow = `0 0 10px ${hex}`
        label.textContent = pi.label
      }
    } else {
      label.style.display = 'none'
      thoughtBubble.style.display = 'none'
      stickyPlanetIdx = -1
    }

    // Corner nav — detect which corner (if any) the mouse is in
    const W = window.innerWidth, H = window.innerHeight
    const cx = mouseScreenX, cy = mouseScreenY
    const inLeft  = cx < CORNER_MARGIN, inRight  = cx > W - CORNER_MARGIN
    const inTop   = cy < CORNER_MARGIN, inBottom = cy > H - CORNER_MARGIN
    const corner = (inLeft && inTop) ? 0 : (inRight && inTop) ? 1 : (inLeft && inBottom) ? 2 : (inRight && inBottom) ? 3 : -1

    if (corner !== activeCorner) {
      if (activeCorner >= 0) { cornerEls[activeCorner].style.color = 'rgba(255,255,255,0)'; setTimeout(() => { if (activeCorner !== corner) cornerEls[activeCorner >= 0 ? activeCorner : 0].style.display = 'none' }, 280) }
      activeCorner = corner
      if (corner >= 0) { cornerEls[corner].style.display = 'block'; requestAnimationFrame(() => { cornerEls[corner].style.color = 'rgba(255,255,255,0.55)' }) }
    }

    renderer.domElement.style.cursor = corner >= 0 ? 'pointer' : (starHovered || hoveredPlanetIdx >= 0) ? 'pointer' : (isDragging ? 'grabbing' : 'grab')
    solarSystem?.update(dt, starHovered, hoveredPlanetIdx)

    // Time warp on drag (same as galaxy)
    const solarTargetScale = isDragging ? 1 + solarDragSpeed * 0.18 : 1.0
    timeScale += (solarTargetScale - timeScale) * 0.06
    solarDragSpeed *= 0.8
    animTime += dt * timeScale

    if (!isDragging) {
      // Triple inertia + gentle mouse attraction (theta ↔ mouseX, phi ↔ -mouseY)
      solarVelTheta += (mouseX * 0.00018 + 0.00033 - solarVelTheta) * 0.027
      solarVelPhi   += (-mouseY * 0.00012 - solarVelPhi) * 0.027
      solarCamTheta += solarVelTheta
      solarCamPhi = Math.max(0.05, Math.min(Math.PI - 0.05, solarCamPhi + solarVelPhi))
    }

    // Smooth zoom
    solarCamDist += (solarCamDistTarget - solarCamDist) * 0.1

    camera.position.copy(solarCamPos())
    camera.lookAt(0, 0, 0)
    renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab'

    // Zoom-out prompt: fade in when close to max distance
    const zoomFraction = (solarCamDist - SOLAR_CAM_DIST_MAX * 0.78) / (SOLAR_CAM_DIST_MAX * 0.22)
    const promptOpacity = Math.max(0, Math.min(1, zoomFraction))
    if (promptOpacity > 0.01) {
      zoomOutPrompt.style.display = 'block'
      zoomOutPrompt.style.color = `rgba(255,255,255,${promptOpacity * 0.45})`
    } else {
      zoomOutPrompt.style.display = 'none'
    }

    // Update active phenomena
    for (const key of Object.keys(phenomenaInstances) as PhenomenonKey[]) {
      phenomenaInstances[key]?.update(dt, solarSystem?.planetInfos ?? [])
    }

  } else if (state === 'planet') {
    planetView?.update(dt)

    // Spin inertia
    if (!isPlanetSpinning && planetView) {
      planetVelX *= 0.92
      planetVelY *= 0.92
      planetView.group.rotation.x += planetVelX
      planetView.group.rotation.y += planetVelY
    }

    // Painting: raycast against planet mesh while mouse is held and element selected
    if (planetView && isPaintDragging && selectedElement) {
      raycaster.setFromCamera(mouse, camera)
      const hits = safeRaycast(planetView.group.children, false)
      if (hits.length > 0) {
        const cellIdx = planetView.nearestCell(hits[0].point)
        planetView.paint(cellIdx, selectedElement)
      }
    }

    // Update status bar
    if (planetView) {
      const pct    = Math.round(planetView.litFraction * 100)
      const att    = planetView.zoneAttunement
      const bars   = Math.round(att * 10)
      const resonBar   = '█'.repeat(bars) + '░'.repeat(10 - bars)
      const attColor   = att > 0.65 ? '#44ff88' : att > 0.35 ? '#ffdd44' : '#ff4422'
      // Zone breakdown: small colored squares per zone
      const zoneSpans: HTMLSpanElement[]  = planetView.zones.map(z => {
        const ec = ELEMENT_COLORS[z.element]
        const col = '#' + ec.getHexString()
        const fill = Math.round(z.score * 4)
        const icon = ['○','◔','◑','◕','●'][fill]
        const span = document.createElement('span')
        span.style.color = col
        span.textContent = icon
        return span
      })
      // Safe DOM manipulation to prevent XSS
      planetStatus.textContent = ''
      zoneSpans.forEach((span: HTMLSpanElement, i: number) => {
        planetStatus.appendChild(span)
        if (i < zoneSpans.length - 1) {
          planetStatus.appendChild(document.createTextNode(' '))
        }
      })
      planetStatus.appendChild(document.createTextNode('  coverage '))
      const pctSpan = document.createElement('span')
      pctSpan.style.color = '#aaa'
      pctSpan.textContent = `${pct}%`
      planetStatus.appendChild(pctSpan)
      planetStatus.appendChild(document.createTextNode('  attunement '))
      const attSpan = document.createElement('span')
      attSpan.style.color = attColor
      attSpan.textContent = resonBar
      planetStatus.appendChild(attSpan)

      updateElementUI()

      const outcome = planetView.outcome
      if (outcome === 'won' && !document.getElementById('planet-outcome')) showOutcome('attuned', '#44ff88')
      else if (outcome === 'lost' && !document.getElementById('planet-outcome')) showOutcome('planet lost', '#ff4422')
    }

    // Cursor: crosshair when hovering planet with element selected
    let planetHovered = false
    if (planetView && selectedElement) {
      raycaster.setFromCamera(mouse, camera)
      planetHovered = safeRaycast(planetView.group.children, false).length > 0
    }
    // Hide corner nav in planet state (back button replaces it)
    if (activeCorner >= 0) { cornerEls[activeCorner].style.color = 'rgba(255,255,255,0)'; cornerEls[activeCorner].style.display = 'none' }
    activeCorner = -1
    renderer.domElement.style.cursor = isPlanetSpinning ? 'grabbing' : planetHovered ? 'crosshair' : selectedElement ? 'crosshair' : 'grab'
  }

  renderer.render(scene, camera)
}
requestAnimationFrame(animate)

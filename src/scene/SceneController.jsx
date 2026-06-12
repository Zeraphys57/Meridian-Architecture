import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useNarrative } from '../narrative/NarrativeProvider'
import { actAt, localProgress, THEME_COLORS } from '../narrative/actRanges'
import { BUILDING_HEIGHT } from './Building'

const tmpFog = new THREE.Color()
const SUN_NOON = new THREE.Color('#FFFFFF')
const SUN_DUSK = new THREE.Color('#F2C18C')

const lerp = THREE.MathUtils.lerp
const damp = THREE.MathUtils.damp
const clamp01 = (x) => Math.min(1, Math.max(0, x))

// How present the WebGL layer is per act — the scene must yield the stage
// in the HTML-led acts (gallery, materials, the founder's quote).
const ACT_DIM = { 1: 1, 2: 1, 3: 1, 4: 0.35, 5: 1, 6: 0.12, 7: 0.6, 8: 1, 9: 0.28, 10: 1 }

// Maps the single global scroll progress (0-1) onto camera, building,
// ground and light state. Scroll forward = build up, back = tear down.
export default function SceneController({ buildingRef, groundRef, ambientRef, sunRef, dimRef }) {
  const { progressRef, reducedMotion } = useNarrative()
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)

  const cur = useRef({
    pos: new THREE.Vector3(0, 1.4, 26),
    look: new THREE.Vector3(0, 1.2, -80),
    sun: 1.2,
    amb: 0.4,
    sunColor: new THREE.Color('#FFFFFF'),
    sunPos: new THREE.Vector3(14, 26, 12),
    dim: 1,
  }).current
  const target = useRef({
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    sun: 1.2,
    amb: 0.4,
    sunColor: new THREE.Color('#FFFFFF'),
    sunPos: new THREE.Vector3(14, 26, 12),
  }).current

  useFrame((state, dt) => {
    const p = progressRef.current
    const t = state.clock.elapsedTime
    const act = actAt(p)
    const b = buildingRef.current
    const g = groundRef.current
    if (!b || !g) return

    const idle = reducedMotion ? 0 : 1
    let buildP = null
    let foundation = 0
    let gridO = 1
    let sectionK = 0

    target.sun = 1.2
    target.amb = 0.4
    target.sunColor.set('#FFFFFF')

    switch (act.id) {
      case 1: {
        // horizon line tilts into a surveyed ground plane
        const l = localProgress(p, 1)
        target.pos.set(0, lerp(1.4, 8, l), 26)
        target.look.set(0, lerp(1.2, 0, l), lerp(-80, 0, l))
        gridO = l
        buildP = 0
        break
      }
      case 2: {
        // foundation extrudes down — the camera dips with it
        const l = localProgress(p, 2)
        foundation = l * 4
        target.pos.set(0, lerp(8, 5.5, l), 26)
        target.look.set(0, lerp(0, -1.5, l), 0)
        buildP = 0
        break
      }
      case 3: {
        // THE RISE — floors assemble, camera orbits and climbs with the build edge
        const l = localProgress(p, 3)
        foundation = 4
        buildP = l
        const ang = l * 0.5 + Math.sin(t * 0.1) * 0.02 * idle
        const r = 26
        target.pos.set(Math.sin(ang) * r, lerp(6, 20, l), Math.cos(ang) * r)
        target.look.set(0, lerp(2, BUILDING_HEIGHT * 0.55, l), 0)
        break
      }
      case 4: {
        // the gallery leads — the tower drifts as a pale backdrop
        const l = localProgress(p, 4)
        foundation = 4
        buildP = 1
        const ang = 0.5 + t * 0.015 * idle
        const r = lerp(30, 22, l)
        target.pos.set(Math.sin(ang) * r, lerp(20, 13, l), Math.cos(ang) * r)
        target.look.set(0, lerp(BUILDING_HEIGHT * 0.55, BUILDING_HEIGHT * 0.4, l), 0)
        target.sun = 0.9
        break
      }
      case 5: {
        // WITHIN — the tower slices open, then a long slow ride up the
        // section, drifting closer through the middle floors
        const l = localProgress(p, 5)
        foundation = 4
        buildP = 1
        sectionK = Math.min(1, l * 3.2) // cut completes in the first beat
        const r0 = clamp01((l - 0.16) / 0.8)
        const rise = r0 * r0 * (3 - 2 * r0) // ease in AND out of the ascent
        const intimacy = Math.sin(rise * Math.PI) // closest at mid-ride
        target.pos.set(13.5 - intimacy * 2.4, lerp(4.5, 29, rise), 9.5 - intimacy * 1.2)
        target.look.set(-0.4, lerp(2.8, 27.6, rise), 0)
        target.sun = 0.85
        target.amb = 0.55
        break
      }
      case 6: {
        // material macro lives in HTML — the scene fades to near-black
        // while the camera HOLDS at the crown (no plunge after the ride);
        // the section seals itself invisibly in this darkness
        foundation = 4
        buildP = 1
        target.pos.set(11, 27, 16)
        target.look.set(0, 24.5, 0)
        target.sun = 0.15
        target.amb = 0.08
        break
      }
      case 7: {
        // pull WAY back from the crown — small schematic building
        const l = localProgress(p, 7)
        foundation = 4
        buildP = 1
        target.pos.set(lerp(11, 16, l), lerp(27, 62, l), lerp(16, 76, l))
        target.look.set(0, lerp(24.5, 0, l * 0.7), 0)
        target.sun = lerp(0.15, 1.0, l)
        target.amb = lerp(0.08, 0.45, l)
        break
      }
      case 8: {
        // finished tower, slow hero rotation
        foundation = 4
        buildP = 1
        const ang = t * 0.04 * idle + 0.8
        target.pos.set(Math.sin(ang) * 46, 18, Math.cos(ang) * 46)
        target.look.set(0, BUILDING_HEIGHT * 0.45, 0)
        break
      }
      case 9: {
        // soft focus, warm light
        foundation = 4
        buildP = 1
        target.pos.set(10, 9, 24)
        target.look.set(0, BUILDING_HEIGHT * 0.3, 0)
        target.sun = 0.35
        target.amb = 0.15
        target.sunColor.set('#E8C9A0')
        break
      }
      case 10: {
        // DECONSTRUCT — full circle back to the opening line
        const l = localProgress(p, 10)
        foundation = (1 - l) * 4
        buildP = 1 - l
        target.pos.set(0, lerp(9, 1.4, l), 26)
        target.look.set(0, lerp(4, 1.2, l), lerp(0, -80, l))
        gridO = 1 - l
        break
      }
      default:
        break
    }

    // drive building + ground. The construction site only exists on the
    // way UP (acts I-III) — Act IX's deconstruction is a clean dissolve,
    // not a re-mobilized site.
    const siteOn = act.id <= 3 ? 1 : 0
    if (buildP !== null) {
      b.setBuildProgress(reducedMotion ? Math.round(buildP * 4) / 4 : buildP, siteOn)
    }
    b.setFoundationDepth(foundation)
    b.setSection(sectionK, dt)
    g.setGridOpacity(act.id <= 1 || act.id === 10 ? gridO : 1)
    g.setHorizonOpacity(act.id === 1 || act.id === 10 ? 1 : 0.4)

    // sun arc — a day passes over the site as the story scrolls:
    // low morning light at the blank site, noon over the rise, dusk by the record
    {
      const az = 0.7 + p * 2.4
      const el = 0.18 + Math.sin(Math.min(1, p / 0.85) * Math.PI) * 0.85
      const r = 36
      target.sunPos.set(
        Math.cos(az) * r * Math.cos(el),
        Math.sin(el) * r + 5,
        Math.sin(az) * r * Math.cos(el)
      )
      // the light itself warms toward the end of the day
      if (act.id !== 8) {
        target.sunColor.lerpColors(SUN_NOON, SUN_DUSK, THREE.MathUtils.smoothstep(p, 0.6, 0.95))
      }
    }

    // color sync against the page background
    const dark = act.theme !== 'light'
    b.setColorMode(dark ? '#C9B896' : '#1C1B19', dark ? '#E3DDCF' : '#D9D2C2', dark, dt)
    g.setColors(dark ? '#C9B896' : '#A8946C', dark ? '#F4F1EA' : '#1C1B19', dt)
    if (scene.fog) scene.fog.color.lerp(tmpFog.set(THEME_COLORS[act.theme].bg), Math.min(1, dt * 2))

    // damped camera + lights (reduced motion snaps)
    const k = reducedMotion ? 50 : 4
    cur.pos.x = damp(cur.pos.x, target.pos.x, k, dt)
    cur.pos.y = damp(cur.pos.y, target.pos.y, k, dt)
    cur.pos.z = damp(cur.pos.z, target.pos.z, k, dt)
    cur.look.x = damp(cur.look.x, target.look.x, k, dt)
    cur.look.y = damp(cur.look.y, target.look.y, k, dt)
    cur.look.z = damp(cur.look.z, target.look.z, k, dt)
    cur.sun = damp(cur.sun, target.sun, k, dt)
    cur.amb = damp(cur.amb, target.amb, k, dt)
    cur.sunColor.lerp(target.sunColor, Math.min(1, dt * 3))
    cur.sunPos.x = damp(cur.sunPos.x, target.sunPos.x, k, dt)
    cur.sunPos.y = damp(cur.sunPos.y, target.sunPos.y, k, dt)
    cur.sunPos.z = damp(cur.sunPos.z, target.sunPos.z, k, dt)

    camera.position.copy(cur.pos)
    // handheld micro-drift — barely-there life in every shot
    if (!reducedMotion) {
      camera.position.x += Math.sin(t * 0.23) * 0.1
      camera.position.y += Math.sin(t * 0.31 + 1.7) * 0.07
      camera.position.z += Math.cos(t * 0.19) * 0.08
    }
    camera.lookAt(cur.look)
    if (sunRef.current) {
      sunRef.current.intensity = cur.sun
      sunRef.current.color.copy(cur.sunColor)
      sunRef.current.position.copy(cur.sunPos)
    }
    if (ambientRef.current) ambientRef.current.intensity = cur.amb

    // scene presence — recede behind the HTML-led acts. In the gallery the
    // tower returns to full presence as its OWN panel (07) arrives, so the
    // portfolio hands off into the live model for the section act.
    let dimT = ACT_DIM[act.id] ?? 1
    if (act.id === 4) {
      const l4 = localProgress(p, 4)
      const back = clamp01((l4 - 0.8) / 0.2)
      dimT = 0.35 + back * back * (3 - 2 * back) * 0.65
    }
    cur.dim = damp(cur.dim, dimT, 3, dt)
    if (dimRef?.current) dimRef.current.style.opacity = cur.dim.toFixed(3)
  })

  return null
}

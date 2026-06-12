import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useNarrative } from '../narrative/NarrativeProvider'
import { actAt } from '../narrative/actRanges'

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function glowTexture() {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,240,214,1)')
  g.addColorStop(0.35, 'rgba(255,232,194,0.45)')
  g.addColorStop(1, 'rgba(255,232,194,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

const tmpV = new THREE.Vector3()

// Ambient sky: drifting model-shop clouds, sunlit dust, stars at dusk,
// and a soft glow that rides the sun across its day arc.
export default function Atmosphere({ sunRef }) {
  const { progressRef, reducedMotion } = useNarrative()
  const darkF = useRef(0)

  const dustGeo = useMemo(() => {
    const rnd = mulberry32(9)
    const N = 160
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -24 + rnd() * 48
      pos[i * 3 + 1] = rnd() * 18
      pos[i * 3 + 2] = -24 + rnd() * 48
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [])
  const dustMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#C9B896',
        size: 0.07,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    []
  )
  const dustRef = useRef()

  const starGeo = useMemo(() => {
    const rnd = mulberry32(17)
    const N = 220
    const pos = new Float32Array(N * 3)
    const R = 170
    for (let i = 0; i < N; i++) {
      const phi = rnd() * Math.PI * 2
      const y = 0.15 + rnd() * 0.8
      const xz = Math.sqrt(1 - y * y)
      pos[i * 3] = Math.cos(phi) * xz * R
      pos[i * 3 + 1] = y * R
      pos[i * 3 + 2] = Math.sin(phi) * xz * R
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [])
  const starMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#F4EFE2',
        size: 1.6,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false, // stars must not dissolve into the page fog
      }),
    []
  )

  const glowTex = useMemo(() => glowTexture(), [])
  const glowMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTex,
        color: '#FFE3B8',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    [glowTex]
  )
  const glowRef = useRef()

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const p = progressRef.current
    const dark = actAt(p).theme !== 'light'
    darkF.current = THREE.MathUtils.damp(darkF.current, dark ? 1 : 0, 2.5, dt)
    const dk = darkF.current

    // dust motes — sunlit air
    if (dustRef.current && !reducedMotion) dustRef.current.rotation.y += dt * 0.006
    dustMat.opacity = (0.28 - dk * 0.12) * (0.8 + 0.2 * Math.sin(t * 0.5))

    // stars come out on the dark acts
    starMat.opacity = dk * (0.7 + (reducedMotion ? 0 : 0.18 * Math.sin(t * 1.6)))

    // sun glow rides the day arc, swelling toward dusk
    if (glowRef.current && sunRef.current) {
      tmpV.copy(sunRef.current.position).normalize().multiplyScalar(135)
      glowRef.current.position.copy(tmpV)
      const dusk = THREE.MathUtils.smoothstep(p, 0.55, 0.92)
      glowMat.opacity =
        (0.16 + dusk * 0.3) * Math.min(1.2, Math.max(0, sunRef.current.intensity)) * (1 - dk * 0.3)
      const s = 22 + dusk * 18
      glowRef.current.scale.set(s, s, 1)
    }
  })

  return (
    <group>
      <points ref={dustRef} geometry={dustGeo} material={dustMat} />
      <points geometry={starGeo} material={starMat} />
      <sprite ref={glowRef} material={glowMat} />
    </group>
  )
}

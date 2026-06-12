import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'

// Analytic survey grid — lines are computed per-pixel with fwidth-based
// anti-aliasing, so they hold as crisp hairlines at every camera angle and
// distance (a texture grid shimmers and moirés at grazing angles).
// Hierarchy: faint 3.6 cells → sections every 5th → datum axes → survey
// circle. An inner clearing keeps a clean mat under the building and a
// radial fade dissolves everything before the horizon.
const GRID_VERT = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const GRID_FRAG = /* glsl */ `
  varying vec2 vWorld;
  uniform vec3 uColor;
  uniform float uOpacity;

  float gridLine(vec2 p, float size, float width) {
    vec2 coord = p / size;
    vec2 g = abs(fract(coord - 0.5) - 0.5) / (fwidth(coord) * width);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }

  void main() {
    float d = length(vWorld);

    float cells = gridLine(vWorld, 3.6, 1.0) * 0.2;
    float sections = gridLine(vWorld, 18.0, 1.2) * 0.5;

    vec2 ax = abs(vWorld) / (fwidth(vWorld) * 1.6);
    float axis = (1.0 - min(min(ax.x, ax.y), 1.0)) * 0.85;

    float ringD = abs(d - 30.0) / (fwidth(d) * 1.4);
    float ring = (1.0 - min(ringD, 1.0)) * 0.4;

    float a = max(max(cells, sections), max(axis, ring));

    // clean mat under the building, dissolve well before the horizon
    a *= smoothstep(4.5, 9.0, d);
    a *= 1.0 - smoothstep(36.0, 120.0, d);

    gl_FragColor = vec4(uColor, a * uOpacity);
    if (gl_FragColor.a < 0.003) discard;
  }
`

const GroundPlane = forwardRef(function GroundPlane(_, ref) {
  const gridRef = useRef()

  const gridMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color('#A8946C') },
          uOpacity: { value: 0 },
        },
        vertexShader: GRID_VERT,
        fragmentShader: GRID_FRAG,
      }),
    []
  )

  const horizonGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-260, 0, -80, 260, 0, -80], 3)
    )
    return g
  }, [])
  const horizonMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#1C1B19',
        transparent: true,
        opacity: 0.65,
      }),
    []
  )

  useImperativeHandle(ref, () => ({
    setGridOpacity(o) {
      gridMat.uniforms.uOpacity.value = THREE.MathUtils.clamp(o, 0, 1) * 0.85
      if (gridRef.current) gridRef.current.visible = gridMat.uniforms.uOpacity.value > 0.004
    },
    setHorizonOpacity(o) {
      horizonMat.opacity = THREE.MathUtils.clamp(o, 0, 1) * 0.65
    },
    setColors(gridColor, horizonColor, dt) {
      const t = Math.min(1, dt * 4)
      gridMat.uniforms.uColor.value.lerp(tmpA.set(gridColor), t)
      horizonMat.color.lerp(tmpB.set(horizonColor), t)
    },
  }))

  return (
    <group>
      <mesh
        ref={gridRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.004, 0]}
        material={gridMat}
        visible={false}
        renderOrder={1}
      >
        <planeGeometry args={[300, 300]} />
      </mesh>
      <lineSegments geometry={horizonGeo} material={horizonMat} />
    </group>
  )
})

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()

export default GroundPlane

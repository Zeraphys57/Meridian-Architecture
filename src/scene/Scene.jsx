import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import Building, { FLOOR_COUNT } from './Building'
import GroundPlane from './GroundPlane'
import SceneController from './SceneController'
import Atmosphere from './Atmosphere'
import { useNarrative } from '../narrative/NarrativeProvider'

// The ONE persistent canvas. Fixed behind every act; HTML scrolls over it.
export default function Scene() {
  const buildingRef = useRef()
  const groundRef = useRef()
  const ambientRef = useRef()
  const sunRef = useRef()
  const dimRef = useRef()
  const { isMobile } = useNarrative()

  return (
    <div
      ref={dimRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ fov: 45, position: [0, 1.4, 26], near: 0.1, far: 400 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop="always"
        shadows={isMobile ? false : 'soft'}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true // the Act V section cut
          gl.toneMappingExposure = 1.12
        }}
      >
        {/* distance dissolves into the page color — no hard viewport edge */}
        <fog attach="fog" args={['#F4F1EA', 80, 240]} />

        <ambientLight ref={ambientRef} intensity={0.4} />
        <directionalLight
          ref={sunRef}
          position={[14, 26, 12]}
          intensity={1.2}
          castShadow={!isMobile}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-38}
          shadow-camera-right={38}
          shadow-camera-top={45}
          shadow-camera-bottom={-20}
          shadow-camera-near={2}
          shadow-camera-far={140}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        {/* shadow catcher — real shadows pool on the survey paper */}
        {!isMobile && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0008, 0]} receiveShadow>
            <planeGeometry args={[300, 300]} />
            <shadowMaterial transparent opacity={0.22} />
          </mesh>
        )}
        {/* cool rim from behind — separates the tower from dark backgrounds */}
        <directionalLight position={[-18, 14, -16]} intensity={0.35} color="#D8E4EC" />
        <hemisphereLight args={['#F4F1EA', '#8A8478', 0.3]} />

        {/* local studio environment — soft key/fill/top + a structured skyline
            so the curtain wall, brass and marble reflect something believable,
            no HDR fetch */}
        <Environment resolution={512} frames={1}>
          <Lightformer form="rect" intensity={2.6} color="#FFF4E2" position={[10, 14, 8]} scale={[14, 18, 1]} target={[0, 8, 0]} />
          <Lightformer form="rect" intensity={1.0} color="#DCE4E6" position={[-14, 8, -6]} scale={[16, 14, 1]} target={[0, 8, 0]} />
          <Lightformer form="rect" intensity={1.15} color="#F4F1EA" position={[0, 24, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[20, 20, 1]} />
          {/* warm horizon band — a low sun line drags across the glass */}
          <Lightformer form="ring" intensity={1.5} color="#FFE6C4" position={[0, 5, -22]} scale={[44, 2.2, 1]} target={[0, 9, 0]} />
          {/* slim bright panels — crisp vertical glints, like distant towers */}
          <Lightformer form="rect" intensity={2.3} color="#FFFFFF" position={[18, 17, -3]} scale={[1.3, 9, 1]} target={[0, 11, 0]} />
          <Lightformer form="rect" intensity={1.9} color="#EAF1F5" position={[-12, 21, 9]} scale={[1.1, 8, 1]} target={[0, 11, 0]} />
          <Lightformer form="rect" intensity={1.6} color="#FFF1DC" position={[6, 3, 18]} scale={[10, 1.0, 1]} target={[0, 6, 0]} />
        </Environment>

        <GroundPlane ref={groundRef} />
        <Building ref={buildingRef} />
        <Atmosphere sunRef={sunRef} />
        <SceneController
          buildingRef={buildingRef}
          groundRef={groundRef}
          ambientRef={ambientRef}
          sunRef={sunRef}
          dimRef={dimRef}
        />
      </Canvas>
    </div>
  )
}

export { FLOOR_COUNT }

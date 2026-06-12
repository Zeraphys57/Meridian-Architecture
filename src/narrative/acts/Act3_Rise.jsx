import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { useNarrative } from '../NarrativeProvider'
import { localProgress } from '../actRanges'
import { FLOOR_COUNT, FLOOR_HEIGHT } from '../../scene/Building'

const MAX_HEIGHT = FLOOR_COUNT * FLOOR_HEIGHT // 28.8

// THE RISE. Sticky (not ScrollTrigger-pinned) so the global 1120vh scroll
// mapping never shifts. The counter reads the exact same progressRef +
// localProgress math as SceneController — counter and 3D floors cannot drift.
export default function Act3_Rise() {
  const ref = useRef()
  const floorRef = useRef()
  const heightRef = useRef()
  const floorsRef = useRef()
  const statusRef = useRef()
  const barRef = useRef()
  const nameRef = useRef()
  const { progressRef } = useNarrative()

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastFloor = -1
    let lastComplete = null
    const tick = () => {
      const l = localProgress(progressRef.current, 3)
      const floors = Math.min(FLOOR_COUNT, Math.floor(l * FLOOR_COUNT + 0.0001))
      if (floors !== lastFloor) {
        lastFloor = floors
        if (floorRef.current) {
          floorRef.current.textContent = String(Math.max(1, floors)).padStart(2, '0')
          // odometer roll on every floor tick
          if (!reduced)
            gsap.fromTo(
              floorRef.current,
              { yPercent: 42, opacity: 0.25 },
              { yPercent: 0, opacity: 1, duration: 0.4, ease: 'power3.out', overwrite: true }
            )
        }
        if (floorsRef.current)
          floorsRef.current.textContent = `FLOORS ${String(floors).padStart(2, '0')} / ${FLOOR_COUNT}`
      }
      if (heightRef.current)
        heightRef.current.textContent = `HEIGHT ${(l * MAX_HEIGHT).toFixed(1)}m / ${MAX_HEIGHT.toFixed(1)}m`
      if (barRef.current) barRef.current.style.transform = `scaleX(${l})`
      const complete = l >= 0.999
      if (complete !== lastComplete && statusRef.current) {
        lastComplete = complete
        statusRef.current.textContent = complete ? 'STATUS: COMPLETE' : 'STATUS: RISING'
        statusRef.current.style.color = complete ? 'var(--sand)' : 'inherit'
      }
      if (nameRef.current) {
        nameRef.current.style.opacity = gsap.utils.clamp(0, 1, (l - 0.5) / 0.25)
      }
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [progressRef])

  return (
    <section ref={ref} className="act" data-act="3" style={{ minHeight: '180vh' }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* building name — fades in past half-built */}
        <div
          ref={nameRef}
          className="absolute top-[14vh] left-1/2 -translate-x-1/2 text-center"
          style={{ opacity: 0 }}
        >
          <div className="font-display" style={{ fontSize: 'clamp(20px, 2.4vw, 32px)', letterSpacing: '0.12em' }}>
            MERIDIAN RESIDENCES
          </div>
          <div className="font-mono mt-2" style={{ fontSize: 11, letterSpacing: '0.25em', opacity: 0.55 }}>
            MELBOURNE · 2023
          </div>
        </div>

        {/* left edge — floor counter */}
        <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2">
          <div className="mono-label mb-2" style={{ opacity: 0.5 }}>
            FLOOR
          </div>
          <div className="overflow-hidden">
            <div ref={floorRef} className="font-display" style={{ fontSize: 'clamp(56px, 7vw, 96px)', fontWeight: 500, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              01
            </div>
          </div>
        </div>

        {/* right edge — live spec readout */}
        <div className="absolute right-6 md:right-16 top-1/2 -translate-y-1/2 text-right font-mono hidden sm:block" style={{ fontSize: 11, letterSpacing: '0.18em', lineHeight: 2.4 }}>
          <div ref={heightRef}>HEIGHT 0.0m / 28.8m</div>
          <div ref={floorsRef}>FLOORS 00 / 24</div>
          <div ref={statusRef}>STATUS: RISING</div>
        </div>

        {/* bottom — build progress line */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[40vw] max-w-[480px] overflow-hidden" style={{ height: 1, background: 'var(--line-light)' }}>
          <div ref={barRef} className="h-full w-full" style={{ background: 'var(--sand)', transform: 'scaleX(0)', transformOrigin: 'left center' }} />
        </div>
      </div>
    </section>
  )
}

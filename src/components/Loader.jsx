import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'

// Architectural loader — a horizon line draws itself, coordinates tick in,
// then the whole sheet lifts to reveal the site (whose own horizon takes over).
export default function Loader({ onDone }) {
  const rootRef = useRef()
  const lineRef = useRef()
  const nameRef = useRef()
  const coordRef = useRef()
  const barRef = useRef()
  const pctRef = useRef()

  useEffect(() => {
    const counter = { lat: 0, lng: 0, pct: 0 }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: () => {
          gsap.to(rootRef.current, {
            yPercent: -100,
            duration: 1.1,
            ease: 'power4.inOut',
            onComplete: onDone,
          })
        },
      })
      tl.fromTo(lineRef.current, { scaleX: 0 }, { scaleX: 1, duration: 1.2 })
        .fromTo(nameRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8 }, 0.35)
        .to(
          counter,
          {
            lat: -37.814,
            lng: 144.963,
            pct: 100,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => {
              if (coordRef.current)
                coordRef.current.textContent = `LAT ${counter.lat.toFixed(3)}  LNG ${counter.lng.toFixed(3)}`
              if (pctRef.current) pctRef.current.textContent = `${Math.round(counter.pct)}%`
              if (barRef.current) barRef.current.style.transform = `scaleX(${counter.pct / 100})`
            },
          },
          0.3
        )
        .to({}, { duration: 0.25 }) // beat of stillness before the lift
    }, rootRef)
    return () => ctx.revert()
  }, [onDone])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center"
      style={{ background: 'var(--bone)' }}
    >
      <div
        ref={nameRef}
        className="font-display mb-6"
        style={{ fontSize: 22, letterSpacing: '0.45em', textIndent: '0.45em', fontWeight: 400 }}
      >
        MERIDIAN
      </div>
      <div
        ref={lineRef}
        className="w-[60vw] max-w-[640px]"
        style={{ height: 1, background: 'var(--graphite)', transformOrigin: 'left center' }}
      />
      <div ref={coordRef} className="font-mono mt-6" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--sand-deep)' }}>
        LAT 0.000  LNG 0.000
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
        <div className="w-[120px] overflow-hidden" style={{ height: 1, background: 'var(--line)' }}>
          <div ref={barRef} className="h-full w-full" style={{ background: 'var(--graphite)', transform: 'scaleX(0)', transformOrigin: 'left center' }} />
        </div>
        <span ref={pctRef} className="font-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink)' }}>
          0%
        </span>
      </div>
    </div>
  )
}

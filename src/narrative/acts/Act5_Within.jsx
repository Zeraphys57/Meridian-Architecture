import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { useNarrative } from '../NarrativeProvider'
import { localProgress } from '../actRanges'
import GhostNumeral from '../../components/GhostNumeral'

// WITHIN — the tower slices open (clipping plane in the scene) and the
// camera rides up the open section. The level readout tracks the ascent.
const LEVELS = [
  { lv: '01', name: 'RETAIL GALLERY', area: '420 m²' },
  { lv: '04', name: 'WORKSPACE', area: '380 m²' },
  { lv: '08', name: 'TWO-BED RESIDENCE', area: '96 m²' },
  { lv: '11', name: 'THREE-BED SKY HOME', area: '138 m²' },
  { lv: '14', name: "RESIDENTS' CLUB", area: '460 m²' },
  { lv: '17', name: 'GARDEN SKY HOME', area: '163 m²' },
  { lv: '20', name: 'PENTHOUSE COLLECTION', area: '214 m²' },
  { lv: '23', name: 'CROWN PENTHOUSE', area: '327 m²' },
]

export default function Act5_Within() {
  const ref = useRef()
  const lvRef = useRef()
  const nameRef = useRef()
  const areaRef = useRef()
  const trackRef = useRef()
  const { progressRef, reducedMotion } = useNarrative()

  // level readout + track ride the camera's ascent up the section
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let last = -1
    const tick = () => {
      const l = localProgress(progressRef.current, 5)
      const rise = Math.min(1, Math.max(0, (l - 0.16) / 0.8))
      if (trackRef.current) trackRef.current.style.transform = `scaleY(${rise})`
      const idx = Math.min(LEVELS.length - 1, Math.floor(rise * LEVELS.length))
      if (idx !== last) {
        last = idx
        const lvl = LEVELS[idx]
        if (lvRef.current) {
          lvRef.current.textContent = lvl.lv
          if (!reduced)
            gsap.fromTo(
              lvRef.current,
              { yPercent: 40, opacity: 0.2 },
              { yPercent: 0, opacity: 1, duration: 0.4, ease: 'power3.out', overwrite: true }
            )
        }
        if (nameRef.current) nameRef.current.textContent = lvl.name
        if (areaRef.current) areaRef.current.textContent = lvl.area
      }
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [progressRef])

  useEffect(() => {
    if (reducedMotion) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.within-head > *',
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 60%' },
        }
      )
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="5" style={{ minHeight: '220vh' }}>
      <GhostNumeral numeral="V" />
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* left — the idea */}
        <div className="within-head absolute left-6 md:left-16 top-1/2 -translate-y-1/2 max-w-[420px]">
          <p className="eyebrow mb-6">02 — WITHIN</p>
          <h2 className="font-display" style={{ fontSize: 'clamp(36px, 4.5vw, 64px)', fontWeight: 500, lineHeight: 1.08, letterSpacing: '-0.03em' }}>
            Step inside the line.
          </h2>
          <p className="mt-6" style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.6, maxWidth: 360 }}>
            A section through the residence. Every apartment opens to its own
            wrapped terrace; daylight reaches the deepest room in the plan.
          </p>
        </div>

        {/* level track — fills bottom-to-top as you ride the section */}
        <div className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center" style={{ height: '46vh' }}>
          <div className="relative h-full" style={{ width: 1, background: 'var(--line-light)' }}>
            <div
              ref={trackRef}
              className="absolute inset-0"
              style={{ background: 'var(--sand)', transform: 'scaleY(0)', transformOrigin: 'bottom center' }}
            />
            {LEVELS.map((_, i) => (
              <span
                key={i}
                className="absolute"
                style={{
                  left: -3,
                  bottom: `${(i / (LEVELS.length - 1)) * 100}%`,
                  width: 7,
                  height: 1,
                  background: 'var(--line-light)',
                }}
              />
            ))}
          </div>
        </div>

        {/* right — level readout riding the ascent */}
        <div className="absolute right-6 md:right-16 top-1/2 -translate-y-1/2 text-right">
          <div className="mono-label mb-2" style={{ opacity: 0.5 }}>
            LEVEL
          </div>
          <div className="overflow-hidden">
            <div ref={lvRef} className="font-display" style={{ fontSize: 'clamp(48px, 6vw, 84px)', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              02
            </div>
          </div>
          <div ref={nameRef} className="font-mono mt-3" style={{ fontSize: 11, letterSpacing: '0.2em' }}>
            TWO-BED RESIDENCE
          </div>
          <div ref={areaRef} className="font-mono mt-1" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--sand)' }}>
            96 m²
          </div>
        </div>
      </div>
    </section>
  )
}

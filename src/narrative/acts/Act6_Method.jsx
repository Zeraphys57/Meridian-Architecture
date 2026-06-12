import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { phases } from '../../data/studio'
import { useNarrative } from '../NarrativeProvider'
import GhostNumeral from '../../components/GhostNumeral'

// Four architectural drawings that draw themselves (stroke-dash scrub).
// Every stroke is its own path so the draw-on animation drafts the drawing
// line by line (multi-segment paths draw all segments at once and look
// shattered mid-animation). Dashed guides carry class="dash" — they fade
// in instead of dash-drawing, which would destroy their dash pattern.
const DRAWINGS = {
  '01': ( // Brief — site plan: boundary, footprint, north arrow
    <svg viewBox="0 0 420 300" className="draw-svg w-full">
      <path d="M50 50 L370 50 L370 250 L50 250 Z" />
      <path d="M130 110 L270 110 L270 200 L130 200 Z" />
      <path d="M130 110 L160 90 L300 90 L270 110" />
      <path className="dash" d="M200 200 L200 250" strokeDasharray="4 5" />
      <circle cx="332" cy="84" r="16" />
      <path d="M332 96 L332 72" />
      <path d="M326 82 L332 72 L338 82" />
    </svg>
  ),
  '02': ( // Sketch — two-volume elevation study
    <svg viewBox="0 0 420 300" className="draw-svg w-full">
      <path d="M40 250 L390 250" />
      <path d="M90 250 L90 90 L230 90 L230 250" />
      <path d="M230 250 L230 150 L340 150 L340 250" />
      <path d="M120 120 L200 120" />
      <path d="M120 155 L200 155" />
      <path d="M120 190 L200 190" />
      <path d="M120 220 L200 220" />
      <path d="M255 180 L315 180" />
      <path d="M255 212 L315 212" />
      <path d="M90 90 L110 70 L250 70 L230 90" />
      <path d="M65 250 L65 90" />
      <path d="M58 90 L72 90" />
    </svg>
  ),
  '03': ( // Model — axonometric massing study
    <svg viewBox="0 0 420 300" className="draw-svg w-full">
      <path d="M110 240 L210 280 L310 235 L210 196 Z" />
      <path d="M110 240 L110 120 L210 158 L210 280" />
      <path d="M310 235 L310 118 L210 158" />
      <path d="M110 120 L210 80 L310 118" />
      <path d="M210 80 L210 158" />
      <path d="M140 135 L140 230" />
      <path d="M170 147 L170 243" />
      <path d="M240 172 L240 262" />
      <path d="M275 158 L275 248" />
      <path className="dash" d="M80 268 L340 268" strokeDasharray="3 5" />
    </svg>
  ),
  '04': ( // Build — section: floors, core, dimension line
    <svg viewBox="0 0 420 300" className="draw-svg w-full">
      <path d="M40 265 L390 265" />
      <path d="M100 265 L100 60 L320 60 L320 265" />
      <path d="M100 110 L320 110" />
      <path d="M100 160 L320 160" />
      <path d="M100 212 L320 212" />
      <path className="dash" d="M195 265 L195 60" strokeDasharray="2 5" />
      <path className="dash" d="M225 265 L225 60" strokeDasharray="2 5" />
      <path d="M348 60 L348 265" />
      <path d="M341 60 L355 60" />
      <path d="M341 265 L355 265" />
      <path d="M100 42 L320 42" />
      <path d="M100 35 L100 49" />
      <path d="M320 35 L320 49" />
    </svg>
  ),
}

export default function Act6_Method() {
  const ref = useRef()
  const { reducedMotion } = useNarrative()

  useEffect(() => {
    const ctx = gsap.context(() => {
      // each drawing drafts itself stroke by stroke as its row enters;
      // dashed guides fade in afterwards (dash-drawing them would
      // overwrite their dash pattern)
      ref.current.querySelectorAll('.phase-row').forEach((row) => {
        const all = row.querySelectorAll('path, circle')
        const solid = []
        const dashed = []
        all.forEach((p) => (p.classList.contains('dash') ? dashed : solid).push(p))
        solid.forEach((p) => {
          const len = p.getTotalLength ? p.getTotalLength() : 600
          p.style.strokeDasharray = `${len}`
          p.style.strokeDashoffset = reducedMotion ? '0' : `${len}`
        })
        if (reducedMotion) return
        // SCRUBBED drafting — the golden rule applies to ink too. At any
        // scroll position the drawing is in a deterministic state; scroll
        // back and it un-drafts.
        gsap.to(solid, {
          strokeDashoffset: 0,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: { trigger: row, start: 'top 88%', end: 'top 38%', scrub: true },
        })
        if (dashed.length)
          gsap.fromTo(
            dashed,
            { opacity: 0 },
            {
              opacity: 1,
              stagger: 0.1,
              ease: 'none',
              scrollTrigger: { trigger: row, start: 'top 48%', end: 'top 30%', scrub: true },
            }
          )
        gsap.fromTo(
          row.querySelector('.phase-info'),
          { opacity: 0, y: 36 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: row, start: 'top 70%' },
          }
        )
      })
      // timeline spine fills with sand as you scroll through
      if (!reducedMotion) {
        gsap.fromTo(
          '.spine-fill',
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: '.phase-list',
              start: 'top 60%',
              end: 'bottom 60%',
              scrub: true,
            },
          }
        )
      }
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="7" style={{ minHeight: '120vh' }}>
      <GhostNumeral numeral="VII" />
      <div className="px-6 md:px-16 py-28">
        <p className="eyebrow mb-6">THE METHOD</p>
        <h2 className="font-display mb-20" style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em' }}>
          From line to life.
        </h2>

        <div className="phase-list relative">
          {/* timeline spine */}
          <div className="absolute left-[7px] top-0 bottom-0 hidden md:block" style={{ width: 1, background: 'var(--line)' }}>
            <div className="spine-fill h-full w-full" style={{ background: 'var(--sand-deep)', transformOrigin: 'top center' }} />
          </div>

          {phases.map((ph) => (
            <div key={ph.n} className="phase-row relative mb-24 flex flex-col gap-10 md:flex-row md:items-center md:gap-16 md:pl-16">
              <div className="phase-info md:w-[40%]">
                <div
                  className="font-display"
                  style={{
                    fontSize: 'clamp(64px, 7vw, 100px)',
                    fontWeight: 400,
                    lineHeight: 1,
                    color: 'transparent',
                    WebkitTextStroke: '1px var(--sand-deep)',
                  }}
                >
                  {ph.n}
                </div>
                <h3 className="font-display mt-4" style={{ fontSize: 28, fontWeight: 400 }}>
                  {ph.title}
                </h3>
                <p className="mt-3" style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.65, maxWidth: 380 }}>
                  {ph.desc}
                </p>
              </div>
              <div className="md:w-[60%]" style={{ color: 'var(--ink)' }}>
                {DRAWINGS[ph.n]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

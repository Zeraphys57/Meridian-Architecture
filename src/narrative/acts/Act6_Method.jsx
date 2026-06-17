import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { phases } from '../../data/studio'
import { useNarrative } from '../NarrativeProvider'
import GhostNumeral from '../../components/GhostNumeral'

// The right column of each phase is an editorial typographic plate: a hero
// verb that distils the phase, a hairline rule, and one supporting line.
// The verb deliberately differs from the phase title on the left so the two
// columns read as a pair, not a repeat.
const EDITORIAL = {
  '01': { word: 'Listen', line: 'Before a single line is drawn.', tag: 'INTENT' },
  '02': { word: 'Draw', line: 'By hand, again and again.', tag: 'FORM' },
  '03': { word: 'Test', line: 'At one to one hundred.', tag: 'PROOF' },
  '04': { word: 'Raise', line: 'On site, every week.', tag: 'MATTER' },
}

export default function Act6_Method() {
  const ref = useRef()
  const { reducedMotion } = useNarrative()

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      ref.current.querySelectorAll('.phase-row').forEach((row) => {
        gsap.from(row.querySelector('.method-editorial'), {
          opacity: 0,
          y: 30,
          duration: 1,
          ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: row, start: 'top 80%', toggleActions: 'play none none none' },
        })
        gsap.from(row.querySelector('.phase-info'), {
          opacity: 0,
          y: 36,
          duration: 0.9,
          ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: row, start: 'top 78%', toggleActions: 'play none none none' },
        })
      })
      // timeline spine fills with sand as you scroll through
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
              <div className="md:w-[58%]">
                <div className="method-editorial">
                  <span className="me-index mono-label">{EDITORIAL[ph.n].tag}</span>
                  <div className="me-word font-display">
                    {EDITORIAL[ph.n].word}
                    <span className="me-dot">.</span>
                  </div>
                  <span className="me-rule" />
                  <p className="me-line">{EDITORIAL[ph.n].line}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

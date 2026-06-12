import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { stats } from '../../data/studio'
import { useNarrative } from '../NarrativeProvider'
import GhostNumeral from '../../components/GhostNumeral'

export default function Act7_Record() {
  const ref = useRef()
  const { reducedMotion } = useNarrative()

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      ref.current.querySelectorAll('.stat-val').forEach((el) => {
        const target = Number(el.dataset.value)
        const counter = { v: 0 }
        gsap.to(counter, {
          v: target,
          duration: 2,
          ease: 'power2.out',
          snap: { v: 1 },
          onUpdate: () => (el.textContent = String(Math.round(counter.v))),
          scrollTrigger: { trigger: ref.current, start: 'top 75%' },
        })
      })
      gsap.fromTo(
        '.stat',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 75%' },
        }
      )
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="8" style={{ minHeight: '80vh' }}>
      <GhostNumeral numeral="VIII" />
      <div className="flex min-h-[80vh] flex-col justify-center px-6 md:px-16 py-20">
        <p className="eyebrow mb-14">04 — THE RECORD</p>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="stat px-2 md:px-8 py-6"
              style={{ borderLeft: i > 0 ? '1px solid var(--line-light)' : 'none' }}
            >
              <div className="font-display" style={{ fontSize: 'clamp(56px, 8vw, 120px)', fontWeight: 500, lineHeight: 1, letterSpacing: '-0.02em' }}>
                <span className="stat-val" data-value={s.value}>
                  {reducedMotion ? s.value : 0}
                </span>
                {s.suffix && <span style={{ color: 'var(--sand)' }}>{s.suffix}</span>}
              </div>
              <div className="mono-label mt-3" style={{ opacity: 0.5, fontSize: 12 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

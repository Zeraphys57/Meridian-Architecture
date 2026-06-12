import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { Words } from '../../lib/split.jsx'
import { useNarrative } from '../NarrativeProvider'
import GhostNumeral from '../../components/GhostNumeral'

const STATEMENT = "We don't design buildings.\nWe design the years people\nwill spend inside them."

export default function Act2_Foundation() {
  const ref = useRef()
  const { reducedMotion } = useNarrative()

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set('.w', { opacity: 1 })
        return
      }
      // ghosted words solidify as the foundation extrudes beneath them
      gsap.fromTo(
        '.statement .w',
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 70%',
            end: 'center 40%',
            scrub: true,
          },
        }
      )
      gsap.fromTo(
        '.statement .w-years',
        { color: 'rgba(244,241,234,1)', scale: 1 },
        {
          color: '#C9B896',
          scale: 1.04,
          ease: 'none',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 50%',
            end: 'center 40%',
            scrub: true,
          },
        }
      )
      gsap.fromTo(
        '.foundation-sub',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.foundation-sub', start: 'top 85%' },
        }
      )
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="2" style={{ minHeight: '120vh' }}>
      <GhostNumeral numeral="II" />
      <div className="flex min-h-[120vh] items-center justify-center px-6">
        <div className="max-w-[900px] py-[20vh]">
          <p className="eyebrow mb-8">01 — THE FOUNDATION</p>
          <h2
            className="statement font-display"
            style={{
              fontSize: 'clamp(32px, 4.5vw, 68px)',
              fontWeight: 400,
              lineHeight: 1.25,
            }}
          >
            <Words text={STATEMENT} highlight={['years']} highlightClass="w-years" />
          </h2>
          <p
            className="foundation-sub mt-10"
            style={{ fontSize: 16, lineHeight: 1.7, maxWidth: 480, opacity: 0.6 }}
          >
            A building is finished in three years and lived in for sixty. We treat
            architecture as the slowest of the arts — a frame for decades of mornings,
            arguments, dinners, and quiet. The foundation is never just concrete.
          </p>
        </div>
      </div>
    </section>
  )
}

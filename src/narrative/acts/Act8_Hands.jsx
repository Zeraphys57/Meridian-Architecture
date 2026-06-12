import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { Words } from '../../lib/split.jsx'
import { studio } from '../../data/studio'
import { useNarrative } from '../NarrativeProvider'
import GhostNumeral from '../../components/GhostNumeral'

const QUOTE = 'A building is a promise\nyou keep for fifty years.'

export default function Act8_Hands() {
  const ref = useRef()
  const { reducedMotion } = useNarrative()

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set('.w', { opacity: 1 })
        return
      }
      gsap.fromTo(
        '.quote .w',
        { opacity: 0.15 },
        {
          opacity: 1,
          stagger: 0.06,
          ease: 'none',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 65%',
            end: 'center 45%',
            scrub: true,
          },
        }
      )
      gsap.fromTo(
        '.attribution, .portrait',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'center 55%' },
        }
      )
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="9" style={{ minHeight: '100vh' }}>
      <GhostNumeral numeral="IX" />
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div
          className="portrait mb-12 flex items-center justify-center rounded-full"
          style={{ width: 88, height: 88, border: '1px solid var(--sand-deep)' }}
        >
          <span className="font-display" style={{ fontSize: 26, color: 'var(--sand)' }}>
            EM
          </span>
        </div>
        <blockquote
          className="quote font-display max-w-[900px]"
          style={{
            fontSize: 'clamp(32px, 4.5vw, 64px)',
            fontWeight: 400,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          <Words text={QUOTE} highlight={['fifty', 'years']} highlightClass="w-em" />
        </blockquote>
        <p className="attribution font-mono mt-10" style={{ fontSize: 13, letterSpacing: '0.15em', color: 'var(--sand)' }}>
          — {studio.founder}, {studio.founderTitle}
        </p>
      </div>
    </section>
  )
}

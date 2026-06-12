import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'
import { Lines, Chars } from '../../lib/split.jsx'
import { studio } from '../../data/studio'
import ScrollHint from '../../components/ScrollHint'
import { useNarrative } from '../NarrativeProvider'

export default function Act1_BlankSite() {
  const ref = useRef()
  const { loaded, reducedMotion } = useNarrative()

  // entrance reveal — plays once, after the loader lifts
  useEffect(() => {
    if (!loaded) return
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set('.line-inner, .coord .ch, .corner', { opacity: 1, yPercent: 0 })
        return
      }
      gsap.fromTo(
        '.line-inner',
        { yPercent: 110 },
        { yPercent: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out', delay: 0.1 }
      )
      gsap.fromTo(
        '.coord .ch',
        { opacity: 0 },
        { opacity: 1, duration: 0.04, stagger: 0.03, ease: 'none', delay: 0.6 }
      )
      gsap.fromTo('.corner', { opacity: 0 }, { opacity: 1, duration: 1, stagger: 0.15, delay: 0.4 })
    }, ref)
    return () => ctx.revert()
  }, [loaded, reducedMotion])

  // scroll-out: headline parallaxes up + fades, coords linger then fade
  useEffect(() => {
    if (reducedMotion) return
    const ctx = gsap.context(() => {
      gsap.to('.headline', {
        y: -120,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: ref.current, start: 'top top', end: '80% top', scrub: true },
      })
      gsap.to('.coord', {
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: ref.current, start: '40% top', end: 'bottom top', scrub: true },
      })
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="1" style={{ minHeight: '100vh' }}>
      <div className="relative h-screen w-full px-6 md:px-10">
        {/* top-left identity */}
        <div className="corner absolute top-6 left-6 md:left-10" style={{ opacity: 0 }}>
          <div className="font-display" style={{ fontSize: 18, letterSpacing: '0.2em' }}>
            {studio.name}
          </div>
          <div className="mono-label mt-1" style={{ opacity: 0.5, fontSize: 11 }}>
            {studio.tagline}
          </div>
        </div>

        {/* top-right survey data */}
        <div className="corner coord absolute top-6 right-6 md:right-10 text-right font-mono" style={{ fontSize: 11, letterSpacing: '0.15em', opacity: 0 }}>
          <div>
            <Chars text={studio.coords} />
          </div>
          <div className="mt-1" style={{ opacity: 0.5 }}>
            <Chars text={studio.established} />
          </div>
        </div>

        {/* the headline */}
        <h1
          className="headline font-display absolute left-6 md:left-[8vw] top-1/2 -translate-y-1/2"
          style={{
            fontSize: 'clamp(48px, 6.5vw, 104px)',
            fontWeight: 500,
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
          }}
        >
          <Lines lines={['Every structure', 'begins as']} />
          <span className="line-mask">
            <span className="line-inner">
              <em style={{ color: 'var(--sand-deep)', fontStyle: 'normal', fontWeight: 600 }}>a line.</em>
            </span>
          </span>
        </h1>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ScrollHint />
        </div>
      </div>
    </section>
  )
}

import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { Chars } from '../../lib/split.jsx'
import { studio } from '../../data/studio'
import { useClock } from '../../components/Nav'
import { useNarrative } from '../NarrativeProvider'
import Magnetic from '../../components/Magnetic'

export default function Act9_BreakGround() {
  const ref = useRef()
  const ctaRef = useRef()
  const { reducedMotion, isTouch } = useNarrative()
  const time = useClock()

  // letter-warp: each character repels from the cursor and springs back
  useEffect(() => {
    if (reducedMotion || isTouch) return
    const chars = ctaRef.current.querySelectorAll('.ch')
    const onMove = (e) => {
      chars.forEach((ch) => {
        const r = ch.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const dist = Math.hypot(dx, dy)
        const radius = 160
        if (dist < radius) {
          const force = (1 - dist / radius) * 30
          gsap.to(ch, {
            x: (dx / (dist || 1)) * force,
            y: (dy / (dist || 1)) * force,
            duration: 0.4,
            ease: 'power2.out',
            overwrite: 'auto',
          })
        } else {
          gsap.to(ch, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' })
        }
      })
    }
    const onLeave = () => {
      gsap.to(chars, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' })
    }
    const el = ref.current
    el.addEventListener('mousemove', onMove, { passive: true })
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [reducedMotion, isTouch])

  useEffect(() => {
    if (reducedMotion) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.cta-block > *',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 60%' },
        }
      )
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="10" style={{ minHeight: '100vh' }}>
      <div className="flex min-h-screen flex-col px-6 md:px-16">
        <div className="cta-block flex flex-1 flex-col items-center justify-center text-center pt-16 pb-[14vh]">
          <h2
            ref={ctaRef}
            className="font-display"
            style={{ fontSize: 'clamp(48px, 8vw, 140px)', fontWeight: 500, lineHeight: 1.04, letterSpacing: '-0.03em' }}
          >
            <Chars text="Let's break " />
            <em style={{ color: 'var(--sand-deep)', fontStyle: 'normal', fontWeight: 600 }}>
              <Chars text="ground." />
            </em>
          </h2>
          <Magnetic className="mt-14" strength={0.25}>
            <a
              href={`mailto:${studio.email}`}
              data-hover
              className="link-sweep font-display inline-block transition-colors duration-300 hover:text-[#A8946C]"
              style={{ fontSize: 'clamp(18px, 2vw, 24px)' }}
            >
              {studio.email}
            </a>
          </Magnetic>
          <p className="font-mono mt-4" style={{ fontSize: 11, letterSpacing: '0.18em', opacity: 0.5 }}>
            {studio.address}
          </p>
          <p className="font-mono mt-2" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--sand-deep)' }}>
            {time}
          </p>
        </div>

        {/* closing marquee — slow, ghosted, inevitable */}
        <div className="marquee py-6" aria-hidden="true">
          <div className="marquee-track font-display" style={{ fontSize: 'clamp(40px, 6vw, 88px)', fontWeight: 600, letterSpacing: '-0.02em', opacity: 0.07 }}>
            {[0, 1].map((half) => (
              <span key={half} className="inline-flex">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className="inline-block pr-[5vw]">
                    Let's break ground · MERIDIAN ·
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* footer — the same line the site opened with */}
        <footer className="pb-8 pt-10">
          <div className="hairline mb-6" style={{ height: 1, width: '100%' }} />
          <div className="flex flex-col items-center justify-between gap-3 font-mono md:flex-row" style={{ fontSize: 10, letterSpacing: '0.18em', opacity: 0.55 }}>
            <span>MERIDIAN © 2026 · ARCHITECTURE STUDIO</span>
            <span>{studio.coords}</span>
          </div>
        </footer>
      </div>
    </section>
  )
}

import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'

// Enormous ghosted act numeral drifting behind the content — editorial depth.
export default function GhostNumeral({ numeral }) {
  const ref = useRef()

  useEffect(() => {
    const sec = ref.current.closest('section')
    const tween = gsap.fromTo(
      ref.current,
      { yPercent: 14 },
      {
        yPercent: -14,
        ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <div ref={ref} aria-hidden="true" className="ghost-numeral font-display">
      {numeral}
    </div>
  )
}

import { useRef } from 'react'
import { gsap } from '../lib/gsap'
import { useNarrative } from '../narrative/NarrativeProvider'

// Magnetic hover — the element leans toward the cursor and springs home.
export default function Magnetic({ children, strength = 0.35, className = '' }) {
  const ref = useRef()
  const { isTouch, reducedMotion } = useNarrative()
  const enabled = !isTouch && !reducedMotion

  const onMove = (e) => {
    if (!enabled) return
    const r = ref.current.getBoundingClientRect()
    gsap.to(ref.current, {
      x: (e.clientX - r.left - r.width / 2) * strength,
      y: (e.clientY - r.top - r.height / 2) * strength,
      duration: 0.4,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }
  const onLeave = () => {
    if (!enabled) return
    gsap.to(ref.current, {
      x: 0,
      y: 0,
      duration: 0.9,
      ease: 'elastic.out(1, 0.35)',
      overwrite: 'auto',
    })
  }

  return (
    <span
      ref={ref}
      className={`inline-block ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </span>
  )
}

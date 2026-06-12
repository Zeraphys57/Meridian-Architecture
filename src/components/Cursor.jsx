import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'
import { useNarrative } from '../narrative/NarrativeProvider'

// Drafting-table cursor: exact crosshair + lerping ring.
// mix-blend-mode: difference handles light/dark sections automatically.
export default function Cursor() {
  const { isTouch, reducedMotion } = useNarrative()
  const crossRef = useRef()
  const ringRef = useRef()

  useEffect(() => {
    if (isTouch) return
    document.body.classList.add('cursor-hidden')

    const cross = crossRef.current
    const ring = ringRef.current
    const pos = { x: innerWidth / 2, y: innerHeight / 2 }
    const ringPos = { x: pos.x, y: pos.y }

    const setCross = gsap.quickSetter(cross, 'css')
    const setRing = gsap.quickSetter(ring, 'css')

    const onMove = (e) => {
      pos.x = e.clientX
      pos.y = e.clientY
      setCross({ x: pos.x - 8, y: pos.y - 8 })
    }
    const tick = () => {
      const k = reducedMotion ? 1 : 0.12
      ringPos.x += (pos.x - ringPos.x) * k
      ringPos.y += (pos.y - ringPos.y) * k
      const r = ring.offsetWidth / 2
      setRing({ x: ringPos.x - r, y: ringPos.y - r })
    }
    gsap.ticker.add(tick)

    const onOver = (e) => {
      if (e.target.closest('a, button, [data-hover]')) {
        document.body.dataset.cursor = 'hover'
      } else {
        delete document.body.dataset.cursor
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseover', onOver, { passive: true })

    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      document.body.classList.remove('cursor-hidden')
      delete document.body.dataset.cursor
    }
  }, [isTouch, reducedMotion])

  if (isTouch) return null
  return (
    <>
      <div ref={crossRef} className="cursor-cross" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}

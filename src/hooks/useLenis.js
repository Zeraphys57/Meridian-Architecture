import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '../lib/gsap'

// Module-level handle so nav / rail can call lenis.scrollTo.
let lenisInstance = null
export function getLenis() {
  return lenisInstance
}

export function useLenis(enabled = true) {
  const lenisRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true })
    lenisRef.current = lenis
    lenisInstance = lenis

    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisInstance = null
      lenisRef.current = null
    }
  }, [enabled])

  return lenisRef
}

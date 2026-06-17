import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { useLenis } from '../hooks/useLenis'
import { useReducedMotion, useIsTouch, useIsMobile } from '../hooks/useReducedMotion'
import { actAt, measureRanges, THEME_COLORS } from './actRanges'

const NarrativeContext = createContext(null)

export function useNarrative() {
  return useContext(NarrativeContext)
}

// progressRef updates every scroll frame WITHOUT re-rendering React.
// Only the discrete act number (and theme) live in state.
export function NarrativeProvider({ children, mainRef, loaded }) {
  const reducedMotion = useReducedMotion()
  const isTouch = useIsTouch()
  const isMobile = useIsMobile()
  useLenis(!isTouch && loaded)

  const progressRef = useRef(0)
  const [act, setAct] = useState(1)
  const actRef = useRef(1)

  useEffect(() => {
    if (!mainRef.current) return
    const st = ScrollTrigger.create({
      trigger: mainRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        progressRef.current = self.progress
        const a = actAt(self.progress)
        if (a.id !== actRef.current) {
          actRef.current = a.id
          setAct(a.id)
        }
      },
    })
    measureRanges()
    const at = new URLSearchParams(window.location.search).get('at')
    if (at != null) {
      setTimeout(() => {
        window.scrollTo(0, (parseFloat(at) / 100) * window.innerHeight)
        ScrollTrigger.update()
      }, 300)
    }
    const onRefresh = () => measureRanges()
    ScrollTrigger.addEventListener('refreshInit', onRefresh)
    ScrollTrigger.addEventListener('refresh', onRefresh)
    document.fonts?.ready?.then(() => ScrollTrigger.refresh())
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', onRefresh)
      ScrollTrigger.removeEventListener('refresh', onRefresh)
      st.kill()
    }
  }, [mainRef])

  // Scroll-velocity skew — content leans into fast scrolls, settles at rest.
  useEffect(() => {
    if (reducedMotion || isTouch || !mainRef.current) return
    const setSkew = gsap.quickSetter(mainRef.current, 'skewY', 'deg')
    let cur = 0
    let lastY = window.scrollY
    const tick = () => {
      const y = window.scrollY
      const v = y - lastY
      lastY = y
      const t = gsap.utils.clamp(-2, 2, v * 0.045)
      cur += (t - cur) * 0.1
      setSkew(Math.abs(cur) < 0.01 ? 0 : cur)
    }
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      setSkew(0)
    }
  }, [reducedMotion, isTouch, mainRef])

  // Smooth body background/foreground transition between act themes.
  useEffect(() => {
    const theme = actAt(progressRef.current).theme
    const c = THEME_COLORS[theme]
    gsap.to('body', {
      backgroundColor: c.bg,
      color: c.fg,
      duration: reducedMotion ? 0 : 0.9,
      ease: 'power2.inOut',
      overwrite: 'auto',
    })
    document.body.dataset.theme = theme
  }, [act, reducedMotion])

  const value = useMemo(
    () => ({ progressRef, act, reducedMotion, isTouch, isMobile, loaded }),
    [act, reducedMotion, isTouch, isMobile, loaded]
  )

  return <NarrativeContext.Provider value={value}>{children}</NarrativeContext.Provider>
}

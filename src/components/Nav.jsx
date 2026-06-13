import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { actTopPx } from '../narrative/actRanges'
import { getLenis } from '../hooks/useLenis'
import { studio } from '../data/studio'
import Magnetic from './Magnetic'

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    })
    const fmt = () => {
      const parts = formatter.formatToParts(new Date())
      const get = (t) => parts.find((p) => p.type === t)?.value ?? ''
      setTime(`${get('hour')}:${get('minute')} ${get('timeZoneName')}`)
    }
    fmt()
    const id = setInterval(fmt, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export { useClock }

// Minimal top nav — appears once Act I is behind you.
export default function Nav() {
  const ref = useRef()
  const scrimRef = useRef()
  const time = useClock()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = ref.current
    const scrim = scrimRef.current
    gsap.set(el, { yPercent: -110, opacity: 0 })
    gsap.set(scrim, { opacity: 0 })
    const st = ScrollTrigger.create({
      start: () => window.innerHeight * 0.9,
      onEnter: () => {
        gsap.to(el, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'power3.out' })
        gsap.to(scrim, { opacity: 1, duration: 0.7, ease: 'power2.out' })
      },
      onLeaveBack: () => {
        gsap.to(el, { yPercent: -110, opacity: 0, duration: 0.5, ease: 'power3.in' })
        gsap.to(scrim, { opacity: 0, duration: 0.4, ease: 'power2.in' })
      },
    })
    return () => st.kill()
  }, [])

  // lock scroll while the mobile menu is open; close on Escape
  useEffect(() => {
    if (open) {
      getLenis()?.stop()
      document.body.style.overflow = 'hidden'
    } else {
      getLenis()?.start()
      document.body.style.overflow = ''
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const go = (id) => {
    const y = actTopPx(id)
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(y, { duration: 1.8 })
    else window.scrollTo({ top: y, behavior: 'smooth' })
  }

  // mobile: close the menu, release the scroll lock, then travel
  const select = (id) => {
    setOpen(false)
    document.body.style.overflow = ''
    const lenis = getLenis()
    lenis?.start()
    go(id)
  }

  return (
    <>
      <div ref={scrimRef} aria-hidden="true" className="nav-scrim" />

      <header
        ref={ref}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4"
      >
        <button data-hover onClick={() => go(1)} className="font-display" style={{ fontSize: 16, letterSpacing: '0.25em', background: 'none', border: 'none', color: 'inherit' }}>
          MERIDIAN
        </button>

        <nav className="hidden md:flex items-center gap-8 font-mono" style={{ fontSize: 11, letterSpacing: '0.15em' }}>
          <button data-hover onClick={() => go(4)} className="link-sweep" style={navBtn}>WORKS</button>
          <button data-hover onClick={() => go(7)} className="link-sweep" style={navBtn}>STUDIO</button>
          <button data-hover onClick={() => go(10)} className="link-sweep" style={navBtn}>CONTACT</button>
          <span style={{ opacity: 0.5 }}>{time}</span>
          <Magnetic strength={0.3}>
            <button
              data-hover
              onClick={() => go(10)}
              style={{
                ...navBtn,
                border: '1px solid var(--sand-deep)',
                padding: '8px 18px',
                color: 'var(--sand-deep)',
              }}
            >
              LET'S TALK
            </button>
          </Magnetic>
        </nav>

        <button
          data-hover
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`nav-burger md:hidden ${open ? 'open' : ''}`}
        >
          <span />
          <span />
        </button>
      </header>

      <div className={`mobile-menu ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div className="flex flex-col gap-1">
          {[['Works', 4], ['Studio', 7], ['Contact', 10]].map(([label, id]) => (
            <button
              key={id}
              data-hover
              onClick={() => select(id)}
              className="mm-item font-display text-left"
              style={{ fontSize: 'clamp(40px, 13vw, 72px)', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.06, background: 'none', border: 'none', color: 'inherit' }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mm-item mt-12 font-mono" style={{ fontSize: 12, letterSpacing: '0.15em' }}>
          <a href={`mailto:${studio.email}`} data-hover className="link-sweep" style={{ color: 'var(--sand)' }}>
            {studio.email}
          </a>
          <div className="mt-3" style={{ opacity: 0.5 }}>{time}</div>
        </div>
      </div>
    </>
  )
}

const navBtn = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  font: 'inherit',
  letterSpacing: 'inherit',
}

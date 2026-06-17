import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'

const LETTERS = 'MERIDIAN'.split('')

const SITE_DATA = [
  ['SITE AREA', '3,200 m²'],
  ['ELEVATION', '+32 m AHD'],
  ['ZONE', 'MX1'],
]
const PROJECT_DATA = [
  ['GFA', '48,200 m²'],
  ['LEVELS', '42'],
  ['TYPE', 'MIXED USE'],
]
const STATUSES = [
  'INITIALISING SITE SURVEY',
  'LOCATING: MELBOURNE, AU',
  'RENDERING SITE DATA',
  'COMPLETE',
]

export default function Loader({ onDone }) {
  const rootRef     = useRef()
  const gridRef     = useRef()
  const vigRef      = useRef()
  const scanRef     = useRef()
  const topBarRef   = useRef()
  const botBarRef   = useRef()
  const statusRef   = useRef()
  const cornerRefs  = useRef([])
  const letterRefs  = useRef([])
  const subtitleRef = useRef()
  const dividerRef  = useRef()
  const coordRef    = useRef()
  const cursorRef   = useRef()
  const barRef      = useRef()
  const pctRef      = useRef()
  const siteRefs    = useRef([])
  const projRefs    = useRef([])

  useEffect(() => {
    const counter = { lat: 0, lng: 0, pct: 0 }
    const ctx = gsap.context(() => {
      const cursorBlink = gsap.to(cursorRef.current, {
        opacity: 0, duration: 0.42, repeat: -1, yoyo: true, ease: 'none', paused: true,
      })

      const tl = gsap.timeline({
        onComplete: () => {
          cursorBlink.pause()
          gsap.to(cursorRef.current, { opacity: 0, duration: 0.12 })

          const exit = gsap.timeline({ onComplete: onDone })
          exit
            .to([gridRef.current, vigRef.current, scanRef.current], {
              opacity: 0, duration: 0.28, ease: 'power2.in',
            })
            .to(rootRef.current, {
              backgroundColor: '#F4F1EA', duration: 0.4, ease: 'power2.inOut',
            }, 0.12)
            .to(rootRef.current, {
              yPercent: -100, duration: 1.05, ease: 'power4.inOut',
            }, 0.34)
        },
      })

      tl
        // Grid fade in + slow zoom (depth illusion)
        .fromTo(gridRef.current,
          { opacity: 0, scale: 1 },
          { opacity: 1, scale: 1.06, duration: 4.4, ease: 'power1.inOut' }
        )
        // Vignette
        .fromTo(vigRef.current, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0)
        // Top bar
        .fromTo(topBarRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.1)
        // Corner marks stagger
        .fromTo(cornerRefs.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.35, stagger: 0.08 },
          0.2
        )
        // Scan line sweeps
        .fromTo(scanRef.current,
          { y: 0 },
          { y: '100vh', duration: 1.5, ease: 'power1.inOut' },
          0.3
        )
        // Letters stagger as scan passes centre
        .fromTo(letterRefs.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.055, ease: 'power2.out' },
          0.65
        )
        // Side data panels (left + right simultaneously)
        .fromTo(siteRefs.current,
          { opacity: 0, y: 7 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.09, ease: 'power2.out' },
          0.82
        )
        .fromTo(projRefs.current,
          { opacity: 0, y: 7 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.09, ease: 'power2.out' },
          0.82
        )
        // Divider draws
        .fromTo(dividerRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.8, ease: 'power3.out' },
          0.9
        )
        // Subtitle
        .fromTo(subtitleRef.current,
          { opacity: 0 },
          { opacity: 0.65, duration: 0.6 },
          0.95
        )
        // Status cycling
        .call(() => {
          if (statusRef.current) statusRef.current.textContent = STATUSES[0]
          gsap.to(statusRef.current, { opacity: 1, duration: 0.2 })
        }, null, 0.3)
        .call(() => { if (statusRef.current) statusRef.current.textContent = STATUSES[1] }, null, 0.9)
        .call(() => { if (statusRef.current) statusRef.current.textContent = STATUSES[2] }, null, 1.5)
        .call(() => { if (statusRef.current) statusRef.current.textContent = STATUSES[3] }, null, 2.2)
        // Coordinates counter + cursor blink
        .call(() => cursorBlink.play(), null, 0.5)
        .to(counter, {
          lat: -37.814,
          lng: 144.963,
          pct: 100,
          duration: 1.4,
          ease: 'power2.out',
          onUpdate: () => {
            if (coordRef.current)
              coordRef.current.textContent = `LAT ${counter.lat.toFixed(3)}  LNG ${counter.lng.toFixed(3)}`
            if (pctRef.current)  pctRef.current.textContent = `${Math.round(counter.pct)}%`
            if (barRef.current)  barRef.current.style.transform = `scaleX(${counter.pct / 100})`
          },
        }, 0.5)
        // Bottom bar
        .fromTo(botBarRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5)
        .to({}, { duration: 0.3 })
    }, rootRef)
    return () => ctx.revert()
  }, [onDone])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#0d1b2a' }}
    >
      {/* Blueprint grid */}
      <div
        ref={gridRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          backgroundImage: `
            linear-gradient(rgba(100,160,210,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100,160,210,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Vignette — dark edges for depth */}
      <div
        ref={vigRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          background: 'radial-gradient(ellipse at center, transparent 38%, rgba(4,10,20,0.72) 100%)',
        }}
      />

      {/* Scan line */}
      <div
        ref={scanRef}
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(120,195,255,0.55) 20%, rgba(210,235,255,0.95) 50%, rgba(120,195,255,0.55) 80%, transparent 100%)',
          boxShadow: '0 0 18px rgba(120,195,255,0.45), 0 0 52px rgba(120,195,255,0.18)',
        }}
      />

      {/* Corner registration marks */}
      {[
        { cls: 'top-[88px] left-8', deg: 0 },
        { cls: 'top-[88px] right-8', deg: 90 },
        { cls: 'bottom-[60px] right-8', deg: 180 },
        { cls: 'bottom-[60px] left-8', deg: 270 },
      ].map(({ cls, deg }, i) => (
        <div
          key={i}
          ref={el => cornerRefs.current[i] = el}
          className={`absolute ${cls}`}
          style={{ width: 14, height: 14, opacity: 0, transform: `rotate(${deg}deg)` }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 14, background: 'rgba(120,170,210,0.38)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 1, background: 'rgba(120,170,210,0.38)' }} />
        </div>
      ))}

      {/* Top title block */}
      <div
        ref={topBarRef}
        className="absolute top-7 left-0 right-0 px-8 flex justify-between"
        style={{ opacity: 0 }}
      >
        <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(120,170,210,0.42)' }}>
          PROJECT: MERIDIAN
        </span>
        <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(120,170,210,0.42)' }}>
          REF: MSA-2025-001
        </span>
      </div>

      {/* Left — site data */}
      <div
        className="absolute left-8 flex flex-col gap-5"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        {SITE_DATA.map(([label, value], i) => (
          <div key={i} ref={el => siteRefs.current[i] = el} style={{ opacity: 0 }}>
            <div className="font-mono" style={{ fontSize: 8, letterSpacing: '0.14em', color: 'rgba(120,170,210,0.38)', marginBottom: 3 }}>
              {label}
            </div>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(180,215,240,0.62)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Right — project data */}
      <div
        className="absolute right-8 flex flex-col gap-5 items-end"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        {PROJECT_DATA.map(([label, value], i) => (
          <div key={i} ref={el => projRefs.current[i] = el} style={{ opacity: 0, textAlign: 'right' }}>
            <div className="font-mono" style={{ fontSize: 8, letterSpacing: '0.14em', color: 'rgba(120,170,210,0.38)', marginBottom: 3 }}>
              {label}
            </div>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'rgba(180,215,240,0.62)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Studio name */}
      <div
        className="font-display"
        style={{ fontSize: 26, letterSpacing: '0.44em', textIndent: '0.44em', fontWeight: 400, color: '#daeaf6' }}
      >
        {LETTERS.map((l, i) => (
          <span key={i} ref={el => letterRefs.current[i] = el} style={{ display: 'inline-block', opacity: 0 }}>
            {l}
          </span>
        ))}
      </div>

      {/* Subtitle */}
      <div
        ref={subtitleRef}
        className="font-mono mt-[7px]"
        style={{ fontSize: 9, letterSpacing: '0.28em', textIndent: '0.28em', color: '#6ba0c8', opacity: 0 }}
      >
        ARCHITECTURE STUDIO
      </div>

      {/* Divider */}
      <div
        ref={dividerRef}
        className="w-[58vw] max-w-[600px] mt-8"
        style={{ height: 1, background: 'rgba(100,160,210,0.28)', transformOrigin: 'left center' }}
      />

      {/* Coordinates + blinking cursor */}
      <div className="flex items-center mt-5" style={{ gap: 1 }}>
        <span ref={coordRef} className="font-mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#6ba0c8' }}>
          LAT 0.000  LNG 0.000
        </span>
        <span ref={cursorRef} className="font-mono" style={{ fontSize: 10, color: '#6ba0c8', opacity: 0, marginLeft: 2 }}>
          _
        </span>
      </div>

      {/* Bottom bar — status + progress */}
      <div
        ref={botBarRef}
        className="absolute bottom-7 left-0 right-0 px-8 flex justify-between items-end"
        style={{ opacity: 0 }}
      >
        <div className="flex flex-col gap-[6px]">
          <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(120,170,210,0.42)' }}>
            SCALE 1:200 &nbsp; ↑N
          </span>
          <span
            ref={statusRef}
            className="font-mono"
            style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(100,165,210,0.58)', opacity: 0 }}
          >
            INITIALISING SITE SURVEY
          </span>
        </div>
        <div className="flex flex-col items-end gap-[9px]">
          <div className="w-[140px] overflow-hidden" style={{ height: 1, background: 'rgba(100,160,210,0.18)' }}>
            <div
              ref={barRef}
              className="h-full w-full"
              style={{ background: 'rgba(100,160,210,0.6)', transform: 'scaleX(0)', transformOrigin: 'left center' }}
            />
          </div>
          <span ref={pctRef} className="font-mono" style={{ fontSize: 9, letterSpacing: '0.18em', color: '#6ba0c8' }}>
            0%
          </span>
        </div>
      </div>
    </div>
  )
}

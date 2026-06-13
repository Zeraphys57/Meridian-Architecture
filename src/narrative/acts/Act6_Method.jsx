import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { phases } from '../../data/studio'
import { useNarrative } from '../NarrativeProvider'
import GhostNumeral from '../../components/GhostNumeral'

// Four architectural drawings that draw themselves (stroke-dash scrub).
// Every stroke is its own path so the draw-on animation drafts the drawing
// line by line (multi-segment paths draw all segments at once and look
// shattered mid-animation). Dashed guides carry class="dash" — they fade
// in instead of dash-drawing, which would destroy their dash pattern.
const DRAWINGS = {
  '01': ( // Brief — site plan: boundary, setbacks, footprint, context, north
    <svg viewBox="0 0 440 300" className="draw-svg w-full">
      {/* overall dimension line */}
      <path d="M44 22 L396 22" />
      <path d="M44 17 L44 27" />
      <path d="M396 17 L396 27" />
      {/* property boundary */}
      <path d="M44 42 L396 42 L396 258 L44 258 Z" />
      {/* building setback */}
      <path className="dash" d="M78 74 L362 74 L362 226 L78 226 Z" strokeDasharray="6 5" />
      {/* podium + tower footprint */}
      <path d="M166 104 L274 104 L274 196 L166 196 Z" />
      <path d="M188 124 L252 124 L252 176 L188 176 Z" />
      {/* footprint poché hatch */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={`h${i}`} d={`M188 ${130 + i * 11} L252 ${124 + i * 11}`} />
      ))}
      {/* entry path to the street */}
      <path d="M220 196 L220 242" />
      <path d="M210 242 L230 242" />
      {/* street + centre line */}
      <path d="M44 242 L396 242" />
      <path className="dash" d="M44 250 L396 250" strokeDasharray="10 8" />
      {/* specimen trees at the corners */}
      {[[98, 96], [342, 96], [98, 204], [342, 204]].map(([x, y], i) => (
        <circle key={`t${i}`} cx={x} cy={y} r="9" />
      ))}
      {/* north arrow */}
      <circle cx="374" cy="64" r="13" />
      <path d="M374 75 L374 51" />
      <path d="M369 60 L374 51 L379 60" />
    </svg>
  ),
  '02': ( // Sketch — tower elevation: floors, mullions, entrance, datum
    <svg viewBox="0 0 440 300" className="draw-svg w-full">
      {/* ground datum */}
      <path d="M34 268 L406 268" />
      {/* tower envelope with two setbacks */}
      <path d="M158 268 L158 64 L282 64 L282 268" />
      <path d="M172 64 L172 46 L268 46 L268 64" />
      <path d="M186 46 L186 32 L254 32 L254 46" />
      {/* floor lines */}
      {Array.from({ length: 11 }, (_, i) => (
        <path key={`f${i}`} d={`M158 ${82 + i * 17} L282 ${82 + i * 17}`} />
      ))}
      {/* vertical mullions */}
      {[190, 220, 250].map((x) => (
        <path key={`m${x}`} d={`M${x} 64 L${x} 268`} />
      ))}
      {/* entrance portal */}
      <path d="M204 268 L204 248 L236 248 L236 268" />
      {/* rooftop pergola */}
      <path d="M194 32 L194 22 L246 22 L246 32" />
      {/* height dimension line */}
      <path d="M300 64 L300 268" />
      <path d="M294 64 L306 64" />
      <path d="M294 268 L306 268" />
      {/* figure for scale */}
      <path d="M322 268 L322 256" />
      <circle cx="322" cy="252" r="3.4" />
    </svg>
  ),
  '03': ( // Model — axonometric massing: stacked plates with setbacks
    <svg viewBox="0 0 440 300" className="draw-svg w-full">
      {/* ground shadow */}
      <path className="dash" d="M96 256 L300 256" strokeDasharray="4 6" />
      {/* podium */}
      <path d="M120 214 L218 252 L324 210 L226 172 Z" />
      <path d="M120 214 L120 226 L218 264 L218 252" />
      <path d="M324 210 L324 222 L218 264" />
      {/* stacked floor plates rising with a slight setback */}
      {Array.from({ length: 8 }, (_, i) => {
        const y = 172 - i * 18
        const inset = i * 1.5
        return (
          <path
            key={`p${i}`}
            d={`M${132 + inset} ${y} L${218} ${y + 34} L${312 - inset} ${y - 4} L${226} ${y - 38} Z`}
          />
        )
      })}
      {/* leading vertical edges */}
      <path d="M132 172 L132 40" />
      <path d="M226 134 L226 4" />
      <path d="M312 168 L312 36" />
      <path d="M218 206 L218 76" />
    </svg>
  ),
  '04': ( // Build — section: slabs, core, foundation, levels, dimensions
    <svg viewBox="0 0 440 300" className="draw-svg w-full">
      {/* ground line */}
      <path d="M34 250 L406 250" />
      {/* foundation box + hatch */}
      <path d="M150 250 L150 282 L290 282 L290 250" />
      {[0, 1, 2].map((i) => (
        <path key={`fh${i}`} d={`M${162 + i * 44} 250 L${150 + i * 44} 282`} />
      ))}
      {/* tower section envelope */}
      <path d="M150 250 L150 40 L290 40 L290 250" />
      {/* floor slabs */}
      {Array.from({ length: 10 }, (_, i) => (
        <path key={`sl${i}`} d={`M150 ${60 + i * 19} L290 ${60 + i * 19}`} />
      ))}
      {/* central core with poché */}
      <path d="M202 40 L202 250" />
      <path d="M238 40 L238 250" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path className="dash" key={`c${i}`} d={`M202 ${64 + i * 32} L238 ${48 + i * 32}`} strokeDasharray="2 4" />
      ))}
      {/* rooftop amenity */}
      <path d="M166 40 L166 28 L274 28 L274 40" />
      {/* level ticks on the right */}
      {Array.from({ length: 6 }, (_, i) => (
        <path key={`lv${i}`} d={`M290 ${60 + i * 38} L302 ${60 + i * 38}`} />
      ))}
      {/* overall height dimension */}
      <path d="M320 40 L320 250" />
      <path d="M314 40 L326 40" />
      <path d="M314 250 L326 250" />
    </svg>
  ),
}

// drawing-sheet title-block metadata per phase
const SHEET = {
  '01': { no: 'A-001', kind: 'SITE PLAN', scale: '1:500' },
  '02': { no: 'A-201', kind: 'ELEVATION', scale: '1:200' },
  '03': { no: 'A-301', kind: 'AXONOMETRIC', scale: 'N.T.S.' },
  '04': { no: 'A-401', kind: 'SECTION', scale: '1:100' },
}

export default function Act6_Method() {
  const ref = useRef()
  const { reducedMotion } = useNarrative()

  useEffect(() => {
    const ctx = gsap.context(() => {
      // The ink is always rendered (no stroke-dash hiding, which kept leaving
      // the sheets blank). We only animate a gentle entrance of the sheet and
      // info; immediateRender:false means even that can never hide the drawing.
      if (reducedMotion) return
      ref.current.querySelectorAll('.phase-row').forEach((row) => {
        gsap.from(row.querySelector('.drawing-sheet'), {
          opacity: 0,
          y: 30,
          duration: 1,
          ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: row, start: 'top 80%', toggleActions: 'play none none none' },
        })
        gsap.from(row.querySelector('.phase-info'), {
          opacity: 0,
          y: 36,
          duration: 0.9,
          ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: row, start: 'top 78%', toggleActions: 'play none none none' },
        })
      })
      // timeline spine fills with sand as you scroll through
      if (!reducedMotion) {
        gsap.fromTo(
          '.spine-fill',
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: '.phase-list',
              start: 'top 60%',
              end: 'bottom 60%',
              scrub: true,
            },
          }
        )
      }
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="7" style={{ minHeight: '120vh' }}>
      <GhostNumeral numeral="VII" />
      <div className="px-6 md:px-16 py-28">
        <p className="eyebrow mb-6">THE METHOD</p>
        <h2 className="font-display mb-20" style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em' }}>
          From line to life.
        </h2>

        <div className="phase-list relative">
          {/* timeline spine */}
          <div className="absolute left-[7px] top-0 bottom-0 hidden md:block" style={{ width: 1, background: 'var(--line)' }}>
            <div className="spine-fill h-full w-full" style={{ background: 'var(--sand-deep)', transformOrigin: 'top center' }} />
          </div>

          {phases.map((ph) => (
            <div key={ph.n} className="phase-row relative mb-24 flex flex-col gap-10 md:flex-row md:items-center md:gap-16 md:pl-16">
              <div className="phase-info md:w-[40%]">
                <div
                  className="font-display"
                  style={{
                    fontSize: 'clamp(64px, 7vw, 100px)',
                    fontWeight: 400,
                    lineHeight: 1,
                    color: 'transparent',
                    WebkitTextStroke: '1px var(--sand-deep)',
                  }}
                >
                  {ph.n}
                </div>
                <h3 className="font-display mt-4" style={{ fontSize: 28, fontWeight: 400 }}>
                  {ph.title}
                </h3>
                <p className="mt-3" style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.65, maxWidth: 380 }}>
                  {ph.desc}
                </p>
              </div>
              <div className="md:w-[58%]">
                <div className="drawing-sheet">
                  <span className="sheet-corner tl" />
                  <span className="sheet-corner tr" />
                  <span className="sheet-corner bl" />
                  <span className="sheet-corner br" />
                  <div style={{ color: 'var(--ink)' }}>{DRAWINGS[ph.n]}</div>
                  <div className="drawing-titleblock">
                    <span>MERIDIAN — {SHEET[ph.n].kind}</span>
                    <span className="tb-mid">{SHEET[ph.n].scale}</span>
                    <span className="tb-no">{SHEET[ph.n].no}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

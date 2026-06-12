import { useEffect, useRef, useState } from 'react'
import { gsap } from '../../lib/gsap'
import { useNarrative } from '../NarrativeProvider'
import { localProgress } from '../actRanges'
import { projects } from '../../data/projects'
import Magnetic from '../../components/Magnetic'

// Procedural placeholder: warm accent gradient + blueprint line-art elevation.
// Looks intentional until real photography drops in at /assets/projects/*.jpg.
function ProjectImage({ project }) {
  const [ok, setOk] = useState(true)
  return (
    <div
      className="img-frame relative h-[58vh] md:h-[64vh] w-full overflow-hidden"
      style={{ borderRadius: 6, background: `linear-gradient(160deg, ${project.accent}55, ${project.accent}22 45%, #1C1B1922)` }}
    >
      <div className="img-inner absolute inset-[-60px]" style={{ willChange: 'transform' }}>
        {ok && (
          <img
            src={project.image}
            alt={project.name}
            onError={() => setOk(false)}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {!ok && (
          <svg viewBox="0 0 400 520" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
            <g stroke="#F4F1EA" strokeWidth="1" fill="none" opacity="0.5">
              <line x1="40" y1="460" x2="360" y2="460" />
              <rect x="110" y="120" width="180" height="340" />
              {Array.from({ length: 11 }, (_, i) => (
                <line key={i} x1="110" y1={150 + i * 30} x2="290" y2={150 + i * 30} />
              ))}
              <line x1="155" y1="120" x2="155" y2="460" />
              <line x1="200" y1="120" x2="200" y2="460" />
              <line x1="245" y1="120" x2="245" y2="460" />
              <line x1="110" y1="120" x2="135" y2="92" />
              <line x1="135" y1="92" x2="315" y2="92" />
              <line x1="315" y1="92" x2="290" y2="120" />
              <circle cx="340" cy="60" r="14" />
              <line x1="340" y1="50" x2="340" y2="44" />
              <text x="336" y="64" fill="#F4F1EA" stroke="none" fontSize="11" fontFamily="monospace">N</text>
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}

function ProjectPanel({ project, refCb, vertical = false }) {
  return (
    <article
      ref={refCb}
      className={`panel flex w-screen flex-shrink-0 flex-col md:flex-row items-center gap-8 md:gap-12 px-6 md:px-16 ${
        vertical ? 'min-h-screen py-16' : 'h-screen md:w-[80vw]'
      }`}
    >
      <div className="relative w-full md:w-[55%]">
        <ProjectImage project={project} />
        <div
          className="idx font-display absolute -top-8 -left-2 md:-left-6 select-none"
          style={{ fontSize: 'clamp(72px, 9vw, 120px)', fontWeight: 400, mixBlendMode: 'difference', color: '#F4F1EA', willChange: 'transform' }}
        >
          {project.index}
        </div>
      </div>
      <div className="info w-full md:w-[45%] max-w-[440px]" style={{ willChange: 'transform' }}>
        <h3 className="font-display" style={{ fontSize: 'clamp(28px, 3vw, 44px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
          {project.name}
        </h3>
        <dl className="mt-6 font-mono" style={{ fontSize: 12, letterSpacing: '0.12em' }}>
          {[
            ['TYPE', project.type],
            ['LOCATION', project.location],
            ['YEAR', project.year],
            ['AREA', project.area],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--line)' }}>
              <dt style={{ opacity: 0.45 }}>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 360, opacity: 0.75 }}>
          {project.blurb}
        </p>
        <Magnetic className="mt-6">
          <a href="#" data-hover onClick={(e) => e.preventDefault()} className="link-sweep inline-block font-mono" style={{ fontSize: 12, letterSpacing: '0.15em', color: project.accent }}>
            VIEW PROJECT →
          </a>
        </Magnetic>
      </div>
    </article>
  )
}

// Vertical scroll → horizontal travel. Sticky viewport, track translated by
// the act's local progress (same source of truth as the 3D scene).
export default function Act4_Inhabited() {
  const trackRef = useRef()
  const panelsRef = useRef([])
  const { progressRef, isMobile, reducedMotion } = useNarrative()
  const horizontal = !isMobile && !reducedMotion

  useEffect(() => {
    if (!horizontal) return
    const track = trackRef.current
    const tick = () => {
      const l = localProgress(progressRef.current, 4)
      const dist = Math.max(0, track.scrollWidth - window.innerWidth)
      const x = -l * dist
      track.style.transform = `translate3d(${x}px, 0, 0)`
      // parallax: image, index number and text drift at different rates
      for (const panel of panelsRef.current) {
        if (!panel) continue
        const center = panel.offsetLeft + panel.offsetWidth / 2 + x
        const delta = (center - window.innerWidth / 2) / window.innerWidth
        const img = panel.querySelector('.img-inner')
        const idx = panel.querySelector('.idx')
        const info = panel.querySelector('.info')
        if (img) img.style.transform = `translate3d(${delta * 60}px, 0, 0)`
        if (idx) idx.style.transform = `translate3d(${-delta * 40}px, 0, 0)`
        if (info) info.style.transform = `translate3d(0, ${delta * 14}px, 0)`
      }
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [horizontal, progressRef])

  const intro = (
    <div className="flex h-full md:h-screen w-screen md:w-[60vw] flex-shrink-0 flex-col justify-center px-6 md:px-16 py-24 md:py-0">
      <p className="eyebrow mb-6">SELECTED WORKS</p>
      <h2 className="font-display" style={{ fontSize: 'clamp(40px, 5vw, 80px)', fontWeight: 500, lineHeight: 1.08, letterSpacing: '-0.03em' }}>
        Selected Works
      </h2>
      <p className="font-display mt-4" style={{ fontSize: 'clamp(17px, 1.6vw, 22px)', opacity: 0.55 }}>
        Four buildings. Four ways of holding light.
      </p>
      {horizontal && (
        <p className="font-mono mt-10" style={{ fontSize: 11, letterSpacing: '0.25em', opacity: 0.45 }}>
          SCROLL →
        </p>
      )}
    </div>
  )

  if (!horizontal) {
    // mobile / reduced motion: vertical stacked full-screen panels
    return (
      <section className="act" data-act="4" style={{ minHeight: '340vh' }}>
        {intro}
        {projects.map((p) => (
          <ProjectPanel key={p.id} project={p} refCb={() => {}} vertical />
        ))}
      </section>
    )
  }

  return (
    <section className="act" data-act="4" style={{ minHeight: '340vh' }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div ref={trackRef} className="flex h-full" style={{ width: 'max-content', willChange: 'transform' }}>
          {intro}
          {projects.map((p, i) => (
            <ProjectPanel key={p.id} project={p} refCb={(el) => (panelsRef.current[i] = el)} />
          ))}
          {/* trailing breath — the final project settles fully into view */}
          <div className="h-full w-[16vw] flex-shrink-0" />
        </div>
      </div>
    </section>
  )
}

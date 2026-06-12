import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { materials } from '../../data/studio'
import { useNarrative } from '../NarrativeProvider'
import GhostNumeral from '../../components/GhostNumeral'

// Procedural material textures — pure CSS, no image assets.
const TEXTURES = {
  concrete: {
    background:
      'linear-gradient(135deg, #8A857B 0%, #9B968C 40%, #8F8A80 70%, #837E74 100%)',
    overlay:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E\")",
  },
  oak: {
    background:
      'repeating-linear-gradient(92deg, #8A6A48 0px, #9C7A54 3px, #8F6E4C 6px, #A5825C 11px, #8A6A48 16px)',
    overlay:
      'repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, transparent 2px, transparent 22px)',
  },
  steel: {
    background:
      'repeating-linear-gradient(90deg, #6E7276 0px, #898D91 1px, #74787C 2px, #82868A 4px)',
    overlay: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.22))',
  },
  glass: {
    background:
      'linear-gradient(120deg, rgba(160,175,170,0.32) 0%, rgba(200,212,206,0.16) 45%, rgba(140,158,152,0.30) 100%)',
    overlay:
      'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.28) 47%, rgba(255,255,255,0.06) 55%, transparent 62%)',
  },
}

function Swatch({ material }) {
  const ref = useRef()
  const lightRef = useRef()
  const tex = TEXTURES[material.id]

  // cursor-driven raking light reveals the texture's depth
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    lightRef.current.style.background = `radial-gradient(circle 220px at ${x}% ${y}%, rgba(255,244,220,0.34), rgba(255,244,220,0.08) 45%, transparent 70%)`
    lightRef.current.style.opacity = 1
  }
  const onLeave = () => {
    if (lightRef.current) lightRef.current.style.opacity = 0
  }

  return (
    <div className="swatch flex flex-col" data-hover>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '3 / 4', borderRadius: 4, background: tex.background }}
      >
        <div className="absolute inset-0" style={{ background: tex.overlay }} />
        <div
          ref={lightRef}
          className="absolute inset-0"
          style={{ opacity: 0, transition: 'opacity 0.5s var(--ease-arch)' }}
        />
      </div>
      <div className="mt-4">
        <div className="font-mono" style={{ fontSize: 12, letterSpacing: '0.18em' }}>
          {material.name.toUpperCase()}
        </div>
        <div className="font-mono mt-1" style={{ fontSize: 10, letterSpacing: '0.18em', opacity: 0.45 }}>
          {material.prop}
        </div>
      </div>
    </div>
  )
}

export default function Act5_Material() {
  const ref = useRef()
  const { reducedMotion } = useNarrative()

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      gsap.fromTo(
        '.swatch',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.swatch-row', start: 'top 80%' },
        }
      )
      gsap.fromTo(
        '.mat-head',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 65%' },
        }
      )
    }, ref)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section ref={ref} className="act" data-act="6" style={{ minHeight: '100vh' }}>
      <GhostNumeral numeral="VI" />
      <div className="flex min-h-screen flex-col justify-center px-6 md:px-16 py-24">
        <div className="mat-head">
          <p className="eyebrow mb-6">03 — THE MATERIAL</p>
          <h2 className="font-display" style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em' }}>
            Detail is the difference.
          </h2>
        </div>
        <div className="swatch-row mt-14 grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-8">
          {materials.map((m) => (
            <Swatch key={m.id} material={m} />
          ))}
        </div>
      </div>
    </section>
  )
}

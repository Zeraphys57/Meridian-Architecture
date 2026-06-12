import { ACTS, actTopPx } from '../narrative/actRanges'
import { useNarrative } from '../narrative/NarrativeProvider'
import { getLenis } from '../hooks/useLenis'

// Vertical act indicator I–IX, fixed to the right edge. Click = jump to act.
export default function ProgressRail() {
  const { act, isMobile } = useNarrative()
  if (isMobile) return null

  const go = (id) => {
    const y = actTopPx(id)
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(y, { duration: 1.6 })
    else window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <nav
      className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-end gap-3"
      aria-label="Act navigation"
    >
      {ACTS.map((a) => {
        const active = a.id === act
        return (
          <button
            key={a.id}
            onClick={() => go(a.id)}
            data-hover
            className="flex items-center gap-2 group"
            aria-label={`Act ${a.numeral} — ${a.title}`}
            aria-current={active ? 'true' : undefined}
            style={{ background: 'none', border: 'none', padding: '2px 0' }}
          >
            <span
              className="font-mono transition-opacity duration-300"
              style={{
                fontSize: 9,
                letterSpacing: '0.15em',
                opacity: active ? 1 : 0,
                color: active ? 'var(--sand)' : 'currentColor',
              }}
            >
              {a.numeral}
            </span>
            <span
              className="block transition-all duration-300"
              style={{
                height: 1,
                width: active ? 24 : 12,
                background: active ? 'var(--sand)' : 'currentColor',
                opacity: active ? 1 : 0.3,
              }}
            />
          </button>
        )
      })}
    </nav>
  )
}

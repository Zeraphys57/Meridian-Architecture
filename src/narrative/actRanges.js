// Single source of truth for the 9-act narrative map.
// Heights in vh; progress ranges are derived so the WebGL scene, the act
// tracker, and the HTML layers all agree on where each act lives.
// Ranges are re-measured from the real DOM after layout (mobile fallbacks
// can change section heights), with the static table as the initial guess.

export const ACTS = [
  { id: 1, slug: 'site', numeral: 'I', title: 'The Blank Site', vh: 100, theme: 'light' },
  { id: 2, slug: 'foundation', numeral: 'II', title: 'The Foundation', vh: 120, theme: 'dark' },
  { id: 3, slug: 'rise', numeral: 'III', title: 'The Rise', vh: 180, theme: 'dark' },
  { id: 4, slug: 'inhabited', numeral: 'IV', title: 'Inhabited', vh: 340, theme: 'light' },
  { id: 5, slug: 'within', numeral: 'V', title: 'Within', vh: 220, theme: 'dark' },
  { id: 6, slug: 'material', numeral: 'VI', title: 'The Material', vh: 100, theme: 'dark' },
  { id: 7, slug: 'method', numeral: 'VII', title: 'The Method', vh: 120, theme: 'light' },
  { id: 8, slug: 'record', numeral: 'VIII', title: 'The Record', vh: 80, theme: 'dark' },
  { id: 9, slug: 'hands', numeral: 'IX', title: 'The Hands', vh: 100, theme: 'warm' },
  { id: 10, slug: 'ground', numeral: 'X', title: 'Break Ground', vh: 100, theme: 'light' },
]

export const TOTAL_VH = ACTS.reduce((sum, a) => sum + a.vh, 0) // 1120
const SCROLLABLE_VH = TOTAL_VH - 100

// Static fallback: progress at which the viewport CENTER crosses each act.
// scrollY(p) = p * scrollable; viewport center = scrollY + 50vh.
let cum = 0
const STATIC_RANGES = ACTS.map((act) => {
  const start = Math.max(0, (cum - 50) / SCROLLABLE_VH)
  cum += act.vh
  const end = Math.min(1, (cum - 50) / SCROLLABLE_VH)
  return { ...act, start, end, topPx: null }
})

let RANGES = STATIC_RANGES

// Measure real section positions (call after mount and on ScrollTrigger refresh).
export function measureRanges() {
  const els = document.querySelectorAll('section[data-act]')
  if (els.length !== ACTS.length) return
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  if (scrollable <= 0) return
  const half = window.innerHeight / 2
  RANGES = Array.from(els).map((el, i) => {
    const top = el.getBoundingClientRect().top + window.scrollY
    const height = el.offsetHeight
    return {
      ...ACTS[i],
      start: Math.max(0, (top - half) / scrollable),
      end: Math.min(1, (top + height - half) / scrollable),
      topPx: top,
    }
  })
}

export function actAt(progress) {
  for (let i = RANGES.length - 1; i >= 0; i--) {
    if (progress >= RANGES[i].start) return RANGES[i]
  }
  return RANGES[0]
}

// Local 0-1 progress within act `id` for a given global progress (clamped).
export function localProgress(progress, id) {
  const r = RANGES[id - 1]
  return Math.min(1, Math.max(0, (progress - r.start) / (r.end - r.start)))
}

// Pixel offset of the top of act `id` — for nav / rail scrollTo.
export function actTopPx(id) {
  const r = RANGES[id - 1]
  if (r.topPx != null) return r.topPx
  let offVh = 0
  for (let i = 0; i < id - 1; i++) offVh += ACTS[i].vh
  return (offVh / 100) * window.innerHeight
}

export const THEME_COLORS = {
  light: { bg: '#F4F1EA', fg: '#1C1B19' },
  dark: { bg: '#1C1B19', fg: '#F4F1EA' },
  warm: { bg: '#2A2520', fg: '#F4F1EA' },
}

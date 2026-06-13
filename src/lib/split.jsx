// Manual splitters (SplitText is a paid Club plugin — these cover our needs).

// Words: wraps every word in a .w span — for scrub-reveal manifestos.
export function Words({ text, highlight = [], highlightClass = '' }) {
  return text.split('\n').map((line, li) => (
    <span key={li} style={{ display: 'block' }}>
      {line.split(' ').map((word, wi) =>
        word === '' ? null : (
          <span
            key={wi}
            className={
              highlight.includes(word.replace(/[.,]/g, '')) ? `w ${highlightClass}` : 'w'
            }
            style={{ display: 'inline-block', whiteSpace: 'pre' }}
          >
            {word + (wi < line.split(' ').length - 1 ? ' ' : '')}
          </span>
        )
      )}
    </span>
  ))
}

// Lines: wraps each line in an overflow-hidden mask for clip reveals.
export function Lines({ lines }) {
  return lines.map((line, i) => (
    <span key={i} className="line-mask">
      <span className="line-inner">{line}</span>
    </span>
  ))
}

// Chars: per-character spans — for coordinate readouts and letter-warp.
// Letters are grouped per word in a nowrap wrapper so a line can only break at
// spaces, never mid-word (otherwise "ground." can wrap to "gro / und."). Each
// character stays an individually-transformable .ch for the warp/reveal effects.
export function Chars({ text, className = 'ch' }) {
  let charKey = 0
  return text.split(/(\s+)/).map((token, ti) => {
    if (token === '') return null
    if (/^\s+$/.test(token)) {
      return (
        <span key={`s${ti}`} style={{ whiteSpace: 'pre-wrap' }}>
          {token}
        </span>
      )
    }
    return (
      <span key={`w${ti}`} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
        {[...token].map((c) => (
          <span key={charKey++} className={className} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {c}
          </span>
        ))}
      </span>
    )
  })
}

export default function ScrollHint() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="scroll-hint-line" />
      <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.3em', opacity: 0.55 }}>
        SCROLL TO BUILD
      </span>
    </div>
  )
}

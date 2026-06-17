import { useCallback, useEffect, useRef, useState } from 'react'
import { NarrativeProvider } from './narrative/NarrativeProvider'
import Scene from './scene/Scene'
import Loader from './components/Loader'
import Cursor from './components/Cursor'
import Nav from './components/Nav'
import ProgressRail from './components/ProgressRail'
import Act1_BlankSite from './narrative/acts/Act1_BlankSite'
import Act2_Foundation from './narrative/acts/Act2_Foundation'
import Act3_Rise from './narrative/acts/Act3_Rise'
import Act4_Inhabited from './narrative/acts/Act4_Inhabited'
import Act5_Within from './narrative/acts/Act5_Within'
import Act5_Material from './narrative/acts/Act5_Material'
import Act6_Method from './narrative/acts/Act6_Method'
import Act7_Record from './narrative/acts/Act7_Record'
import Act8_Hands from './narrative/acts/Act8_Hands'
import Act9_BreakGround from './narrative/acts/Act9_BreakGround'

// ?at=<vh> skips the loader and jumps the scroll — used for visual QA
const DEBUG_AT = new URLSearchParams(window.location.search).get('at')

export default function App() {
  const mainRef = useRef(null)
  const [loaded, setLoaded] = useState(DEBUG_AT != null)
  const onLoaderDone = useCallback(() => setLoaded(true), [])

  useEffect(() => {
    if (!loaded) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = '0'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      window.scrollTo(0, 0)
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [loaded])

  return (
    <NarrativeProvider mainRef={mainRef} loaded={loaded}>
      {!loaded && <Loader onDone={onLoaderDone} />}
      <Cursor />
      <Nav />
      <ProgressRail />
      <Scene />
      <main ref={mainRef} className="relative z-10">
        <Act1_BlankSite />
        <Act2_Foundation />
        <Act3_Rise />
        <Act4_Inhabited />
        <Act5_Within />
        <Act5_Material />
        <Act6_Method />
        <Act7_Record />
        <Act8_Hands />
        <Act9_BreakGround />
      </main>
      <div className="grain" />
    </NarrativeProvider>
  )
}

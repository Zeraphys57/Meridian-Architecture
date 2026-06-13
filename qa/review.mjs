import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { spawn } from 'node:child_process'

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const exe = candidates.find((p) => fs.existsSync(p))
if (!exe) throw new Error('no browser found')

const OUT = 'D:/Meridian - archi porto/qa/review'
fs.mkdirSync(OUT, { recursive: true })

const BASE = process.env.QA_BASE || 'http://localhost:5173'
const W = Number(process.env.QA_W || 1600)
const H = Number(process.env.QA_H || 900)
const TAG = process.env.QA_TAG || 'd' // d=desktop, m=mobile

// at = scroll position in vh. Narrative ~1688vh across 10 acts.
const argShots = process.argv.slice(2).map((s) => s.split('=')).map(([n, a]) => [n, Number(a)])
const shots = argShots.length ? argShots : [
  ['a01-hero', 0],
  ['a01-site', 40],
  ['a02-foundation', 150],
  ['a03-rise', 300],
  ['a04-inhab-early', 470],
  ['a04-inhab-mid', 580],
  ['a04-inhab-late', 690],
  ['a05-within', 820],
  ['a06-material', 980],
  ['a07-method', 1090],
  ['a08-record', 1210],
  ['a09-hands', 1300],
  ['a10-ground', 1400],
]

// Launch the browser ourselves with a fixed DevTools port, then connect.
// puppeteer.launch's pipe handshake fails under Git Bash, so we avoid it.
const PORT = Number(process.env.QA_PORT || 9400 + Math.floor(Math.random() * 80))
const profile = `C:/Users/bryan/AppData/Local/Temp/pptr-meridian-${TAG}-${Date.now()}`
const child = spawn(
  exe,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`,
    'about:blank',
  ],
  { detached: true, stdio: 'ignore' }
)
child.unref()

// wait for DevTools endpoint
let connected = null
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    if (r.ok) { connected = await r.json(); break }
  } catch {}
  await new Promise((r) => setTimeout(r, 250))
}
if (!connected) throw new Error('browser DevTools never came up on port ' + PORT)

const browser = await puppeteer.connect({
  browserWSEndpoint: connected.webSocketDebuggerUrl,
  defaultViewport: null,
})
const page = await browser.newPage()
const isMobile = TAG === 'm'
await page.setViewport({ width: W, height: H, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 })

const errors = []
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 200)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 200))
})

for (const [name, at] of shots) {
  await page.goto(`${BASE}/?at=${at}`, { waitUntil: 'load', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 4000))
  const opts = { path: `${OUT}/${TAG}-${name}.png` }
  if (process.env.QA_CLIP) {
    const [x, y, w, h] = process.env.QA_CLIP.split(',').map(Number)
    opts.clip = { x, y, width: w, height: h }
  }
  const sv = await page.evaluate(() => Math.round((window.scrollY / window.innerHeight) * 100))
  await page.screenshot(opts)
  console.log('shot', `${TAG}-${name}`, '@at=' + at, 'landedVh=' + sv)
}

if (errors.length) {
  console.log('\n--- RUNTIME ERRORS (' + errors.length + ') ---')
  console.log([...new Set(errors)].join('\n'))
} else {
  console.log('\nno runtime errors captured')
}
await browser.close()
try { child.kill() } catch {}

import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
const exe = candidates.find((p) => fs.existsSync(p))

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--window-size=1600,900', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })

// measure the real act layout first
await page.goto('http://localhost:5173/?at=0', { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
const acts = await page.evaluate(() =>
  Array.from(document.querySelectorAll('section[data-act]')).map((el) => ({
    act: el.dataset.act,
    top: el.getBoundingClientRect().top + window.scrollY,
    h: el.offsetHeight,
    ih: window.innerHeight,
  }))
)
console.log(acts.map((a) => `act${a.act}: top=${(a.top / a.ih).toFixed(1)}vh h=${(a.h / a.ih).toFixed(1)}vh`).join('\n'))

// shoot each act at a representative depth (fraction of its height)
const plan = [
  ['a1', 1, 0.0],
  ['a2', 2, 0.4],
  ['a3', 3, 0.55],
  ['a4-early', 4, 0.25],
  ['a4-late', 4, 0.7],
  ['a5', 5, 0.35],
  ['a6-top', 6, 0.1],
  ['a6-deep', 6, 0.6],
  ['a7', 7, 0.4],
  ['a8', 8, 0.45],
  ['a9', 9, 0.5],
]
for (const [name, actId, frac] of plan) {
  const a = acts.find((x) => Number(x.act) === actId)
  if (!a) continue
  const targetPx = a.top + a.h * frac
  const atVh = (targetPx / a.ih) * 100
  await page.goto(`http://localhost:5173/?at=${atVh.toFixed(1)}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 4000))
  await page.screenshot({ path: `C:/qa-meridian/full-${name}.png` })
  console.log('shot', name, '@', atVh.toFixed(0) + 'vh')
}
await browser.close()

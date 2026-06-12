import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
const exe = candidates.find((p) => fs.existsSync(p))
if (!exe) throw new Error('no browser found')

const shots = process.argv.slice(2).length
  ? process.argv.slice(2).map((s) => s.split('='))
  : [
      ['act1mid', 60],
      ['act3', 300],
      ['act4', 560],
      ['act7', 880],
      ['act9', 1060],
    ]

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--window-size=1600,900', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })
const BASE = process.env.QA_BASE || 'http://localhost:4173' // vite preview (prod build)
for (const [name, at] of shots) {
  await page.goto(`${BASE}/?at=${at}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 4000))
  await page.screenshot({ path: `C:/qa-meridian/p-${name}.png` })
  console.log('shot', name)
}
await browser.close()

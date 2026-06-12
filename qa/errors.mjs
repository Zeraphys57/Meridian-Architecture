import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const exe = candidates.find((p) => fs.existsSync(p))
const browser = await puppeteer.launch({ executablePath: exe, headless: true })
const page = await browser.newPage()
page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 600)))
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 800)))
page.on('requestfailed', (r) => console.log('[reqfail]', r.failure()?.errorText, r.url().slice(0, 160)))
page.on('response', (r) => {
  if (r.status() >= 400) console.log('[http]', r.status(), r.url().slice(0, 160))
})
await page.goto('http://localhost:5173/?at=480', { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 5000))
console.log('body children:', await page.evaluate(() => document.body.children.length))
console.log('root html len:', await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? -1))
console.log('body snippet:', await page.evaluate(() => document.body.innerHTML.slice(0, 400)))
await browser.close()

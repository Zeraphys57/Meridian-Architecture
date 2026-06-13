import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9400 + Math.floor(Math.random() * 80)
const child = spawn(exe, ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--user-data-dir=C:/Users/bryan/AppData/Local/Temp/pptr-verify-' + Date.now(), 'about:blank'], { detached: true, stdio: 'ignore' })
child.unref()
let v = null
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) { v = await r.json(); break } } catch {} await new Promise(r => setTimeout(r, 250)) }
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, defaultViewport: null })
const OUT = 'D:/Meridian - archi porto/qa/review'
fs.mkdirSync(OUT, { recursive: true })
const BASE = 'http://localhost:5173'

async function shoot(page, tag, name, at, ms = 4000) {
  await page.goto(`${BASE}/?at=${at}`, { waitUntil: 'load', timeout: 30000 })
  await new Promise(r => setTimeout(r, ms))
  await page.screenshot({ path: `${OUT}/fix-${tag}-${name}.png` })
  console.log('shot', `fix-${tag}-${name}`, '@at=' + at)
}

// ---- mobile ----
const m = await browser.newPage()
await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await shoot(m, 'm', 'foundation', 110)
await shoot(m, 'm', 'within', 1325)
await shoot(m, 'm', 'inhab-c', 980)
await shoot(m, 'm', 'ground', 2095)

// mobile menu open: nav appears past ~0.9vh, then tap the burger
await m.goto(`${BASE}/?at=300`, { waitUntil: 'load', timeout: 30000 })
await new Promise(r => setTimeout(r, 3500))
await m.click('.nav-burger')
await new Promise(r => setTimeout(r, 900))
await m.screenshot({ path: `${OUT}/fix-m-menu-open.png` })
console.log('shot fix-m-menu-open')

// ---- desktop ----
const d = await browser.newPage()
await d.setViewport({ width: 1600, height: 900 })
await shoot(d, 'd', 'material', 980)
await shoot(d, 'd', 'foundation', 150)
await shoot(d, 'd', 'inhab', 580)
await shoot(d, 'd', 'ground', 1660)

await browser.close()
try { child.kill() } catch {}

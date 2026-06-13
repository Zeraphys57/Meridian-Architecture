import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { useNarrative } from '../narrative/NarrativeProvider'

export const FLOOR_COUNT = 24
export const FLOOR_HEIGHT = 1.2
export const FOOTPRINT = 6
export const BUILDING_HEIGHT = FLOOR_COUNT * FLOOR_HEIGHT

const SLAB_T = 0.14 // thin plates — elegance lives in the slab edge
const TRAY_W = 6.9 // ~2.6m cantilever past the glass line, not a pancake
const TRAY_R = 0.92 // rounded tray corners — the luxury-residential signature
const GLASS_HALF = 2.5
const RAIL_H = 0.4
const CAR_SCALE = 1.9 // cars read at proper size next to ~0.6u-tall people

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)
// overshoot-and-settle for the balcony lock-in (scrub-safe: pure function of x)
const BACK = 2.6
const easeOutBack = (x) => 1 + (BACK + 1) * Math.pow(x - 1, 3) + BACK * Math.pow(x - 1, 2)
const clamp = THREE.MathUtils.clamp

// stepped penthouse crown
const setbackOf = (i) => (i >= 22 ? 0.78 : i >= 20 ? 0.9 : 1)

// soft build edge width (in floors) — shared by the floor loop, the edge
// crew, and the hoist so everything rides the same wave
const BUILD_SPREAD = 2.0

// X-braced truss pattern — turns solid crane members into open lattice
function latticeTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 14
  const cell = S / 4
  for (let i = 0; i <= 4; i++) {
    const k = i * cell
    ctx.beginPath()
    ctx.moveTo(0, k)
    ctx.lineTo(S, k)
    ctx.moveTo(k, 0)
    ctx.lineTo(k, S)
    ctx.stroke()
  }
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      ctx.beginPath()
      ctx.moveTo(x * cell, y * cell)
      ctx.lineTo((x + 1) * cell, (y + 1) * cell)
      ctx.moveTo((x + 1) * cell, y * cell)
      ctx.lineTo(x * cell, (y + 1) * cell)
      ctx.stroke()
    }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// mottled work-dirt patch under the site during construction
function dirtTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const rnd = mulberry32(3)
  for (let i = 0; i < 60; i++) {
    const r = 8 + rnd() * 34
    ctx.fillStyle = `rgba(140,124,96,${0.04 + rnd() * 0.09})`
    ctx.beginPath()
    ctx.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'destination-in'
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

// fine board-cast concrete: speckle + faint horizontal striations.
// Doubles as a roughness map so the sheen varies across every plate.
function concreteTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#F4F4F4'
  ctx.fillRect(0, 0, S, S)
  const rnd = mulberry32(19)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.06})`
    ctx.beginPath()
    ctx.arc(rnd() * S, rnd() * S, 0.4 + rnd() * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.075)'
  ctx.lineWidth = 1
  for (let y = 10; y < S; y += 18 + Math.floor(rnd() * 14)) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(S, y)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(0.5, 0.5)
  return tex
}

// apartment depth seen through the glazing: curtain bands + floor bounce
function interiorTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#E4E4E4'
  ctx.fillRect(0, 0, S, S)
  const rnd = mulberry32(23)
  let x = 0
  while (x < S) {
    const w = 18 + rnd() * 46
    ctx.fillStyle = rnd() > 0.5 ? '#F6F6F6' : '#CFCFCF'
    ctx.fillRect(x, 0, w, S)
    x += w
  }
  // warm floor bounce along the bottom of every room
  const g = ctx.createLinearGradient(0, S * 0.7, 0, S)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,0.5)')
  ctx.fillStyle = g
  ctx.fillRect(0, S * 0.7, S, S * 0.3)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// vertical streaks — every glass panel reflects a little differently
function glassStreakTexture() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#0E0E0E'
  ctx.fillRect(0, 0, S, S)
  const rnd = mulberry32(31)
  let x = 0
  while (x < S) {
    const w = 6 + rnd() * 22
    ctx.fillStyle = `rgb(${Math.floor(18 + rnd() * 40)},${Math.floor(18 + rnd() * 40)},${Math.floor(
      18 + rnd() * 40
    )})`
    ctx.fillRect(x, 0, w, S)
    x += w
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// asphalt: aggregate speckle + worn tonal patches (multiplies the road color)
function asphaltTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, S, S)
  const rnd = mulberry32(7)
  // soft tonal blotches — patched repairs + sun-worn lanes
  for (let i = 0; i < 26; i++) {
    const r = 14 + rnd() * 40
    const g = ctx.createRadialGradient(rnd() * S, rnd() * S, 0, rnd() * S, rnd() * S, r)
    const dark = rnd() > 0.5
    g.addColorStop(0, dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  }
  // fine aggregate grit
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = rnd() > 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.1})` : `rgba(255,255,255,${0.04 + rnd() * 0.06})`
    ctx.beginPath()
    ctx.arc(rnd() * S, rnd() * S, 0.5 + rnd() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(0.5, 0.5) // shape UVs are in world units → ~2u period
  return tex
}

// pale pavers with fine joint lines for the entry walk
function paverTexture(rx, ry) {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, S, S)
  ctx.strokeStyle = 'rgba(60,52,40,0.22)'
  ctx.lineWidth = 2.5
  for (let i = 0; i <= 4; i++) {
    const k = (i * S) / 4
    ctx.beginPath()
    ctx.moveTo(0, k)
    ctx.lineTo(S, k)
    ctx.moveTo(k, 0)
    ctx.lineTo(k, S)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(rx, ry)
  return tex
}

// manicured lawn — alternating mow stripes + a fine grass speckle
function lawnTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? '#7C9A60' : '#6E8C54'
    x.fillRect(0, (i * S) / 8, S, S / 8)
  }
  const rnd = mulberry32(91)
  for (let i = 0; i < 1500; i++) {
    x.fillStyle = `rgba(${rnd() > 0.5 ? '120,150,80' : '40,70,30'},${0.04 + rnd() * 0.07})`
    x.fillRect(rnd() * S, rnd() * S, 2, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(7, 7)
  return t
}

// oak planks: staggered boards with joints and faint grain
function plankTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, S, S)
  const rnd = mulberry32(37)
  const row = 32
  for (let y = 0; y < S; y += row) {
    ctx.fillStyle = `rgba(120,90,60,${0.04 + rnd() * 0.07})`
    ctx.fillRect(0, y, S, row)
    ctx.strokeStyle = 'rgba(60,40,20,0.25)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(S, y)
    ctx.stroke()
    // staggered end-joints + grain
    const jx = ((y / row) % 2 ? 0.33 : 0.71) * S
    ctx.beginPath()
    ctx.moveTo(jx, y)
    ctx.lineTo(jx, y + row)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(90,60,30,0.1)'
    for (let g = 0; g < 3; g++) {
      const gy = y + 6 + rnd() * (row - 10)
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(S, gy + (rnd() - 0.5) * 4)
      ctx.stroke()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.5, 3)
  return tex
}

// bordered rug with woven field
function rugTexture() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, S, S)
  const rnd = mulberry32(43)
  for (let i = 0; i < 350; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`
    ctx.fillRect(rnd() * S, rnd() * S, 2, 2)
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 3
  ctx.strokeRect(7, 7, S - 14, S - 14)
  ctx.lineWidth = 1
  ctx.strokeRect(13, 13, S - 26, S - 26)
  return new THREE.CanvasTexture(c)
}

// a set of gallery-quality abstract canvases in the luxe palette — each
// distinct, so no two apartments hang the same art
function artTexture(v) {
  const W = 96
  const H = 72
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')
  const grounds = ['#EDE7DA', '#E7E1D3', '#F1EDE3', '#E3DED1']
  x.fillStyle = grounds[v % 4]
  x.fillRect(0, 0, W, H)
  const P = {
    emerald: '#2E5043', sapphire: '#2A3C54', bordeaux: '#6E3B42', teal: '#27545A',
    rose: '#A07C84', sage: '#5F6B5A', champagne: '#C2A878', charcoal: '#2C2A26', terra: '#AE6A48',
  }
  const arc = (cx, cy, r, fill) => { x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill() }
  switch (v % 8) {
    case 0: // colour-block diptych
      x.fillStyle = P.bordeaux; x.fillRect(10, 12, 34, 48)
      x.fillStyle = P.sapphire; x.fillRect(52, 20, 30, 40)
      break
    case 1: // sage arch + champagne moon
      x.strokeStyle = P.sage; x.lineWidth = 7; x.beginPath(); x.arc(W / 2, H + 6, 40, Math.PI, 2 * Math.PI); x.stroke()
      arc(66, 20, 9, P.champagne)
      break
    case 2: // jewel verticals
      ;[P.emerald, P.terra, P.sapphire, P.champagne, P.bordeaux].forEach((col, i) => {
        x.fillStyle = col; x.fillRect(12 + i * 16, 10 + (i % 2) * 6, 9, 50)
      })
      break
    case 3: // eclipse
      arc(W / 2, H / 2, 27, P.emerald)
      arc(W / 2 - 9, H / 2 - 9, 11, grounds[(v + 1) % 4])
      break
    case 4: // teal / rose split
      x.fillStyle = P.teal; x.fillRect(8, 10, 38, 52)
      x.fillStyle = P.rose; x.fillRect(50, 10, 38, 52)
      break
    case 5: // minimal horizon
      x.fillStyle = P.sapphire; x.fillRect(0, H * 0.56, W, 6)
      arc(72, H * 0.38, 8, P.champagne)
      break
    case 6: // bordeaux field, champagne frame line
      x.fillStyle = P.bordeaux; x.fillRect(12, 10, 72, 52)
      x.strokeStyle = P.champagne; x.lineWidth = 2; x.strokeRect(22, 18, 52, 36)
      break
    default: // organic forms
      x.fillStyle = P.sage; x.beginPath(); x.ellipse(W / 2, H / 2, 30, 18, 0.4, 0, 7); x.fill()
      x.fillStyle = P.terra; x.beginPath(); x.ellipse(W / 2 + 12, H / 2 + 2, 12, 8, 0.4, 0, 7); x.fill()
  }
  x.strokeStyle = 'rgba(40,38,34,0.22)'; x.lineWidth = 2; x.strokeRect(2, 2, W - 4, H - 4)
  return new THREE.CanvasTexture(c)
}

// tiny radial glow for welding flashes
function sparkTexture() {
  const S = 32
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,240,210,1)')
  g.addColorStop(0.4, 'rgba(255,210,150,0.5)')
  g.addColorStop(1, 'rgba(255,200,130,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

// Build a tangent-space normal map from a procedural height field. `draw`
// paints grayscale height (mid-grey = flat, lighter = raised); a Sobel pass
// turns slope into RGB normals so otherwise-flat surfaces catch real relief
// under the directional sun — board-formed concrete, plaster, oak, weave.
function normalFromHeight(draw, { size = 256, strength = 2, repeat = [1, 1], seed = 1 } = {}) {
  const S = size
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, S, S)
  draw(ctx, S, mulberry32(seed))
  const src = ctx.getImageData(0, 0, S, S).data
  const at = (x, y) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255
  const out = ctx.createImageData(S, S)
  const d = out.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * S + x) * 4
      d[i] = ((dx / len) * 0.5 + 0.5) * 255
      d[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      d[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      d[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  return tex
}

// board-formed concrete: horizontal form-board seams + aggregate pitting
function concreteNormal() {
  return normalFromHeight(
    (ctx, S, rnd) => {
      ctx.strokeStyle = '#4A4A4A'
      ctx.lineWidth = 2
      for (let y = 0; y < S; y += S / 6) {
        ctx.beginPath(); ctx.moveTo(0, y + (rnd() - 0.5) * 2); ctx.lineTo(S, y + (rnd() - 0.5) * 2); ctx.stroke()
      }
      for (let i = 0; i < 1400; i++) {
        const v = rnd() > 0.5 ? 190 + rnd() * 50 : 55 + rnd() * 55
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 0.4 + rnd() * 1.6, 0, 7); ctx.fill()
      }
    },
    { size: 256, strength: 2.2, repeat: [0.5, 0.5], seed: 19 }
  )
}

// fine plaster stipple for interior walls
function plasterNormal() {
  return normalFromHeight(
    (ctx, S, rnd) => {
      for (let i = 0; i < 4200; i++) {
        const v = 108 + rnd() * 44
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.fillRect(rnd() * S, rnd() * S, 1.4, 1.4)
      }
    },
    { size: 256, strength: 1.1, repeat: [3, 3], seed: 5 }
  )
}

// oak plank relief — board seams (deep) + along-grain ticks (shallow)
function plankNormal() {
  return normalFromHeight(
    (ctx, S, rnd) => {
      const row = 32
      for (let y = 0; y < S; y += row) {
        ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke()
        const jx = ((y / row) % 2 ? 0.33 : 0.71) * S
        ctx.beginPath(); ctx.moveTo(jx, y); ctx.lineTo(jx, y + row); ctx.stroke()
        ctx.strokeStyle = 'rgba(150,150,150,0.5)'; ctx.lineWidth = 1
        for (let g = 0; g < 4; g++) {
          const gy = y + 5 + rnd() * (row - 8)
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(S, gy + (rnd() - 0.5) * 5); ctx.stroke()
        }
      }
    },
    { size: 256, strength: 1.6, repeat: [1.5, 3], seed: 37 }
  )
}

// stone/marble bevel — grooved joints matching the paver grid
function tileNormal(rx, ry) {
  return normalFromHeight(
    (ctx, S) => {
      ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 4
      for (let i = 0; i <= 4; i++) {
        const k = (i * S) / 4
        ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(S, k); ctx.moveTo(k, 0); ctx.lineTo(k, S); ctx.stroke()
      }
    },
    { size: 128, strength: 1.3, repeat: [rx, ry], seed: 3 }
  )
}

// bouclé weave bump for upholstery
function weaveNormal() {
  return normalFromHeight(
    (ctx, S, rnd) => {
      for (let i = 0; i < 700; i++) {
        const v = 150 + rnd() * 80
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 1 + rnd() * 1.4, 0, 7); ctx.fill()
      }
    },
    { size: 64, strength: 1.1, repeat: [1, 1], seed: 47 }
  )
}

// coarse asphalt aggregate — dense pitted grain
function asphaltNormal() {
  return normalFromHeight(
    (ctx, S, rnd) => {
      for (let i = 0; i < 2600; i++) {
        const v = rnd() > 0.5 ? 175 + rnd() * 60 : 60 + rnd() * 55
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 0.5 + rnd() * 1.5, 0, 7); ctx.fill()
      }
    },
    { size: 256, strength: 1.6, repeat: [4, 4], seed: 13 }
  )
}

// mown turf — soft directional tufts following the mow stripes
function grassNormal() {
  return normalFromHeight(
    (ctx, S, rnd) => {
      for (let i = 0; i < 2200; i++) {
        const v = 120 + rnd() * 70
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.fillRect(rnd() * S, rnd() * S, 1.2, 2.4 + rnd() * 1.5) // tall = blades
      }
    },
    { size: 128, strength: 0.9, repeat: [7, 7], seed: 23 }
  )
}

// the facade ripple — every tray subtly unique (Aqua Tower language).
// A slow sine wave runs up the building varying tray size and drift;
// amplitude calms toward the crown. Floor 0 is the wide anchor plate.
const TRAY_WAVE = Array.from({ length: FLOOR_COUNT }, (_, i) => {
  if (i === 0) return { s: 1.06, ox: 0, oz: 0 }
  const amp = 0.055 * (1 - (i / FLOOR_COUNT) * 0.45)
  return {
    s: 1 + Math.sin(i * 0.85 + 0.6) * amp,
    ox: Math.sin(i * 0.62 + 1.8) * 0.14,
    oz: Math.cos(i * 0.74 + 0.4) * 0.14,
  }
})

// deterministic RNG so the garden layout is composed, not random per reload
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundedRectShape(w, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -w / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + w - r)
  s.quadraticCurveTo(x + w, y + w, x + w - r, y + w)
  s.lineTo(x + r, y + w)
  s.quadraticCurveTo(x, y + w, x, y + w - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

// MERIDIAN RESIDENCES — a luxury apartment tower built from stacked balcony
// trays. Build choreography per floor: core+tray rise → glazing chases →
// tray cantilevers outward → glass balustrade and rail cap arrive last.
const Building = forwardRef(function Building(_, ref) {
  const floorsRef = useRef([])
  const trayGroupsRef = useRef([])
  const foundationRef = useRef()
  const podiumRef = useRef()
  const roofRef = useRef()
  const groupRef = useRef()
  const glow = useRef(0)
  const glassOp = useRef(0.5) // glass opacity scale — lighter by day, deeper at dusk

  // THE SECTION — a scroll-driven clipping plane slices the tower (and its
  // gardens and plinth) open along x, like an architect's sectional model
  const sectionPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 16), [])
  const sectionCur = useRef(0)
  const sectionFurnRef = useRef()

  const geo = useMemo(() => {
    const trayShape = roundedRectShape(TRAY_W, TRAY_R)
    // beveled plates: soft edge highlights instead of razor-hard extrusions
    const tray = new THREE.ExtrudeGeometry(trayShape, {
      depth: SLAB_T - 0.05,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.022,
      bevelSegments: 2,
      curveSegments: 24,
    })
    tray.rotateX(-Math.PI / 2)
    tray.translate(0, 0.025, 0) // bevel under-hang back to y 0..SLAB_T

    // glass balustrade: thin rounded ring standing on the tray edge
    const ringOuter = roundedRectShape(TRAY_W - 0.24, TRAY_R - 0.03)
    const ringHole = roundedRectShape(TRAY_W - 0.34, TRAY_R - 0.06)
    ringOuter.holes.push(new THREE.Path(ringHole.getPoints(48).reverse()))
    const ring = new THREE.ExtrudeGeometry(ringOuter, { depth: RAIL_H, bevelEnabled: false, curveSegments: 24 })
    ring.rotateX(-Math.PI / 2)
    ring.translate(0, -RAIL_H, 0) // anchor at its top edge for easy stacking

    // construction outline of the tray edge
    const pts = trayShape.getPoints(56)
    const outline = new THREE.BufferGeometry().setFromPoints(
      pts.map((p) => new THREE.Vector3(p.x, 0, -p.y))
    )

    return {
      tray,
      ring,
      outline,
      glass: new THREE.PlaneGeometry(GLASS_HALF * 2, FLOOR_HEIGHT - SLAB_T),
      interior: new THREE.BoxGeometry(GLASS_HALF * 2 - 0.1, FLOOR_HEIGHT - SLAB_T - 0.02, GLASS_HALF * 2 - 0.1),
      core: new THREE.BoxGeometry(1.8, FLOOR_HEIGHT, 1.8),
      post: new THREE.BoxGeometry(0.08, 0.9, 0.08),
      foundation: new THREE.BoxGeometry(FOOTPRINT + 1.2, 4, FOOTPRINT + 1.2),
      podium: new THREE.BoxGeometry(TRAY_W + 1.8, 0.12, TRAY_W + 1.8),
      podiumLower: new THREE.BoxGeometry(TRAY_W + 4.4, 0.1, TRAY_W + 4.4),
      // landscaped grounds — fills the gap between the plinth and the road
      lawnPlate: (() => {
        const g = new THREE.ShapeGeometry(roundedRectShape(24, 4.5), 16)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      groundsWalk: (() => {
        // a paved promenade ring looping around the building
        const o = roundedRectShape(19, 4.6)
        o.holes.push(new THREE.Path(roundedRectShape(16.6, 3.9).getPoints(44).reverse()))
        const g = new THREE.ShapeGeometry(o, 20)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      groundsPath: new THREE.BoxGeometry(1.8, 0.015, 6.6), // radial walk to the road
      forecourt: (() => {
        const g = new THREE.ShapeGeometry(roundedRectShape(7.6, 1.3), 12)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      // a low clipped-boxwood hedge ring framing the whole garden
      edgeHedge: (() => {
        const o = roundedRectShape(22.2, 4.2)
        o.holes.push(new THREE.Path(roundedRectShape(21.4, 4.0).getPoints(48).reverse()))
        const g = new THREE.ExtrudeGeometry(o, { depth: 0.32, bevelEnabled: false, curveSegments: 18 })
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      steppingStone: new THREE.CylinderGeometry(0.33, 0.33, 0.04, 18),
      entryStep: new THREE.BoxGeometry(4.6, 0.12, 0.5), // a tread of the grand entry stair
      // painted road edge lines (rendered as thin flat rings, scaled in/out)
      laneLine: (() => {
        const o = roundedRectShape(24.8, 3.05)
        o.holes.push(new THREE.Path(roundedRectShape(24.5, 3.0).getPoints(48).reverse()))
        const g = new THREE.ShapeGeometry(o, 28)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      trunk: new THREE.CylinderGeometry(0.05, 0.09, 1, 6),
      canopy: new THREE.IcosahedronGeometry(1, 0), // faceted — model-shop tree
      hedge: (() => {
        const h = new THREE.BoxGeometry(1, 0.34, 0.5)
        h.translate(0, 0.17, 0) // grow from the ground up
        return h
      })(),
      // perimeter ring road — flat band, rounded corners, kept well clear
      road: (() => {
        const outer = roundedRectShape(26, 3.2)
        const hole = roundedRectShape(22.8, 2.6)
        outer.holes.push(new THREE.Path(hole.getPoints(48).reverse()))
        const r = new THREE.ShapeGeometry(outer, 24)
        r.rotateX(-Math.PI / 2)
        return r
      })(),
      carBody: (() => {
        const b = new THREE.BoxGeometry(0.22, 0.13, 0.46)
        b.translate(0, 0.1, 0)
        return b
      })(),
      carCabin: (() => {
        const b = new THREE.BoxGeometry(0.18, 0.09, 0.24)
        b.translate(0, 0.21, -0.04)
        return b
      })(),
      // tower crane parts (unit mast scales with the build edge)
      craneMast: (() => {
        const m = new THREE.BoxGeometry(0.26, 1, 0.26)
        m.translate(0, 0.5, 0)
        return m
      })(),
      craneJib: new THREE.BoxGeometry(5.4, 0.16, 0.18),
      craneCounter: new THREE.BoxGeometry(1.9, 0.16, 0.18),
      craneWeight: new THREE.BoxGeometry(0.42, 0.5, 0.36),
      craneCab: new THREE.BoxGeometry(0.34, 0.34, 0.34),
      craneCable: (() => {
        const c = new THREE.BoxGeometry(0.022, 1, 0.022)
        c.translate(0, -0.5, 0) // hangs from its anchor
        return c
      })(),
      craneHook: new THREE.BoxGeometry(0.14, 0.14, 0.14),
      hookLoad: new THREE.BoxGeometry(0.28, 0.18, 0.28),
      // climbing screen — wraps the floors being poured at the build edge
      screen: (() => {
        const outer = roundedRectShape(TRAY_W + 0.5, TRAY_R + 0.08)
        const hole = roundedRectShape(TRAY_W + 0.34, TRAY_R + 0.04)
        outer.holes.push(new THREE.Path(hole.getPoints(40).reverse()))
        const s = new THREE.ExtrudeGeometry(outer, { depth: 1.7, bevelEnabled: false, curveSegments: 16 })
        s.rotateX(-Math.PI / 2) // anchored at its base, spans y 0..1.7
        return s
      })(),
      hoistMast: (() => {
        const b = new THREE.BoxGeometry(0.34, 1, 0.14)
        b.translate(0, 0.5, 0)
        return b
      })(),
      hoistCage: new THREE.BoxGeometry(0.55, 0.6, 0.4),
      cabin: new THREE.BoxGeometry(1.25, 0.5, 0.55),
      pallet: (() => {
        const b = new THREE.BoxGeometry(0.85, 1, 0.85)
        b.translate(0, 0.5, 0)
        return b
      })(),
      fence: (() => {
        const b = new THREE.BoxGeometry(11.2, 0.34, 0.03)
        b.translate(0, 0.17, 0)
        return b
      })(),
      mixerBody: (() => {
        const b = new THREE.BoxGeometry(0.32, 0.2, 0.95)
        b.translate(0, 0.18, 0)
        return b
      })(),
      mixerDrum: (() => {
        const d = new THREE.CylinderGeometry(0.15, 0.11, 0.52, 10)
        d.rotateX(Math.PI / 2)
        return d
      })(),
      truckCab: (() => {
        const b = new THREE.BoxGeometry(0.3, 0.24, 0.26)
        b.translate(0, 0.2, 0)
        return b
      })(),
      truckBed: (() => {
        const b = new THREE.BoxGeometry(0.32, 0.1, 0.85)
        b.translate(0, 0.13, 0)
        return b
      })(),
      crate: new THREE.BoxGeometry(0.24, 0.18, 0.4),
      // balcony fit-out
      lounger: new RoundedBoxGeometry(0.36, 0.07, 0.16, 2, 0.025),
      tableTop: new THREE.CylinderGeometry(0.07, 0.06, 0.09, 10),
      // interior fit-out detail
      book: new RoundedBoxGeometry(0.026, 0.13, 0.085, 1, 0.006),
      shelfBoard: new THREE.BoxGeometry(0.66, 0.018, 0.2),
      shelfBack: new THREE.BoxGeometry(0.7, 0.96, 0.04),
      counterTop: (() => {
        const b = new RoundedBoxGeometry(0.86, 0.05, 0.46, 2, 0.02)
        b.translate(0, 0.3, 0)
        return b
      })(),
      globe: new THREE.SphereGeometry(0.05, 16, 16),
      frameSm: new THREE.BoxGeometry(0.3, 0.4, 0.03),
      frameWide: new THREE.BoxGeometry(0.46, 0.3, 0.03),
      trayDeco: new RoundedBoxGeometry(0.26, 0.018, 0.16, 1, 0.008),
      bottle: new THREE.CylinderGeometry(0.018, 0.022, 0.13, 8),
      // frosted privacy fins dividing each floor into apartments — merged
      // into one mesh per floor (4 fins at the face midpoints)
      fins: (() => {
        const parts = [
          new THREE.BoxGeometry(0.03, 0.95, 0.6).translate(0, 0, 2.86),
          new THREE.BoxGeometry(0.03, 0.95, 0.6).translate(0, 0, -2.86),
          new THREE.BoxGeometry(0.6, 0.95, 0.03).translate(2.86, 0, 0),
          new THREE.BoxGeometry(0.6, 0.95, 0.03).translate(-2.86, 0, 0),
        ]
        return mergeGeometries(parts)
      })(),
      doorPanel: new THREE.BoxGeometry(1.6, 0.98, 0.05),
      curbOuter: (() => {
        const o = roundedRectShape(26.15, 3.25)
        const h = roundedRectShape(25.95, 3.2)
        o.holes.push(new THREE.Path(h.getPoints(48).reverse()))
        const g = new THREE.ShapeGeometry(o, 24)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      curbInner: (() => {
        const o = roundedRectShape(22.95, 2.62)
        const h = roundedRectShape(22.75, 2.58)
        o.holes.push(new THREE.Path(h.getPoints(48).reverse()))
        const g = new THREE.ShapeGeometry(o, 24)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      lampPole: (() => {
        const b = new THREE.BoxGeometry(0.05, 1.3, 0.05)
        b.translate(0, 0.65, 0)
        return b
      })(),
      lampHead: new THREE.BoxGeometry(0.13, 0.05, 0.13),
      bench: (() => {
        const b = new THREE.BoxGeometry(0.55, 0.06, 0.2)
        b.translate(0, 0.27, 0)
        return b
      })(),
      benchBase: (() => {
        const b = new THREE.BoxGeometry(0.45, 0.24, 0.14)
        b.translate(0, 0.12, 0)
        return b
      })(),
      poolBorder: new THREE.BoxGeometry(2.4, 0.09, 1.6),
      poolWater: new THREE.PlaneGeometry(2.18, 1.38),
      pathStep: new THREE.BoxGeometry(1.3, 0.1, 0.34),
      parasolTop: new THREE.ConeGeometry(0.36, 0.14, 8),
      // section-cut room furniture — rounded edges throughout: nothing
      // in a home is a razor-edged box
      bed: (() => {
        const b = new RoundedBoxGeometry(0.95, 0.16, 1.3, 2, 0.035)
        b.translate(0, 0.08, 0)
        return b
      })(),
      headboard: new RoundedBoxGeometry(0.95, 0.34, 0.06, 2, 0.02),
      rug: new THREE.BoxGeometry(1.5, 0.015, 1.9),
      sofaSeat: (() => {
        const b = new RoundedBoxGeometry(1.15, 0.16, 0.42, 2, 0.05)
        b.translate(0, 0.08, 0)
        return b
      })(),
      sofaBack: new RoundedBoxGeometry(1.15, 0.2, 0.08, 2, 0.035),
      dinTable: (() => {
        const b = new RoundedBoxGeometry(0.95, 0.05, 0.52, 2, 0.02)
        b.translate(0, 0.24, 0) // true table height (~0.75m), not bar height
        return b
      })(),
      stool: new RoundedBoxGeometry(0.16, 0.16, 0.16, 2, 0.04),
      duvet: (() => {
        const b = new RoundedBoxGeometry(0.88, 0.07, 0.8, 2, 0.03)
        b.translate(0, 0.19, 0.18)
        return b
      })(),
      pillow: new RoundedBoxGeometry(0.32, 0.07, 0.2, 2, 0.03),
      mirror: (() => {
        const m = new THREE.CylinderGeometry(0.17, 0.17, 0.015, 24)
        m.rotateX(Math.PI / 2)
        return m
      })(),
      pot: (() => {
        const p = new THREE.CylinderGeometry(0.05, 0.038, 0.08, 10)
        p.translate(0, 0.04, 0)
        return p
      })(),
      wheel: (() => {
        const w = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 10)
        w.rotateZ(Math.PI / 2)
        return w
      })(),
      lightDot: new THREE.SphereGeometry(0.018, 6, 6),
      bollard: (() => {
        const b = new THREE.BoxGeometry(0.035, 0.24, 0.035)
        b.translate(0, 0.12, 0)
        return b
      })(),
      cable: new THREE.BoxGeometry(0.012, 0.26, 0.012),
      artPanel: new THREE.BoxGeometry(0.72, 0.5, 0.03),
      lampShade: new THREE.ConeGeometry(0.11, 0.15, 8),
      partition: (() => {
        // full-depth party wall: cut face to facade, floor to ceiling
        const b = new THREE.BoxGeometry(2.4, 1.04, 0.12)
        b.translate(0, 0.52, 0)
        return b
      })(),
      floorPanel: (() => {
        // finish floor covers the ENTIRE visible half-plate, wall to wall
        const b = new THREE.BoxGeometry(2.45, 0.025, 4.86)
        b.translate(0, 0.0125, 0)
        return b
      })(),
      credenza: (() => {
        const b = new RoundedBoxGeometry(0.92, 0.2, 0.26, 2, 0.025)
        b.translate(0, 0.1, 0)
        return b
      })(),
      curtain: (() => {
        const b = new THREE.BoxGeometry(0.04, 1.02, 0.52)
        b.translate(0, 0.51, 0)
        return b
      })(),
      lightPool: new THREE.PlaneGeometry(0.75, 0.75),
      // tapered bird wing, root at origin so the flap pivots at the body
      wing: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, -0.05)
        s.quadraticCurveTo(0.22, -0.09, 0.4, -0.01)
        s.quadraticCurveTo(0.3, 0.05, 0.08, 0.06)
        s.lineTo(0, 0.05)
        s.closePath()
        const g = new THREE.ShapeGeometry(s, 6)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      birdBody: (() => {
        const b = new THREE.CapsuleGeometry(0.032, 0.11, 3, 8)
        b.rotateX(Math.PI / 2) // long axis along z (flight direction)
        return b
      })(),
      birdHead: new THREE.SphereGeometry(0.026, 8, 8),
      beak: (() => {
        const b = new THREE.ConeGeometry(0.012, 0.05, 6)
        b.rotateX(Math.PI / 2)
        return b
      })(),
      tail: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(0.045, -0.12)
        s.lineTo(-0.045, -0.12)
        s.closePath()
        const g = new THREE.ShapeGeometry(s)
        g.rotateX(-Math.PI / 2)
        return g
      })(),
      beacon: new THREE.SphereGeometry(0.08, 8, 8),
      // glazing mullions — 12 bronze bars per floor merged into one mesh;
      // they give the curtain wall its scale and rhythm
      mullions: (() => {
        const parts = []
        const h = FLOOR_HEIGHT - SLAB_T - 0.02
        const offs = [(-GLASS_HALF * 2) / 3, 0, (GLASS_HALF * 2) / 3]
        for (const o of offs) {
          parts.push(
            new THREE.BoxGeometry(0.045, h, 0.045).translate(o, 0, GLASS_HALF),
            new THREE.BoxGeometry(0.045, h, 0.045).translate(o, 0, -GLASS_HALF),
            new THREE.BoxGeometry(0.045, h, 0.045).translate(GLASS_HALF, 0, o),
            new THREE.BoxGeometry(0.045, h, 0.045).translate(-GLASS_HALF, 0, o)
          )
        }
        // horizontal transoms complete the curtain-wall grid
        const w = GLASS_HALF * 2 - 0.02
        parts.push(
          new THREE.BoxGeometry(w, 0.035, 0.035).translate(0, 0.12, GLASS_HALF),
          new THREE.BoxGeometry(w, 0.035, 0.035).translate(0, 0.12, -GLASS_HALF),
          new THREE.BoxGeometry(0.035, 0.035, w).translate(GLASS_HALF, 0.12, 0),
          new THREE.BoxGeometry(0.035, 0.035, w).translate(-GLASS_HALF, 0.12, 0)
        )
        return mergeGeometries(parts)
      })(),
      portico: new THREE.BoxGeometry(2.8, 0.07, 1.8),
      // scale figures — model-shop staffage with a human silhouette:
      // legs, a flattened torso with shoulders, and a head. Wide from the
      // front, slim from the side — reads as a person from every angle.
      figLegs: (() => {
        const b = new THREE.BoxGeometry(0.13, 0.22, 0.075)
        b.translate(0, 0.11, 0)
        return b
      })(),
      figTorso: (() => {
        const c = new THREE.CapsuleGeometry(0.07, 0.17, 4, 12)
        c.scale(1.2, 1, 0.62)
        c.translate(0, 0.37, 0)
        return c
      })(),
      figHead: new THREE.SphereGeometry(0.05, 10, 10),
      figArm: new THREE.CapsuleGeometry(0.02, 0.17, 3, 6),
      figHair: new THREE.SphereGeometry(0.054, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      petBody: (() => {
        const b = new RoundedBoxGeometry(0.07, 0.09, 0.18, 2, 0.028)
        b.translate(0, 0.05, 0)
        return b
      })(),
      petHead: new THREE.SphereGeometry(0.045, 8, 8),
    }
  }, [])

  const base = useMemo(
    () => ({
      concrete: (() => {
        const tex = concreteTexture()
        return new THREE.MeshStandardMaterial({
          color: '#DDD6C8',
          map: tex,
          roughnessMap: tex, // speckle modulates the sheen too
          normalMap: concreteNormal(), // board-formed relief on every slab edge
          normalScale: new THREE.Vector2(0.45, 0.45),
          roughness: 0.6,
          metalness: 0.06,
          envMapIntensity: 0.85,
          transparent: true,
          emissive: new THREE.Color('#C9B896'),
          emissiveIntensity: 0,
        })
      })(),
      line: new THREE.LineBasicMaterial({ color: '#C9B896', transparent: true, opacity: 0 }),
      foundation: new THREE.MeshStandardMaterial({
        color: '#8F8A7E',
        roughness: 1,
        transparent: true,
        opacity: 0.95,
      }),
    }),
    []
  )

  const solidMats = useMemo(
    () => Array.from({ length: FLOOR_COUNT }, () => base.concrete.clone()),
    [base]
  )
  const edgeMats = useMemo(
    () => Array.from({ length: FLOOR_COUNT }, () => base.line.clone()),
    [base]
  )
  const glassMats = useMemo(() => {
    const streak = glassStreakTexture()
    return Array.from(
      { length: FLOOR_COUNT },
      (_, i) =>
        new THREE.MeshPhysicalMaterial({
          color: '#69655A',
          roughness: 1, // actual roughness lives in the streak map (~0.05-0.25)
          roughnessMap: streak,
          metalness: 0.15,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.7 + ((i * 7) % 5) * 0.13, // panel-to-panel variation
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          emissive: new THREE.Color('#E8C290'),
          emissiveIntensity: 0,
        })
    )
  }, [])
  const intMats = useMemo(() => {
    const rooms = interiorTexture()
    return Array.from(
      { length: FLOOR_COUNT },
      () =>
        new THREE.MeshStandardMaterial({
          color: '#26231E',
          map: rooms, // curtain bands + floor bounce behind the glass
          roughness: 0.95,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide, // cut faces must read, not vanish
        })
    )
  }, [])
  // balustrade glass — lighter than the curtain wall
  const balMats = useMemo(
    () =>
      Array.from({ length: FLOOR_COUNT }, () =>
        new THREE.MeshPhysicalMaterial({
          color: '#9AA39E',
          roughness: 0.1,
          envMapIntensity: 1.4,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
    []
  )
  // champagne rail cap
  const railMats = useMemo(
    () =>
      Array.from({ length: FLOOR_COUNT }, () =>
        new THREE.MeshStandardMaterial({
          color: '#B7A380',
          roughness: 0.35,
          metalness: 0.7,
          envMapIntensity: 1.2,
          transparent: true,
          opacity: 0,
        })
      ),
    []
  )
  // dark bronze window frames
  const mullMats = useMemo(
    () =>
      Array.from({ length: FLOOR_COUNT }, () =>
        new THREE.MeshStandardMaterial({
          color: '#3F3A33',
          roughness: 0.32,
          metalness: 0.78,
          envMapIntensity: 1.4,
          transparent: true,
          opacity: 0,
        })
      ),
    []
  )
  // crown light strip — glows at the parapet after dusk
  const crownMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#E8C290', transparent: true, opacity: 0 }),
    []
  )
  // architectural base lighting — washes the podium line at dusk
  const baseGlowMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: '#E8C290', transparent: true, opacity: 0 })
    m.clippingPlanes = [sectionPlane]
    return m
  }, [sectionPlane])
  const roofMat = useMemo(() => base.concrete.clone(), [base])
  const podiumMat = useMemo(() => {
    const m = base.concrete.clone()
    m.map = paverTexture(7, 7) // the plinth reads as a paved terrace
    m.roughnessMap = null
    m.normalMap = tileNormal(7, 7) // joints recessed to match the pavers
    m.normalScale = new THREE.Vector2(0.3, 0.3)
    m.opacity = 0
    return m
  }, [base])
  const litRand = useMemo(
    () => Array.from({ length: FLOOR_COUNT }, () => 0.35 + Math.random() * 0.9),
    []
  )
  const glazedRef = useRef(new Float32Array(FLOOR_COUNT))
  // per-floor interior tint variation — some apartments read lighter
  // (curtains, finishes), so the facade never repeats exactly
  const intTint = useMemo(() => {
    const rnd = mulberry32(29)
    return Array.from({ length: FLOOR_COUNT }, () => 0.85 + rnd() * 0.45)
  }, [])
  // subtle per-tray tonal drift — a poured stack, not one extruded color
  const trayTint = useMemo(() => {
    const rnd = mulberry32(71)
    return Array.from({ length: FLOOR_COUNT }, () => 0.965 + rnd() * 0.06)
  }, [])
  // balcony decor: a few sun-loungers on scattered terraces. (No planters —
  // the facade reads as clean architecture, not a vertical garden.)
  const decor = useMemo(() => {
    const rnd = mulberry32(53)
    const byFloor = {}
    const floors = new Set()
    for (let n = 0; n < 8; n++) {
      let f
      do { f = 1 + Math.floor(rnd() * 22) } while (floors.has(f)) // one per floor, max
      floors.add(f)
      const a = rnd() * Math.PI * 2
      const r = 2.55 + rnd() * 0.35
      ;(byFloor[f] = byFloor[f] || []).push({
        type: 'lounge',
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        rot: -a,
        m: Math.floor(rnd() * 3),
        s: 0.95 + rnd() * 0.25,
      })
    }
    return byFloor
  }, [])
  const doorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3F3A33', roughness: 0.35, metalness: 0.65, envMapIntensity: 1 }),
    []
  )

  // aviation beacon on the roof — blinks at dusk
  const beaconRef = useRef()
  const beaconMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#E86A4A', transparent: true, opacity: 0 }),
    []
  )

  // painted ambient-occlusion blob under the tower — deterministic, soft,
  // and immune to the render-target failures of real-time contact shadows
  const shadowRef = useRef()
  const shadowMat = useMemo(() => {
    const S = 256
    const c = document.createElement('canvas')
    c.width = c.height = S
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(20,19,15,0.85)')
    g.addColorStop(0.4, 'rgba(20,19,15,0.5)')
    g.addColorStop(0.75, 'rgba(20,19,15,0.16)')
    g.addColorStop(1, 'rgba(20,19,15,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(c)
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })
  }, [])

  // residents on a scatter of balconies — people (and their pets) at the
  // railing, placed on one of the four faces, mostly looking out
  // bouclé weave — clothes and upholstery share the same soft grain
  const weaveTex = useMemo(() => {
    const S = 64
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, S, S)
    const rnd = mulberry32(47)
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.07})`
      ctx.fillRect(rnd() * S, rnd() * S, 1.6, 1.6)
    }
    const weave = new THREE.CanvasTexture(cv)
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping
    return weave
  }, [])
  // matching bump so the weave catches light instead of reading as flat paint
  const weaveNrm = useMemo(() => weaveNormal(), [])
  // neutral upholstery / clothing — charcoal, champagne, sage, ivory (no brown)
  const figMats = useMemo(
    () =>
      ['#2C2A26', '#C2A878', '#6E7B6A', '#EDE8DC'].map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            map: weaveTex,
            normalMap: weaveNrm,
            normalScale: new THREE.Vector2(0.3, 0.3),
            roughness: 0.78,
            envMapIntensity: 0.5,
          })
      ),
    [weaveTex, weaveNrm]
  )
  // per-room signature velvet — each unit type gets one couture hero colour,
  // so every floor of the open section reads as its own art-directed room:
  // [0 bed rose · 1 living emerald · 2 dining sapphire · 3 retail bordeaux ·
  //  4 workspace sage · 5 club teal]. Sheen gives the soft velvet edge-light.
  const signatureMats = useMemo(() => {
    const white = new THREE.Color('#FFFFFF')
    return ['#A07C84', '#2E5043', '#2A3C54', '#6E3B42', '#5F6B5A', '#27545A'].map((c) => {
      const base = new THREE.Color(c)
      return new THREE.MeshPhysicalMaterial({
        color: base,
        map: weaveTex,
        normalMap: weaveNrm,
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughness: 0.62,
        sheen: 1,
        sheenColor: base.clone().lerp(white, 0.45),
        sheenRoughness: 0.45,
        envMapIntensity: 0.5,
      })
    })
  }, [weaveTex, weaveNrm])
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#D9B48F', roughness: 0.75 }),
    []
  )
  const hairMats = useMemo(
    () =>
      ['#3A302A', '#6B5742', '#1C1B19', '#8A8478'].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
      ),
    []
  )
  const mirrorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#D8D8D2',
        metalness: 0.9,
        roughness: 0.08,
        envMapIntensity: 1.6,
      }),
    []
  )
  const figures = useMemo(() => {
    const rnd = mulberry32(11)
    const byFloor = {}
    const place = (f, entry) => ((byFloor[f] = byFloor[f] || []).push(entry))
    const SIDES = [
      (a, r) => ({ x: a, z: r, rot: 0 }),
      (a, r) => ({ x: a, z: -r, rot: Math.PI }),
      (a, r) => ({ x: r, z: a, rot: Math.PI / 2 }),
      (a, r) => ({ x: -r, z: a, rot: -Math.PI / 2 }),
    ]
    for (let n = 0; n < 11; n++) {
      const f = 1 + Math.floor(rnd() * 19)
      const side = SIDES[Math.floor(rnd() * 4)]
      const along = -1.6 + rnd() * 3.2
      const pos = side(along, 2.78 + rnd() * 0.2)
      const c = Math.floor(rnd() * 4)
      place(f, {
        ...pos,
        rot: pos.rot + (rnd() - 0.5) * 0.7,
        s: 0.9 + rnd() * 0.2,
        c,
        person: true,
        ph: rnd() * Math.PI * 2,
      })
      // some residents brought their dog out
      if (rnd() < 0.35) {
        const pet = side(along + 0.3, 2.8 + rnd() * 0.15)
        place(f, { ...pet, rot: pet.rot + (rnd() - 0.5) * 1.2, s: 1, c: c < 2 ? 2 : 0, person: false, ph: 0 })
      }
    }
    return byFloor
  }, [])

  // garden palette — four sage tones, faceted like a milled model tree
  const gardenMats = useMemo(
    () => ({
      foliage: ['#7FA361', '#699254', '#8FB175', '#57804A'].map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.9,
            envMapIntensity: 0.3,
            flatShading: true,
          })
      ),
      hedge: (() => {
        // leafy speckle so clipped hedges read as foliage, not foam blocks
        const S = 64
        const cv = document.createElement('canvas')
        cv.width = cv.height = S
        const cx = cv.getContext('2d')
        cx.fillStyle = '#FFFFFF'
        cx.fillRect(0, 0, S, S)
        const rr = mulberry32(67)
        for (let i = 0; i < 380; i++) {
          cx.fillStyle = `rgba(10,40,5,${0.06 + rr() * 0.12})`
          cx.fillRect(rr() * S, rr() * S, 2, 2)
        }
        const t = new THREE.CanvasTexture(cv)
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(3, 1.5)
        return new THREE.MeshStandardMaterial({ color: '#618352', map: t, roughness: 0.95, envMapIntensity: 0.25 })
      })(),
      trunk: new THREE.MeshStandardMaterial({ color: '#6B5742', roughness: 0.9 }),
    }),
    []
  )
  // vivid-but-tasteful seasonal flower colours for the parterre beds
  const flowerMats = useMemo(
    () =>
      ['#C8505A', '#E0903A', '#B179A8', '#E7D7A2'].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, flatShading: true })
      ),
    []
  )
  // landscaped grounds — manicured lawn + warm stone walks (scale in at handover)
  const lawnMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6E8C54',
        map: lawnTexture(),
        normalMap: grassNormal(), // soft turf tufts, not a flat green sheet
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughness: 0.96,
        envMapIntensity: 0.18,
      }),
    []
  )
  const pathStoneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#D9D1BF',
        map: paverTexture(5, 5),
        normalMap: tileNormal(5, 5), // recessed paver joints
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughness: 0.82,
        envMapIntensity: 0.3,
      }),
    []
  )

  // organic canopy blobs: jittered icosahedra (welded so faces stay sealed)
  // — three shared variants so no two crowns read identical
  const blobGeos = useMemo(() => {
    const rnd = mulberry32(13)
    return Array.from({ length: 3 }, () => {
      const g = new THREE.IcosahedronGeometry(1, 1)
      const pos = g.attributes.position
      const weld = new Map()
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
        if (!weld.has(key)) weld.set(key, 1 + (rnd() - 0.5) * 0.38)
        const s = weld.get(key)
        pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s)
      }
      g.computeVertexNormals()
      return g
    })
  }, [])

  // a complete little person: legs, torso, ARMS, skin head, hair (or hat).
  // Arms are what stop a figure reading as a stick at any distance.
  const renderFigure = (c, hairIdx = 0, hat = false) => (
    <>
      <mesh geometry={geo.figLegs} material={figMats[c]} />
      <mesh geometry={geo.figTorso} material={figMats[c]} />
      <mesh geometry={geo.figArm} material={figMats[c]} position={[-0.105, 0.37, 0]} rotation={[0, 0, 0.12]} />
      <mesh geometry={geo.figArm} material={figMats[c]} position={[0.105, 0.37, 0]} rotation={[0, 0, -0.12]} />
      <mesh geometry={geo.figHead} material={skinMat} position={[0, 0.56, 0]} />
      {hat ? (
        <mesh geometry={geo.figHead} material={hatMat} position={[0, 0.595, 0]} scale={[1.18, 0.55, 1.18]} />
      ) : (
        <mesh geometry={geo.figHair} material={hairMats[hairIdx % 4]} position={[0, 0.582, -0.008]} />
      )}
    </>
  )

  // a row of mixed-colour book spines standing on a shelf (origin at shelf top)
  const renderBooks = (seed, count = 9, span = 0.58) => {
    const rnd = mulberry32(seed)
    return Array.from({ length: count }, (_, i) => {
      const h = 0.78 + rnd() * 0.5
      const lean = rnd() > 0.86 ? 0.3 : 0
      const x = count > 1 ? -span / 2 + (i / (count - 1)) * span : 0
      return (
        <mesh
          key={i}
          geometry={geo.book}
          material={bookMats[Math.floor(rnd() * 9)]}
          position={[x, 0.065 * h, lean ? 0.01 : 0]}
          rotation={[0, 0, lean]}
          scale={[1, h, 1]}
        />
      )
    })
  }

  // a full-height library unit — back panel, three stocked shelves, objets
  const renderBookcase = () => (
    <>
      <mesh geometry={geo.shelfBack} material={woodMat} position={[0, 0.5, -0.11]} />
      {[0.14, 0.43, 0.72].map((y, s) => (
        <group key={s} position={[0, y, 0]}>
          <mesh geometry={geo.shelfBoard} material={woodMat} />
          {renderBooks(s * 13 + 5, 9, 0.58)}
        </group>
      ))}
      <mesh geometry={geo.pot} material={benchMat} position={[0.25, 0.45, 0]} scale={[0.95, 1.05, 0.95]} />
      <mesh geometry={geo.globe} material={mirrorMat} position={[-0.24, 0.75, 0]} scale={0.7} />
    </>
  )

  // a sculptural pendant — cord, brass shell, warm glowing core
  const renderPendant = (drop = 0.42) => (
    <>
      <mesh geometry={geo.cable} material={woodMat} position={[0, 1.02 - drop / 2, 0]} scale={[1, drop / 0.26, 1]} />
      <mesh geometry={geo.globe} material={benchMat} position={[0, 1.02 - drop, 0]} />
      <mesh geometry={geo.globe} material={lampGlowMat} position={[0, 1.02 - drop, 0]} scale={0.7} />
    </>
  )

  // a gallery wall composed uniquely per unit — the layout and every artwork
  // are picked from the room's own seed, so no two floors hang the same wall
  const renderGallery = (seed) => {
    const rnd = mulberry32(seed * 23 + 7)
    const n = artMats.length
    const used = []
    const pick = () => {
      let a
      do { a = Math.floor(rnd() * n) } while (used.includes(a) && used.length < n)
      used.push(a)
      return artMats[a]
    }
    const layout = Math.floor(rnd() * 4)
    if (layout === 0) {
      // statement hero + two companions, asymmetric
      return (
        <>
          <mesh geometry={geo.artPanel} material={pick()} position={[-0.06, 0.64, 0]} />
          <mesh geometry={geo.frameSm} material={pick()} position={[0.5, 0.76, 0]} />
          <mesh geometry={geo.frameWide} material={pick()} position={[0.46, 0.4, 0]} />
        </>
      )
    }
    if (layout === 1) {
      // salon hang — a 2×2 cluster of small frames
      return (
        <>
          <mesh geometry={geo.frameSm} material={pick()} position={[-0.29, 0.79, 0]} />
          <mesh geometry={geo.frameWide} material={pick()} position={[0.3, 0.81, 0]} />
          <mesh geometry={geo.frameWide} material={pick()} position={[-0.31, 0.46, 0]} />
          <mesh geometry={geo.frameSm} material={pick()} position={[0.31, 0.44, 0]} />
        </>
      )
    }
    if (layout === 2) {
      // a single oversized statement piece, offset
      return <mesh geometry={geo.artPanel} material={pick()} position={[0.02, 0.66, 0]} scale={[1.2, 1.3, 1]} />
    }
    // horizontal triptych
    return (
      <>
        <mesh geometry={geo.frameSm} material={pick()} position={[-0.46, 0.64, 0]} />
        <mesh geometry={geo.frameSm} material={pick()} position={[0, 0.64, 0]} />
        <mesh geometry={geo.frameSm} material={pick()} position={[0.46, 0.64, 0]} />
      </>
    )
  }

  // a floor-standing planter — pot, slender trunk, layered crown
  const renderTallPlant = (k) => (
    <>
      <mesh geometry={geo.pot} material={woodMat} scale={[1.7, 2.0, 1.7]} />
      <mesh geometry={geo.trunk} material={gardenMats.trunk} scale={[0.5, 0.55, 0.5]} position={[0, 0.3, 0]} />
      <mesh geometry={blobGeos[k % 3]} material={gardenMats.foliage[k % 4]} position={[0, 0.54, 0]} scale={[0.23, 0.31, 0.23]} />
      <mesh geometry={blobGeos[(k + 1) % 3]} material={gardenMats.foliage[(k + 2) % 4]} position={[0.11, 0.45, 0.06]} scale={0.15} />
      <mesh geometry={blobGeos[(k + 2) % 3]} material={gardenMats.foliage[(k + 1) % 4]} position={[-0.1, 0.5, -0.05]} scale={0.13} />
    </>
  )

  // a full specimen tree for the grounds — trunk + a rounded clustered crown
  const renderGroundTree = (seed, h = 1.7, cs = 0.85) => (
    <>
      <mesh geometry={geo.trunk} material={gardenMats.trunk} scale={[1, h, 1]} position={[0, h / 2, 0]} castShadow />
      <group position={[0, h, 0]}>
        <mesh geometry={blobGeos[seed % 3]} material={gardenMats.foliage[seed % 4]} position={[0, 0.05, 0]} scale={[cs, cs * 0.85, cs]} castShadow />
        <mesh geometry={blobGeos[(seed + 1) % 3]} material={gardenMats.foliage[(seed + 2) % 4]} position={[cs * 0.5, -0.1, cs * 0.3]} scale={cs * 0.62} />
        <mesh geometry={blobGeos[(seed + 2) % 3]} material={gardenMats.foliage[(seed + 1) % 4]} position={[-cs * 0.45, -0.06, -cs * 0.3]} scale={cs * 0.55} />
      </group>
    </>
  )

  const plantsRef = useRef([])
  const { treeData, hedgeData, plantStarts } = useMemo(() => {
    const rnd = mulberry32(7)
    const trees = []
    // a tree = leaning trunk + 1-2 branches + 3-4 clustered canopy blobs
    const makeTree = (x, y, z, h, cs, start) => {
      const blobs = [
        { g: Math.floor(rnd() * 3), m: Math.floor(rnd() * 4), dx: 0, dy: 0.08, dz: 0, s: cs },
      ]
      const extra = 2 + (rnd() > 0.55 ? 1 : 0)
      for (let b = 0; b < extra; b++) {
        const ang = rnd() * Math.PI * 2
        const rr = cs * (0.5 + rnd() * 0.4)
        blobs.push({
          g: Math.floor(rnd() * 3),
          m: Math.floor(rnd() * 4),
          dx: Math.cos(ang) * rr,
          dy: -0.08 + rnd() * 0.45 * cs,
          dz: Math.sin(ang) * rr,
          s: cs * (0.42 + rnd() * 0.3),
        })
      }
      const branches = Array.from({ length: 1 + (rnd() > 0.5 ? 1 : 0) }, () => ({
        dx: (rnd() - 0.5) * 0.16,
        dz: (rnd() - 0.5) * 0.16,
        rx: (rnd() - 0.5) * 1.3,
        rz: (rnd() - 0.5) * 1.3,
      }))
      return {
        x, y, z, h, cs, start, blobs, branches,
        lx: (rnd() - 0.5) * 0.09,
        lz: (rnd() - 0.5) * 0.09,
      }
    }
    // a formal allée — evenly-spaced specimen trees ringing the plinth, with
    // the south entry approach and the crane corridor left open
    const RING = 16
    const R = 7.7
    const CRANE_A = -0.37
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2 + 0.196
      const da = Math.abs(Math.atan2(Math.sin(a - CRANE_A), Math.cos(a - CRANE_A)))
      const south = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)))
      if (da < 0.45 || south < 0.42) continue
      trees.push(makeTree(Math.cos(a) * R, 0, Math.sin(a) * R, 1.9, 0.74, 0.66 + (i % 4) * 0.015))
    }
    // matched accent trees on the plinth corners
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      trees.push(makeTree(4.1 * sx, 0.22, 4.1 * sz, 1.15, 0.5, 0.7))
    }
    // a designed parterre: clipped-hedge ribbons framing the plinth + vivid
    // seasonal flower beds flanking the entry and the rear corners
    const hedges = [
      { x: 0, z: -5.0, w: 4.4, rot: false, kind: 'hedge' },
      { x: 5.0, z: -0.6, w: 3.6, rot: true, kind: 'hedge' },
      { x: -5.0, z: -0.6, w: 3.6, rot: true, kind: 'hedge' },
      { x: 3.5, z: 3.8, w: 1.5, rot: false, kind: 'flower', fc: 0 },
      { x: -3.5, z: 3.8, w: 1.5, rot: false, kind: 'flower', fc: 2 },
      { x: 4.1, z: -3.7, w: 1.6, rot: false, kind: 'flower', fc: 1 },
      { x: -4.1, z: -3.7, w: 1.6, rot: false, kind: 'flower', fc: 3 },
    ]
    const starts = [...trees.map((t) => t.start), ...hedges.map((_, i) => 0.62 + i * 0.015)]
    return { treeData: trees, hedgeData: hedges, plantStarts: starts }
  }, [])

  // traffic — slow two-way circulation on the ring road
  const roadRef = useRef()
  const carsRef = useRef([])
  const buildPRef = useRef(0)
  const { roadPts, carData } = useMemo(() => {
    const pts = roundedRectShape(24.4, 2.9).getSpacedPoints(240)
    const rnd = mulberry32(21)
    const cars = Array.from({ length: 5 }, (_, i) => ({
      u: i / 5 + rnd() * 0.08,
      speed: 0.014 + rnd() * 0.008, // ~50–80s per lap
      dir: i % 2 === 0 ? 1 : -1,
      lane: i % 2 === 0 ? 1.018 : 0.982, // outer lane clockwise, inner counter
      mat: Math.floor(rnd() * 4),
      start: 0.7 + rnd() * 0.12,
    }))
    return { roadPts: pts, carData: cars }
  }, [])
  const roadMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#37352F',
        map: asphaltTexture(),
        roughnessMap: asphaltTexture(),
        normalMap: asphaltNormal(), // coarse aggregate catches the low sun
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.92,
        metalness: 0.02,
        transparent: true,
        opacity: 0,
      }),
    []
  )
  // curbs, street lights, entry walk, amenities — the public realm
  const curbMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#B7B0A2', transparent: true, opacity: 0, depthWrite: false }),
    []
  )
  const paveMatA = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#E5DFD2',
        map: paverTexture(2, 2),
        roughness: 0.9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  )
  const paveMatB = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#E5DFD2',
        map: paverTexture(2, 9),
        roughness: 0.9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  )
  const stripeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#EFE9DC', transparent: true, opacity: 0, depthWrite: false }),
    []
  )
  const poolMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#8FA6A8',
        roughness: 0.04,
        metalness: 0.1,
        envMapIntensity: 2.2,
      }),
    []
  )
  const benchMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#B7A380', roughness: 0.4, metalness: 0.5, envMapIntensity: 1 }),
    []
  )
  const lampMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3F3A33',
        roughness: 0.4,
        metalness: 0.6,
        emissive: new THREE.Color('#FFD9A0'),
        emissiveIntensity: 0,
      }),
    []
  )
  const lightsRef = useRef()
  const curbRef = useRef()
  const pathRef = useRef()
  const amenityRef = useRef()
  const parkRef = useRef()
  const groundsRef = useRef()
  const civRefs = useRef([])
  const lightPosts = useMemo(() => {
    const pts = roundedRectShape(24.4, 2.9).getSpacedPoints(240)
    const n = pts.length - 1
    return Array.from({ length: 8 }, (_, i) => {
      const p0 = pts[Math.floor(((i + 0.5) / 8) * n)]
      return { x: p0.x * 1.075, z: -p0.y * 1.075 }
    })
  }, [])
  const featureCanRef = useRef()
  const rugMats = useMemo(() => {
    const tex = rugTexture()
    // emerald · sage · deep slate-blue · champagne (rust retired)
    return ['#3A5A4E', '#7E8868', '#46566A', '#C2A878'].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, map: tex, roughness: 0.95 })
    )
  }, [])
  // joinery / casegoods — smoked charcoal oak, not orange-brown timber
  const woodMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3E3A35', roughness: 0.5, envMapIntensity: 0.4 }),
    []
  )
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#EDE7DA',
        roughness: 0.9,
        normalMap: plasterNormal(), // troweled-plaster tooth, not flat paint
        normalScale: new THREE.Vector2(0.18, 0.18),
      }),
    []
  )
  const artMats = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => new THREE.MeshStandardMaterial({ map: artTexture(i), roughness: 0.85 })),
    []
  )
  const lampGlowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFE2B0' }), [])
  // pale limed European oak — airy, luxe, never honey-brown
  const woodFloorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#C8BCA8',
        map: plankTexture(),
        normalMap: plankNormal(), // board seams + grain you can feel
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.55,
        envMapIntensity: 0.3,
      }),
    []
  )
  // polished marble — low roughness gives a soft reflective sheen
  const stoneFloorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#E2DCD0',
        map: paverTexture(3, 6),
        normalMap: tileNormal(3, 6), // recessed slab joints
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.42,
        envMapIntensity: 0.6,
      }),
    []
  )
  // honed white statement marble for kitchen / bar tops
  const marbleTopMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#EFEBE3', roughness: 0.16, metalness: 0.0, envMapIntensity: 1.1 }),
    []
  )
  // a spread of book-spine colours — shelves read as a real, lived-in library
  const bookMats = useMemo(
    () =>
      ['#6E3B42', '#2E4A5A', '#3A5A4E', '#C2A878', '#5F6B5A', '#2C2A26', '#A07C84', '#EDE8DC', '#27545A'].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72 })
      ),
    []
  )
  const curtainMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#E9E2D2', roughness: 0.9, transparent: true, opacity: 0.92 }),
    []
  )
  const lightPoolMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: sparkTexture(),
        color: '#FFD9A0',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    []
  )
  // EVERY floor gets a fitted interior, and the stack is mixed-use like a
  // real tower: retail at the base, workspace above, residences up top,
  // a residents' club mid-stack. kinds: 0 bed / 1 living / 2 dining /
  // 3 retail / 4 office / 5 club lounge
  const sectionRooms = useMemo(() => {
    const rnd = mulberry32(61)
    return Array.from({ length: FLOOR_COUNT - 1 }, (_, i) => {
      const f = i + 1
      let kind
      if (f <= 2) kind = 3
      else if (f <= 5) kind = 4
      else if (f === 14) kind = 5
      else kind = f % 3
      return {
        f,
        kind,
        z: -0.25 + rnd() * 0.5, // gentle drift only — the unit fills the plate
        rot: 0,
        c: Math.floor(rnd() * 4),
        rug: Math.floor(rnd() * 4),
        art: Math.floor(rnd() * 3),
        couple: rnd() > 0.55,
        pet: kind <= 2 && rnd() > 0.78,
      }
    })
  }, [])

  // the section plane clips the architecture + landscape (not vehicles,
  // site machinery, or periphery lighting)
  useEffect(() => {
    const clipped = [
      ...solidMats,
      ...glassMats,
      ...intMats,
      ...mullMats,
      ...balMats,
      ...railMats,
      ...edgeMats,
      ...figMats,
      ...signatureMats,
      ...bookMats,
      marbleTopMat,
      // a figure's head/hair/hat must slice WITH its body, or the section
      // plane shears the body away and leaves the head floating in mid-air
      skinMat,
      ...hairMats,
      hatMat,
      ...gardenMats.foliage,
      gardenMats.trunk,
      gardenMats.hedge,
      roofMat,
      crownMat,
      podiumMat,
      base.foundation,
      doorMat,
      benchMat,
      poolMat,
      paveMatA,
      paveMatB,
      // interior + roof-deck finishes must slice WITH the structure —
      // anything missing here floats over the cut like loose plywood
      woodMat,
      woodFloorMat,
      stoneFloorMat,
      wallMat,
      fenceMat,
      ...rugMats,
      ...artMats,
      curtainMat,
      mirrorMat,
      lampGlowMat,
      lightPoolMat,
    ]
    for (const m of clipped) {
      m.clippingPlanes = [sectionPlane]
      m.needsUpdate = true
    }
    // all materials are stable memos — assign once on mount. (A deps array
    // here would evaluate identifiers declared later in the component and
    // crash with a temporal-dead-zone ReferenceError.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const civData = useMemo(
    () => [
      { walk: true, cx: 0.5, cz: 8.0, y: 0, r: 1.1, w: 0.18, ph: 1.0, c: 2 },
      { walk: false, x: -3.1, z: 5.3, y: 0.1, rot: 2.4, ph: 2.2, c: 3 },
      { walk: false, x: 1.15, z: 6.7, y: 0, rot: -1.4, ph: 0.6, c: 1 },
    ],
    []
  )
  const carMats = useMemo(
    () =>
      ['#EDE8DC', '#3F3D37', '#B7A380', '#7E8487'].map(
        (c) =>
          new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3, envMapIntensity: 0.8 })
      ),
    []
  )
  const carCabinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2A2A26', roughness: 0.2, metalness: 0.4 }),
    []
  )
  // headlights/taillights — switch on with dusk in useFrame
  const headLightMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FFF4D8', transparent: true, opacity: 0.15 }),
    []
  )
  const tailLightMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FF5A40', transparent: true, opacity: 0.1 }),
    []
  )
  // dashed centerline merged into a single mesh along the road path
  const dashGeo = useMemo(() => {
    const parts = []
    const n = roadPts.length - 1
    for (let i = 0; i < n; i += 6) {
      const p0 = roadPts[i]
      const p1 = roadPts[(i + 1) % n]
      const ang = Math.atan2(p1.x - p0.x, -(p1.y - p0.y))
      const g = new THREE.BoxGeometry(0.045, 0.006, 0.5)
      g.rotateY(ang)
      g.translate(p0.x, 0.018, -p0.y)
      parts.push(g)
    }
    return mergeGeometries(parts)
  }, [roadPts])
  const dashMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#D8D2C2', transparent: true, opacity: 0, depthWrite: false }),
    []
  )

  // tower crane — brass steel, fades with the build window
  const craneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#A8946C',
        roughness: 0.5,
        metalness: 0.45,
        envMapIntensity: 0.8,
        transparent: true,
        opacity: 0,
      }),
    []
  )
  const craneRef = useRef()
  const craneMastRef = useRef()
  const craneTopRef = useRef()
  const craneCableRef = useRef()
  const craneHookRef = useRef()

  // the rest of the construction site
  const crane2Ref = useRef()
  const crane2MastRef = useRef()
  const crane2TopRef = useRef()
  const crane2CableRef = useRef()
  const crane2HookRef = useRef()
  const screenRef = useRef()
  const hoistRef = useRef()
  const hoistMastRef = useRef()
  const hoistCageRef = useRef()
  const hoistHRef = useRef(3)
  const siteRef = useRef()
  const palletRefs = useRef([])
  const fenceRef = useRef()
  const siteGateRef = useRef(1)
  const screenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#EFE9DC',
        roughness: 0.9,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  )
  const fenceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#F1ECE2', roughness: 0.85 }),
    []
  )
  const palletMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#C8C0B0', roughness: 0.9 }),
    []
  )
  // open-lattice crane members
  const latticeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#A8946C',
        map: latticeTexture(),
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        metalness: 0.45,
        roughness: 0.5,
      }),
    []
  )
  // hi-vis site crew
  const hiVisMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#E8762C', roughness: 0.8 }),
    []
  )
  const hatMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.6 }),
    []
  )
  const workBeaconMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FF8A3C', transparent: true, opacity: 0.8 }),
    []
  )
  const dirtMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: dirtTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  )
  const flashTex = useMemo(() => sparkTexture(), [])
  const flashMats = useMemo(
    () =>
      Array.from({ length: 3 }, () =>
        new THREE.SpriteMaterial({
          map: flashTex,
          color: '#FFD9A0',
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      ),
    [flashTex]
  )

  const workersRef = useRef([])
  const flashRefs = useRef([])
  const drumRef = useRef()
  const truckRef = useRef()
  const dirtRef = useRef()
  const trolleyRef = useRef()
  const trolley2Ref = useRef()
  const workerData = useMemo(() => {
    const rnd = mulberry32(41)
    const ground = [
      { cx: 6.6, cz: 0.6, y: 0, r: 0.8 },
      { cx: 5.4, cz: -4.6, y: 0, r: 0.7 },
      { cx: 0.5, cz: 5.0, y: 0.1, r: 0.9 },
      { cx: -4.6, cz: 3.4, y: 0, r: 0.75 },
      { cx: -6.4, cz: -1.8, y: 0, r: 0.85 },
    ].map((g) => ({ ...g, edge: false, w: 0.25 + rnd() * 0.2, ph: rnd() * Math.PI * 2 }))
    const edgeCrew = Array.from({ length: 4 }, (_, i) => ({
      edge: true,
      r: 2.2 + rnd() * 0.45,
      w: (0.12 + rnd() * 0.1) * (i % 2 ? 1 : -1),
      ph: (i / 4) * Math.PI * 2 + rnd(),
    }))
    return [...ground, ...edgeCrew]
  }, [])
  const truckData = useMemo(() => ({ u: 0.3, speed: 0.011, lane: 1.018 }), [])

  // birds — warm doves, not crows: pale bodies, lighter underwings
  const birdMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#B7AFA0',
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
    []
  )
  const wingMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#D5CEC0',
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    []
  )
  const birdsRef = useRef([])
  const birdData = useMemo(() => {
    const rnd = mulberry32(33)
    return Array.from({ length: 7 }, (_, i) => ({
      phase: (i / 7) * Math.PI * 2 + rnd(),
      r: 4.5 + rnd() * 2.8,
      h: 0.74 + rnd() * 0.22,
      speed: 0.12 + rnd() * 0.09,
      flap: 6 + rnd() * 4,
    }))
  }, [])

  const { reducedMotion } = useNarrative() ?? {}
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime

    // window lights: switch on floor-by-floor in random order as dusk
    // arrives, then live — individual floors slowly brighten and dim
    for (let i = 0; i < FLOOR_COUNT; i++) {
      const gz = glazedRef.current[i]
      if (gz <= 0.001) {
        glassMats[i].emissiveIntensity = 0
        continue
      }
      const thresh = (litRand[i] - 0.35) / 0.9
      const on = THREE.MathUtils.smoothstep((glow.current * 1.7 - thresh) / 0.35, 0, 1)
      const life = reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(t * 0.25 + i * 2.61)
      glassMats[i].emissiveIntensity =
        i === 0
          ? gz * Math.max(glow.current * 1.3, 0.12) // the lobby is always lit
          : gz * on * (0.25 + litRand[i] * 0.45) * life
    }

    // crown + base light strips warm up with dusk on the finished tower
    crownMat.opacity =
      clamp((buildPRef.current - 0.97) / 0.03, 0, 1) * (glow.current / 0.55) * 0.85
    baseGlowMat.opacity =
      clamp((buildPRef.current * 24.6 - 1.2) / 0.8, 0, 1) * (glow.current / 0.55) * 0.6

    // residents shift their weight as they take in the view
    if (!reducedMotion) {
      for (let i = 0; i < FLOOR_COUNT; i++) {
        const fl = floorsRef.current[i]
        if (!fl || !fl.visible) continue
        const tg = trayGroupsRef.current[i]
        if (!tg) continue
        for (let c = 4; c < tg.children.length; c++) {
          const m = tg.children[c]
          if (!m.userData.person) continue
          // slow turn of the shoulders + barely-there weight shift
          m.rotation.y = m.userData.baseRot + Math.sin(t * 0.16 + m.userData.ph) * 0.15
          m.rotation.z = Math.sin(t * 0.5 + m.userData.ph * 2) * 0.018
        }
      }
    }

    // aviation beacon — blinks once the tower stands, only at dusk
    if (beaconRef.current) {
      const dusk = glow.current / 0.55
      const blink = reducedMotion ? 0.8 : Math.sin(t * 2.4) > 0.45 ? 1 : 0.12
      beaconMat.opacity = clamp((buildPRef.current - 0.97) / 0.03, 0, 1) * dusk * blink
    }

    // crane ambient: jib slewing slowly, hook breathing on its cable
    if (craneTopRef.current && craneRef.current?.visible) {
      craneTopRef.current.rotation.y = reducedMotion ? -0.6 : -0.6 + Math.sin(t * 0.1) * 0.55
      const len = 2.4 + (reducedMotion ? 0 : Math.sin(t * 0.07) * 1.1)
      if (craneCableRef.current) craneCableRef.current.scale.y = len
      if (craneHookRef.current) craneHookRef.current.position.y = -len
    }

    const bp = buildPRef.current
    const edgeF = Math.min(bp * (FLOOR_COUNT - 1 + BUILD_SPREAD), FLOOR_COUNT)

    // site crew: ground workers patrol their stations; the edge crew rides
    // the highest poured slab as it climbs
    {
      const sg = siteGateRef.current
      const gGate =
        Math.min(clamp((bp - 0.05) / 0.06, 0, 1), 1 - clamp((bp - 0.8) / 0.08, 0, 1)) * sg
      const eGate =
        Math.min(clamp((bp - 0.14) / 0.06, 0, 1), 1 - clamp((bp - 0.88) / 0.05, 0, 1)) * sg
      for (let i = 0; i < workerData.length; i++) {
        const wk = workersRef.current[i]
        if (!wk) continue
        const w = workerData[i]
        const k = w.edge ? eGate : gGate
        wk.visible = k > 0.004
        if (!wk.visible) continue
        wk.scale.setScalar(Math.max(0.001, easeOutBack(k) * 0.92))
        const ang = w.ph + (reducedMotion ? 0 : t * w.w)
        if (w.edge) {
          const y = Math.max(SLAB_T, (edgeF - 1.05) * FLOOR_HEIGHT)
          wk.position.set(Math.cos(ang) * w.r, y, Math.sin(ang) * w.r)
        } else {
          wk.position.set(w.cx + Math.cos(ang) * w.r, w.y, w.cz + Math.sin(ang) * w.r)
        }
        wk.rotation.y = -ang
      }
    }

    // welding flashes spark intermittently at the build edge
    {
      const gate = reducedMotion
        ? 0
        : Math.min(clamp((bp - 0.15) / 0.05, 0, 1), 1 - clamp((bp - 0.88) / 0.05, 0, 1)) *
          siteGateRef.current
      for (let i = 0; i < flashRefs.current.length; i++) {
        const f = flashRefs.current[i]
        if (!f) continue
        const ph = i * 2.4 + 1
        const burst = Math.max(0, Math.sin(t * 8.5 + ph * 7) * Math.sin(t * 1.45 + ph * 3) - 0.55) * 2.8
        flashMats[i].opacity = burst * gate
        f.visible = flashMats[i].opacity > 0.01
        if (f.visible) {
          const a = ph + t * 0.04
          f.position.set(
            Math.cos(a) * 2.9,
            Math.max(SLAB_T, (edgeF - 0.6) * FLOOR_HEIGHT),
            Math.sin(a) * 2.9
          )
        }
      }
    }

    // crane trolleys travel in and out along the jibs
    if (!reducedMotion) {
      if (trolleyRef.current) trolleyRef.current.position.x = 3.0 + (Math.sin(t * 0.07) * 0.5 + 0.5) * 1.8
      if (trolley2Ref.current) trolley2Ref.current.position.x = 2.8 + (Math.sin(t * 0.085 + 2) * 0.5 + 0.5) * 1.6
    }

    // mixer drum churns while the site is live
    if (drumRef.current && !reducedMotion) drumRef.current.rotation.z += dt * 1.3

    // work beacons blink on both cranes
    workBeaconMat.opacity = reducedMotion ? 0.6 : Math.sin(t * 3.1) > 0.35 ? 0.95 : 0.12

    // street lamps + vehicle lights warm up with dusk
    lampMat.emissiveIntensity = (glow.current / 0.55) * 1.5
    {
      const dusk = glow.current / 0.55
      headLightMat.opacity = 0.15 + dusk * 0.85
      tailLightMat.opacity = 0.1 + dusk * 0.85
    }

    // breeze through the canopies
    if (!reducedMotion) {
      for (let i = 0; i < treeData.length; i++) {
        const pl = plantsRef.current[i]
        if (!pl || !pl.visible) continue
        const can = pl.children[1]
        can.rotation.z = Math.sin(t * 0.45 + i * 1.7) * 0.03
        can.rotation.x = Math.cos(t * 0.37 + i * 0.9) * 0.022
      }
      if (featureCanRef.current && amenityRef.current?.visible) {
        featureCanRef.current.rotation.z = Math.sin(t * 0.4 + 0.5) * 0.025
        featureCanRef.current.rotation.x = Math.cos(t * 0.31) * 0.02
      }
    }

    // civilians arrive once the residence is handed over
    {
      const cGate = clamp((bp - 0.86) / 0.06, 0, 1)
      for (let i = 0; i < civData.length; i++) {
        const cv = civRefs.current[i]
        if (!cv) continue
        const d = civData[i]
        cv.visible = cGate > 0.004
        if (!cv.visible) continue
        cv.scale.setScalar(Math.max(0.001, easeOutBack(cGate) * 0.92))
        if (d.walk) {
          const ang = d.ph + (reducedMotion ? 0 : t * d.w)
          cv.position.set(d.cx + Math.cos(ang) * d.r, d.y, d.cz + Math.sin(ang) * d.r)
          cv.rotation.y = -ang
        } else {
          cv.position.set(d.x, d.y, d.z)
          cv.rotation.y = d.rot + (reducedMotion ? 0 : Math.sin(t * 0.2 + d.ph) * 0.15)
        }
      }
    }

    // delivery flatbed circulates only while the site is live
    if (truckRef.current) {
      const k =
        Math.min(clamp((bp - 0.08) / 0.06, 0, 1), 1 - clamp((bp - 0.8) / 0.08, 0, 1)) *
        siteGateRef.current
      truckRef.current.visible = k > 0.004
      if (truckRef.current.visible) {
        truckRef.current.scale.setScalar(Math.max(0.001, easeOutBack(k)))
        if (!reducedMotion) truckData.u = (truckData.u + dt * truckData.speed + 1) % 1
        const n = roadPts.length - 1
        const f = truckData.u * n
        const i0 = Math.floor(f) % n
        const i1 = (i0 + 1) % n
        const a = f - Math.floor(f)
        const px = (roadPts[i0].x + (roadPts[i1].x - roadPts[i0].x) * a) * truckData.lane
        const pz = -(roadPts[i0].y + (roadPts[i1].y - roadPts[i0].y) * a) * truckData.lane
        truckRef.current.position.set(px, 0.015, pz)
        truckRef.current.rotation.y = Math.atan2(
          roadPts[i1].x - roadPts[i0].x,
          -(roadPts[i1].y - roadPts[i0].y)
        )
      }
    }

    // second crane slews on its own rhythm
    if (crane2TopRef.current && crane2Ref.current?.visible) {
      crane2TopRef.current.rotation.y = 2.2 + (reducedMotion ? 0 : Math.sin(t * 0.13 + 1.7) * 0.5)
      const len2 = 2.0 + (reducedMotion ? 0 : Math.sin(t * 0.09 + 0.8) * 1.0)
      if (crane2CableRef.current) crane2CableRef.current.scale.y = len2
      if (crane2HookRef.current) crane2HookRef.current.position.y = -len2
    }

    // hoist cage shuttles between the ground and the build edge
    if (hoistCageRef.current && hoistRef.current?.visible) {
      const hh = hoistHRef.current
      const sh = reducedMotion ? 0.5 : (Math.sin(t * 0.35) + 1) / 2
      hoistCageRef.current.position.y = 0.45 + sh * Math.max(0.5, hh - 1.2)
    }

    // birds circle the tower once it tops out
    const birdK = clamp((buildPRef.current - 0.96) / 0.04, 0, 1)
    for (let i = 0; i < birdData.length; i++) {
      const bird = birdsRef.current[i]
      if (!bird) continue
      bird.visible = birdK > 0.001
      if (!bird.visible) continue
      bird.scale.setScalar(Math.max(0.001, birdK))
      const b = birdData[i]
      const ang = b.phase + (reducedMotion ? 0 : t * b.speed)
      bird.position.set(
        Math.cos(ang) * b.r,
        BUILDING_HEIGHT * b.h + Math.sin(t * 1.3 + b.phase) * 0.4,
        Math.sin(ang) * b.r
      )
      bird.rotation.y = -ang
      if (!reducedMotion) {
        // glide-flap-glide: wings beat in bursts, then hold a dihedral
        const cycle = 0.5 + 0.5 * Math.sin(t * 0.37 + b.phase * 3)
        const amp = clamp((cycle - 0.3) / 0.4, 0, 1)
        const flap = Math.sin(t * b.flap + b.phase) * 0.55 * amp + (1 - amp) * 0.14
        bird.children[0].rotation.z = flap
        bird.children[1].rotation.z = -flap
      }
    }

    const n = roadPts.length - 1 // last point closes the loop
    for (let i = 0; i < carData.length; i++) {
      const car = carsRef.current[i]
      if (!car) continue
      const c = carData[i]
      const k = clamp((buildPRef.current - c.start) / 0.12, 0, 1)
      car.visible = k > 0.001
      if (!car.visible) continue
      car.scale.setScalar(Math.max(0.001, easeOutBack(k)))
      if (!reducedMotion) c.u = (c.u + dt * c.speed * c.dir + 1) % 1
      const f = c.u * n
      const i0 = Math.floor(f) % n
      const i1 = (i0 + 1) % n
      const a = f - Math.floor(f)
      const px = (roadPts[i0].x + (roadPts[i1].x - roadPts[i0].x) * a) * c.lane
      const pz = -(roadPts[i0].y + (roadPts[i1].y - roadPts[i0].y) * a) * c.lane
      car.position.set(px, 0.015, pz)
      const dx = (roadPts[i1].x - roadPts[i0].x) * c.dir
      const dz = -(roadPts[i1].y - roadPts[i0].y) * c.dir
      car.rotation.y = Math.atan2(dx, dz)
    }
  })

  useImperativeHandle(ref, () => ({
    group: groupRef,

    // `site` (0/1): whether the construction site is narratively active.
    // Act IX runs build progress backwards as a clean dissolve — the
    // cranes and site must NOT re-mobilize there. The handoff is always
    // safe because acts IV-VIII hold p=1, where every site gate is 0.
    setBuildProgress(p, site = 1) {
      buildPRef.current = p
      siteGateRef.current = site
      // soft build edge: each floor's assembly overlaps the next, so the
      // rise reads as one continuous wave instead of floor-by-floor pops
      const edge = p * (FLOOR_COUNT - 1 + BUILD_SPREAD)
      for (let i = 0; i < FLOOR_COUNT; i++) {
        const g = floorsRef.current[i]
        if (!g) continue
        const local = clamp((edge - i) / BUILD_SPREAD, 0, 1)
        const visible = local > 0.001
        g.visible = visible
        if (!visible) {
          glassMats[i].opacity = 0
          intMats[i].opacity = 0
          mullMats[i].opacity = 0
          balMats[i].opacity = 0
          railMats[i].opacity = 0
          continue
        }
        // 1 — core + tray extrude
        const rise = easeOutCubic(Math.min(1, local / 0.4))
        g.scale.y = Math.max(0.001, rise)
        solidMats[i].opacity = Math.min(1, local / 0.18)
        // 2 — glazing chases the build edge
        const glazed = clamp((local - 0.4) / 0.3, 0, 1)
        glassMats[i].opacity = glazed * glassOp.current
        // interiors hollow out as the section opens, revealing the rooms
        intMats[i].opacity = glazed * (1 - sectionCur.current * 0.93)
        mullMats[i].opacity = glazed
        // 3 — balcony tray cantilevers outward, overshoots, settles
        const ext = clamp((local - 0.55) / 0.35, 0, 1)
        const ts = 0.86 + 0.14 * easeOutBack(ext)
        const tg = trayGroupsRef.current[i]
        if (tg) {
          const w = TRAY_WAVE[i]
          tg.scale.set(ts * w.s, 1, ts * w.s)
          // craned into place: the tray drifts in from the crane's side,
          // settling onto its own ripple offset
          const place = 1 - easeOutCubic(Math.min(1, local / 0.5))
          tg.position.x = place * 1.4 + w.ox
          tg.position.z = place * -0.55 + w.oz
          tg.rotation.y = place * 0.12
          // a hair of vertical sag at the overshoot peak sells the weight
          tg.position.y = -Math.max(0, easeOutBack(ext) - 1) * 0.12
          // residents step out once the railing has landed
          const figS = clamp((local - 0.88) / 0.12, 0, 1)
          for (let c = 4; c < tg.children.length; c++) {
            const m = tg.children[c]
            m.scale.setScalar(Math.max(0.001, easeOutBack(figS) * (m.userData.s || 1)))
          }
        }
        // 4 — balustrade glass, then the champagne rail cap
        balMats[i].opacity = clamp((local - 0.7) / 0.3, 0, 1) * 0.3
        railMats[i].opacity = clamp((local - 0.82) / 0.18, 0, 1) * 0.95
        // construction outline burns down to a permanent etched edge line —
        // the milled precision detail on every finished tray
        edgeMats[i].opacity =
          local < 0.4
            ? 0.9 * Math.min(1, local / 0.08)
            : Math.max(0.22, 0.9 * clamp(1 - (local - 0.4) / 0.3, 0, 1))
        // build edge glow (window light is animated per-frame in useFrame)
        solidMats[i].emissiveIntensity = local * (1 - local) * 2.2
        glazedRef.current[i] = glazed
      }
      // topping-out shimmer — a light wave runs up the slabs as the build
      // completes (and back down again on deconstruction)
      const wave = clamp((p - 0.955) / 0.045, 0, 1)
      if (wave > 0 && wave < 1) {
        const wpos = wave * (FLOOR_COUNT + 6) - 3
        for (let i = 0; i < FLOOR_COUNT; i++) {
          const amp = Math.max(0, 1 - Math.abs(i - wpos) / 3)
          solidMats[i].emissiveIntensity = Math.max(solidMats[i].emissiveIntensity, amp * 0.85)
        }
      }
      // rooftop amenity deck arrives at the very top-out
      const roofLocal = clamp((p - 0.94) / 0.06, 0, 1)
      const r = roofRef.current
      if (r) {
        r.visible = roofLocal > 0.001
        r.scale.y = Math.max(0.001, easeOutCubic(roofLocal))
        roofMat.opacity = roofLocal
      }
      // grounding shadow deepens and spreads as the tower rises
      if (shadowRef.current) {
        const sk = clamp(p * 4, 0, 1)
        shadowMat.opacity = sk * 0.4
        shadowRef.current.visible = sk > 0.004
        const ss = 0.7 + 0.3 * p
        shadowRef.current.scale.set(ss, ss, 1)
      }

      // the crane rises ahead of the floors and leaves before completion
      const crane = craneRef.current
      if (crane) {
        const kIn = clamp((p - 0.04) / 0.07, 0, 1)
        const kOut = 1 - clamp((p - 0.86) / 0.09, 0, 1)
        const cs = Math.min(easeOutBack(kIn), kOut) * site
        crane.visible = cs > 0.002
        if (crane.visible) {
          crane.scale.setScalar(Math.max(0.001, cs))
          craneMat.opacity = Math.min(1, cs * 1.4)
          const mastH = clamp(p * BUILDING_HEIGHT + 4.2, 7, BUILDING_HEIGHT + 4.6)
          if (craneMastRef.current) craneMastRef.current.scale.y = mastH
          if (craneTopRef.current) craneTopRef.current.position.y = mastH
        }
      }
      // second crane works the lower floors, dismantled once the tower
      // outgrows it — the way real twin-crane sites actually sequence
      const c2 = crane2Ref.current
      if (c2) {
        const kIn = clamp((p - 0.06) / 0.07, 0, 1)
        const kOut = 1 - clamp((p - 0.7) / 0.09, 0, 1)
        const cs = Math.min(easeOutBack(kIn), kOut) * site
        c2.visible = cs > 0.002
        if (c2.visible) {
          c2.scale.setScalar(Math.max(0.001, cs))
          const mastH = clamp(p * BUILDING_HEIGHT * 0.85 + 3.4, 6, BUILDING_HEIGHT * 0.75)
          if (crane2MastRef.current) crane2MastRef.current.scale.y = mastH
          if (crane2TopRef.current) crane2TopRef.current.position.y = mastH
        }
      }

      // climbing screen rides the build edge, matching the crown setbacks
      const scr = screenRef.current
      if (scr) {
        const k = Math.min(clamp((p - 0.1) / 0.06, 0, 1), 1 - clamp((p - 0.92) / 0.05, 0, 1)) * site
        scr.visible = k > 0.004
        if (scr.visible) {
          screenMat.opacity = k * 0.5
          const fl = Math.min(edge, FLOOR_COUNT)
          scr.position.y = clamp(fl - 1.3, 0.2, FLOOR_COUNT - 1.5) * FLOOR_HEIGHT
          const i0 = Math.floor(clamp(fl, 0, FLOOR_COUNT - 1))
          const s = THREE.MathUtils.lerp(
            setbackOf(i0),
            setbackOf(Math.min(i0 + 1, FLOOR_COUNT - 1)),
            fl - i0
          )
          scr.scale.set(s, 1, s)
        }
      }

      // facade hoist — rises with the structure, gone before handover
      const ho = hoistRef.current
      if (ho) {
        const k =
          Math.min(easeOutBack(clamp((p - 0.1) / 0.06, 0, 1)), 1 - clamp((p - 0.8) / 0.08, 0, 1)) *
          site
        ho.visible = k > 0.002
        if (ho.visible) {
          ho.scale.setScalar(Math.max(0.001, k))
          const hh = clamp(p * BUILDING_HEIGHT + 1.5, 3, BUILDING_HEIGHT + 1.2)
          hoistHRef.current = hh
          if (hoistMastRef.current) hoistMastRef.current.scale.y = hh
        }
      }

      // site cabins + laydown stacks that deplete as the floors consume them
      const st = siteRef.current
      if (st) {
        const k =
          Math.min(easeOutBack(clamp((p - 0.05) / 0.06, 0, 1)), 1 - clamp((p - 0.78) / 0.08, 0, 1)) *
          site
        st.visible = k > 0.002
        if (st.visible) {
          st.scale.setScalar(Math.max(0.001, k))
          for (const pal of palletRefs.current) {
            if (pal) pal.scale.y = Math.max(0.12, 1 - p * 1.1)
          }
        }
      }

      // hoarding fence — comes down exactly when the gardens go in
      const fc = fenceRef.current
      if (fc) {
        const k = Math.min(clamp((p - 0.045) / 0.05, 0, 1), 1 - clamp((p - 0.58) / 0.07, 0, 1)) * site
        fc.visible = k > 0.004
        fc.scale.y = Math.max(0.001, easeOutBack(k))
      }

      // work dirt under the site — swept clean at handover
      if (dirtRef.current) {
        const k = Math.min(clamp((p - 0.04) / 0.06, 0, 1), 1 - clamp((p - 0.7) / 0.12, 0, 1)) * site
        dirtMat.opacity = k * 0.55
        dirtRef.current.visible = k > 0.004
      }

      // public realm: walk + crosswalk pave in with the landscaping,
      // then the amenities and residents' cars arrive at handover
      const pathK = clamp((p - 0.62) / 0.08, 0, 1)
      paveMatA.opacity = pathK * 0.95
      paveMatB.opacity = pathK * 0.95
      stripeMat.opacity = pathK * 0.55
      if (pathRef.current) pathRef.current.visible = pathK > 0.004
      if (amenityRef.current) {
        const k = easeOutBack(clamp((p - 0.74) / 0.08, 0, 1))
        amenityRef.current.visible = k > 0.002
        amenityRef.current.scale.setScalar(Math.max(0.001, k))
      }
      if (parkRef.current) {
        const k = easeOutBack(clamp((p - 0.84) / 0.06, 0, 1))
        parkRef.current.visible = k > 0.002
        parkRef.current.scale.setScalar(Math.max(0.001, k))
      }
      // the landscaped grounds lay in with the public realm (and lift on teardown)
      if (groundsRef.current) {
        const k = easeOutCubic(clamp((p - 0.6) / 0.1, 0, 1))
        groundsRef.current.visible = k > 0.002
        groundsRef.current.scale.setScalar(Math.max(0.001, k))
      }

      // landscaping grows in last (and leaves first on deconstruction):
      // trunk rises first, then the canopy unfurls with a soft settle
      const nTrees = treeData.length
      for (let i = 0; i < plantsRef.current.length; i++) {
        const pl = plantsRef.current[i]
        if (!pl) continue
        const k = clamp((p - plantStarts[i]) / 0.18, 0, 1)
        pl.visible = k > 0.001
        if (!pl.visible) continue
        if (i < nTrees) {
          const t = treeData[i]
          const trunkK = easeOutCubic(Math.min(1, k / 0.45))
          const canopyK = Math.max(0.001, easeOutBack(clamp((k - 0.35) / 0.65, 0, 1)))
          const wood = pl.children[0]
          const canopy = pl.children[1]
          wood.scale.y = Math.max(0.001, trunkK)
          canopy.position.y = Math.max(0.01, t.h * trunkK)
          canopy.scale.setScalar(canopyK)
        } else {
          pl.scale.y = Math.max(0.001, easeOutBack(k))
        }
      }
    },

    // k 0-1: how far the section cut has advanced (damped for silkiness)
    setSection(k, dt) {
      sectionCur.current = THREE.MathUtils.damp(sectionCur.current, k, 3, dt)
      const s = sectionCur.current
      sectionPlane.constant = THREE.MathUtils.lerp(16, 0, s)
      if (sectionFurnRef.current) {
        sectionFurnRef.current.visible = s > 0.15
        const fs = clamp((s - 0.15) / 0.3, 0, 1)
        sectionFurnRef.current.scale.setScalar(Math.max(0.001, easeOutCubic(fs)))
      }
    },

    setFoundationDepth(d) {
      const f = foundationRef.current
      if (!f) return
      const k = clamp(d / 4, 0, 1)
      f.visible = k > 0.001
      f.scale.y = Math.max(0.001, k)
      f.position.y = -2 * k
      podiumMat.opacity = k
      if (podiumRef.current) podiumRef.current.visible = k > 0.001
      // site infrastructure arrives with the groundwork
      roadMat.opacity = k * 0.9
      if (roadRef.current) roadRef.current.visible = k > 0.001
      curbMat.opacity = k * 0.5
      dashMat.opacity = k * 0.45
      if (curbRef.current) curbRef.current.visible = k > 0.001
      if (lightsRef.current) {
        lightsRef.current.visible = k > 0.001
        lightsRef.current.scale.y = Math.max(0.001, k)
      }
    },

    setColorMode(lineColor, structColor, dark, dt) {
      const lc = tmpColorA.set(lineColor)
      const sc = tmpColorB.set(structColor)
      // daylight interiors are warm shadow, not pitch black — the facade
      // must read bone-and-bronze by day, lit-from-within at dusk
      const ic = tmpColorC.set(dark ? '#26231E' : '#4A4338')
      const t = Math.min(1, dt * 4)
      for (let i = 0; i < FLOOR_COUNT; i++) {
        edgeMats[i].color.lerp(lc, t)
        tmpColorE.copy(sc).multiplyScalar(trayTint[i])
        solidMats[i].color.lerp(tmpColorE, t)
        // rooms brighten as the section opens them to daylight
        tmpColorD.copy(ic).multiplyScalar(intTint[i] * (1 + sectionCur.current * 0.9))
        intMats[i].color.lerp(tmpColorD, t)
      }
      roofMat.color.lerp(sc, t)
      podiumMat.color.lerp(sc, t)
      glow.current = THREE.MathUtils.damp(glow.current, dark ? 0.55 : 0, 3, dt)
      glassOp.current = THREE.MathUtils.damp(glassOp.current, dark ? 0.62 : 0.4, 3, dt)
    },
  }))

  const glassY = SLAB_T + (FLOOR_HEIGHT - SLAB_T) / 2

  return (
    <group ref={groupRef}>
      <mesh ref={foundationRef} geometry={geo.foundation} material={base.foundation} visible={false} />
      <mesh
        ref={shadowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
        material={shadowMat}
        visible={false}
      >
        <planeGeometry args={[22, 22]} />
      </mesh>

      {/* architectural base light — a warm line under the first tray */}
      <mesh geometry={geo.ring} material={baseGlowMat} position={[0, FLOOR_HEIGHT - 0.06, 0]} scale={[1.005, 0.12, 1.005]} />

      {/* stepped plinth — the tower meets the ground with a gesture */}
      <group ref={podiumRef} visible={false}>
        <mesh geometry={geo.podiumLower} material={podiumMat} position={[0, 0.05, 0]} receiveShadow />
        <mesh geometry={geo.podium} material={podiumMat} position={[0, 0.16, 0]} castShadow receiveShadow />
        {/* street-level colonnade — slim bronze columns under the first tray */}
        {[-2.2, -0.75, 0.75, 2.2].map((cx) => (
          <mesh key={`col${cx}`} material={doorMat} position={[cx, 0.71, 2.98]} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.98, 12]} />
          </mesh>
        ))}
        {/* brass address plate beside the entry */}
        <mesh material={benchMat} position={[1.05, 0.95, 2.52]}>
          <boxGeometry args={[0.42, 0.12, 0.015]} />
        </mesh>
        {/* entry portico — the address moment at street level */}
        <mesh geometry={geo.portico} material={podiumMat} position={[0, 1.04, 3.4]} />
        <mesh geometry={geo.post} material={podiumMat} position={[-1.2, 0.62, 4.15]} scale={[1, 0.92, 1]} />
        <mesh geometry={geo.post} material={podiumMat} position={[1.2, 0.62, 4.15]} scale={[1, 0.92, 1]} />
        {/* bronze entry portal under the canopy — split doors + pull bars */}
        <mesh geometry={geo.doorPanel} material={doorMat} position={[0, 0.71, 2.52]} />
        <mesh geometry={geo.cable} material={fenceMat} position={[0, 0.71, 2.555]} scale={[0.8, 3.7, 1]} />
        <mesh geometry={geo.cable} material={benchMat} position={[-0.1, 0.66, 2.56]} scale={[1.2, 1.05, 1.2]} />
        <mesh geometry={geo.cable} material={benchMat} position={[0.1, 0.66, 2.56]} scale={[1.2, 1.05, 1.2]} />
      </group>

      {Array.from({ length: FLOOR_COUNT }, (_, i) => {
        const sb = setbackOf(i)
        return (
          <group
            key={i}
            ref={(el) => (floorsRef.current[i] = el)}
            position={[0, i * FLOOR_HEIGHT, 0]}
            scale={[sb, 1, sb]}
            visible={false}
          >
            {/* balcony tray + balustrade + rail (cantilevers as a unit) */}
            <group ref={(el) => (trayGroupsRef.current[i] = el)}>
              <mesh geometry={geo.tray} material={solidMats[i]} castShadow receiveShadow />
              <lineLoop geometry={geo.outline} material={edgeMats[i]} position={[0, SLAB_T, 0]} />
              <mesh geometry={geo.ring} material={balMats[i]} position={[0, SLAB_T + RAIL_H, 0]} />
              <mesh geometry={geo.ring} material={railMats[i]} position={[0, SLAB_T + RAIL_H + 0.05, 0]} scale={[1, 0.12, 1]} />
              {(figures[i] || []).map((fg, j) => (
                <group
                  key={`fg${j}`}
                  position={[fg.x, SLAB_T, fg.z]}
                  rotation={[0, fg.rot, 0]}
                  scale={0.001}
                  userData={{ s: fg.s, person: fg.person, baseRot: fg.rot, ph: fg.ph }}
                >
                  {fg.person ? (
                    renderFigure(fg.c, j)
                  ) : (
                    <>
                      <mesh geometry={geo.petBody} material={figMats[fg.c]} />
                      <mesh geometry={geo.petHead} material={figMats[fg.c]} position={[0, 0.11, 0.11]} />
                    </>
                  )}
                </group>
              ))}
              {/* privacy fins between apartments */}
              <mesh geometry={geo.fins} material={balMats[i]} position={[0, SLAB_T + 0.5, 0]} scale={0.001} userData={{ s: 1 }} />
              {/* balcony fit-out: a sun-lounger + side table on a few terraces */}
              {(decor[i] || []).map((d, j) => (
                <group key={`dc${j}`} position={[d.x, SLAB_T, d.z]} rotation={[0, d.rot, 0]} scale={0.001} userData={{ s: 1 }}>
                  <mesh geometry={geo.lounger} material={figMats[1]} position={[0, 0.045, 0]} />
                  <mesh geometry={geo.tableTop} material={figMats[0]} position={[0.3, 0.045, 0.02]} />
                </group>
              ))}
            </group>
            {/* structural core */}
            <mesh geometry={geo.core} material={solidMats[i]} position={[0, FLOOR_HEIGHT / 2, 0]} castShadow />
            {/* recessed curtain wall + dark interior + bronze mullions */}
            <mesh geometry={geo.interior} material={intMats[i]} position={[0, glassY, 0]} receiveShadow />
            <mesh geometry={geo.mullions} material={mullMats[i]} position={[0, glassY, 0]} />
            <mesh geometry={geo.glass} material={glassMats[i]} position={[0, glassY, GLASS_HALF]} />
            <mesh geometry={geo.glass} material={glassMats[i]} position={[0, glassY, -GLASS_HALF]} rotation={[0, Math.PI, 0]} />
            <mesh geometry={geo.glass} material={glassMats[i]} position={[GLASS_HALF, glassY, 0]} rotation={[0, Math.PI / 2, 0]} />
            <mesh geometry={geo.glass} material={glassMats[i]} position={[-GLASS_HALF, glassY, 0]} rotation={[0, -Math.PI / 2, 0]} />
          </group>
        )
      })}

      {/* ring road + circulating cars */}
      <mesh ref={roadRef} geometry={geo.road} material={roadMat} position={[0, 0.012, 0]} visible={false} />
      {carData.map((c, k) => (
        <group key={`car${k}`} ref={(el) => (carsRef.current[k] = el)} visible={false}>
          {/* inner group sizes the car to scale with people (the outer group's
              scale is driven per-frame for the appear animation) */}
          <group scale={CAR_SCALE}>
            <mesh geometry={geo.carBody} material={carMats[c.mat]} />
            <mesh geometry={geo.carCabin} material={carCabinMat} />
            {[[-0.1, 0.14], [0.1, 0.14], [-0.1, -0.14], [0.1, -0.14]].map(([wx, wz], wi) => (
              <mesh key={wi} geometry={geo.wheel} material={carCabinMat} position={[wx, 0.045, wz]} />
            ))}
            <mesh geometry={geo.lightDot} material={headLightMat} position={[-0.06, 0.12, 0.23]} />
            <mesh geometry={geo.lightDot} material={headLightMat} position={[0.06, 0.12, 0.23]} />
            <mesh geometry={geo.lightDot} material={tailLightMat} position={[-0.06, 0.12, -0.23]} scale={0.8} />
            <mesh geometry={geo.lightDot} material={tailLightMat} position={[0.06, 0.12, -0.23]} scale={0.8} />
          </group>
        </group>
      ))}

      {/* tower crane — rises with the build edge, slews while working */}
      <group ref={craneRef} position={[8.3, 0, -3.2]} visible={false}>
        <mesh ref={craneMastRef} geometry={geo.craneMast} material={latticeMat} />
        <group ref={craneTopRef} rotation={[0, -0.6, 0]}>
          <mesh geometry={geo.craneJib} material={latticeMat} position={[2.5, 0.08, 0]} />
          <mesh geometry={geo.craneCounter} material={latticeMat} position={[-1.15, 0.08, 0]} />
          <mesh geometry={geo.craneWeight} material={craneMat} position={[-1.9, -0.2, 0]} />
          <mesh geometry={geo.craneCab} material={craneMat} position={[0.3, -0.28, 0]} />
          <mesh geometry={geo.beacon} material={workBeaconMat} position={[0, 0.32, 0]} scale={0.7} />
          <group ref={trolleyRef} position={[4.6, 0, 0]}>
            <mesh ref={craneCableRef} geometry={geo.craneCable} material={craneMat} />
            <mesh ref={craneHookRef} geometry={geo.craneHook} material={craneMat} position={[0, -2.4, 0]}>
              <mesh geometry={geo.hookLoad} material={craneMat} position={[0, -0.17, 0]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* second crane — opposite flank, shorter, leaves early */}
      <group ref={crane2Ref} position={[-7.4, 0, 4.8]} visible={false}>
        <mesh ref={crane2MastRef} geometry={geo.craneMast} material={latticeMat} />
        <group ref={crane2TopRef} rotation={[0, 2.2, 0]}>
          <mesh geometry={geo.craneJib} material={latticeMat} position={[2.5, 0.08, 0]} />
          <mesh geometry={geo.craneCounter} material={latticeMat} position={[-1.15, 0.08, 0]} />
          <mesh geometry={geo.craneWeight} material={craneMat} position={[-1.9, -0.2, 0]} />
          <mesh geometry={geo.craneCab} material={craneMat} position={[0.3, -0.28, 0]} />
          <mesh geometry={geo.beacon} material={workBeaconMat} position={[0, 0.32, 0]} scale={0.7} />
          <group ref={trolley2Ref} position={[4.2, 0, 0]}>
            <mesh ref={crane2CableRef} geometry={geo.craneCable} material={craneMat} />
            <mesh ref={crane2HookRef} geometry={geo.craneHook} material={craneMat} position={[0, -2, 0]}>
              <mesh geometry={geo.hookLoad} material={craneMat} position={[0, -0.17, 0]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* climbing screen at the build edge */}
      <mesh ref={screenRef} geometry={geo.screen} material={screenMat} visible={false} />

      {/* facade hoist on the rear face */}
      <group ref={hoistRef} position={[0, 0, -3.85]} visible={false}>
        <mesh ref={hoistMastRef} geometry={geo.hoistMast} material={latticeMat} />
        <mesh ref={hoistCageRef} geometry={geo.hoistCage} material={craneMat} position={[0, 0.45, -0.3]} />
      </group>

      {/* site crew — hi-vis, hard hats; ground patrol + edge crew */}
      {workerData.map((w, k) => (
        <group key={`wk${k}`} ref={(el) => (workersRef.current[k] = el)} visible={false}>
          <mesh geometry={geo.figLegs} material={figMats[0]} />
          <mesh geometry={geo.figTorso} material={hiVisMat} />
          <mesh geometry={geo.figArm} material={hiVisMat} position={[-0.105, 0.37, 0]} rotation={[0, 0, 0.14]} />
          <mesh geometry={geo.figArm} material={hiVisMat} position={[0.105, 0.37, 0]} rotation={[0, 0, -0.14]} />
          <mesh geometry={geo.figHead} material={skinMat} position={[0, 0.56, 0]} />
          <mesh geometry={geo.figHead} material={hatMat} position={[0, 0.595, 0]} scale={[1.18, 0.55, 1.18]} />
        </group>
      ))}

      {/* welding flashes at the build edge */}
      {flashMats.map((m, k) => (
        <sprite key={`fl${k}`} ref={(el) => (flashRefs.current[k] = el)} material={m} scale={[0.7, 0.7, 1]} visible={false} />
      ))}

      {/* delivery flatbed — circulates while the site is live */}
      <group ref={truckRef} visible={false}>
        <mesh geometry={geo.truckBed} material={carMats[3]} />
        <mesh geometry={geo.truckCab} material={carMats[2]} position={[0, 0, 0.5]} />
        <mesh geometry={geo.crate} material={palletMat} position={[0, 0.26, -0.12]} />
        {[[-0.13, 0.45], [0.13, 0.45], [-0.13, -0.25], [0.13, -0.25]].map(([wx, wz], wi) => (
          <mesh key={wi} geometry={geo.wheel} material={carCabinMat} position={[wx, 0.045, wz]} />
        ))}
        <mesh geometry={geo.lightDot} material={headLightMat} position={[-0.08, 0.14, 0.64]} />
        <mesh geometry={geo.lightDot} material={headLightMat} position={[0.08, 0.14, 0.64]} />
      </group>

      {/* work dirt patch — swept clean at handover */}
      <mesh ref={dirtRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]} material={dirtMat} visible={false} renderOrder={2}>
        <planeGeometry args={[17, 17]} />
      </mesh>

      {/* curbs + painted edge lines + dashed centerline framing the ring road */}
      <group ref={curbRef} position={[0, 0.014, 0]} visible={false} renderOrder={2}>
        <mesh geometry={geo.curbOuter} material={curbMat} />
        <mesh geometry={geo.curbInner} material={curbMat} />
        <mesh geometry={geo.laneLine} material={dashMat} position={[0, 0.001, 0]} />
        <mesh geometry={geo.laneLine} material={dashMat} position={[0, 0.001, 0]} scale={[0.925, 1, 0.925]} />
        <mesh geometry={dashGeo} material={dashMat} />
      </group>

      {/* street lights along the ring road */}
      <group ref={lightsRef} visible={false}>
        {lightPosts.map((lp, k) => (
          <group key={`lp${k}`} position={[lp.x, 0, lp.z]}>
            <mesh geometry={geo.lampPole} material={lampMat} />
            <mesh geometry={geo.lampHead} material={lampMat} position={[0, 1.32, 0]} />
          </group>
        ))}
      </group>

      {/* entry walk: pavers on the terrace, steps, walk to the road, crosswalk */}
      <group ref={pathRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.106, 5.0]} material={paveMatA} renderOrder={3}>
          <planeGeometry args={[1.3, 1.3]} />
        </mesh>
        <mesh geometry={geo.pathStep} material={fenceMat} position={[0, 0.04, 5.78]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 8.6]} material={paveMatB} renderOrder={3}>
          <planeGeometry args={[1.3, 5.6]} />
        </mesh>
        {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
          <mesh key={`cw${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.016, 12.2]} material={stripeMat} renderOrder={3}>
            <planeGeometry args={[0.18, 1.4]} />
          </mesh>
        ))}
        {/* bollard lights pacing the walk — glow with the street lamps */}
        {[6.2, 7.6, 9.0].map((z) =>
          [-0.82, 0.82].map((x) => (
            <group key={`bl${x}${z}`} position={[x, 0, z]}>
              <mesh geometry={geo.bollard} material={lampMat} />
              <mesh geometry={geo.lightDot} material={lampGlowMat} position={[0, 0.25, 0]} scale={0.7} />
            </group>
          ))
        )}
      </group>

      {/* handover amenities: mirror pool, feature tree, benches */}
      <group ref={amenityRef} visible={false}>
        <mesh geometry={geo.poolBorder} material={fenceMat} position={[-3.4, 0.145, 4.7]} />
        <mesh geometry={geo.poolWater} material={poolMat} rotation={[-Math.PI / 2, 0, 0]} position={[-3.4, 0.195, 4.7]} />
        <group position={[2.5, 0.1, 5.3]} rotation={[0.03, 0, -0.05]}>
          <mesh geometry={geo.trunk} material={gardenMats.trunk} scale={[1.3, 1.7, 1.3]} position={[0, 0.85, 0]} />
          <mesh geometry={geo.trunk} material={gardenMats.trunk} position={[0.12, 1.15, 0.05]} rotation={[0.2, 0, -0.7]} scale={[0.6, 0.7, 0.6]} />
          <mesh geometry={geo.trunk} material={gardenMats.trunk} position={[-0.1, 1.2, -0.08]} rotation={[-0.5, 0, 0.55]} scale={[0.5, 0.6, 0.5]} />
          <group ref={featureCanRef} position={[0, 1.78, 0]}>
            <mesh geometry={blobGeos[0]} material={gardenMats.foliage[2]} position={[0, 0.1, 0]} scale={[0.95, 0.78, 0.95]} />
            <mesh geometry={blobGeos[1]} material={gardenMats.foliage[1]} position={[0.5, -0.12, 0.22]} scale={0.55} />
            <mesh geometry={blobGeos[2]} material={gardenMats.foliage[0]} position={[-0.45, -0.18, -0.25]} scale={0.48} />
            <mesh geometry={blobGeos[1]} material={gardenMats.foliage[3]} position={[0.1, 0.42, -0.3]} scale={0.42} />
          </group>
        </group>
        <group position={[0.95, 0, 6.6]} rotation={[0, -0.2, 0]}>
          <mesh geometry={geo.benchBase} material={fenceMat} />
          <mesh geometry={geo.bench} material={benchMat} />
        </group>
        <group position={[-0.95, 0, 8.4]} rotation={[0, 0.25, 0]}>
          <mesh geometry={geo.benchBase} material={fenceMat} />
          <mesh geometry={geo.bench} material={benchMat} />
        </group>
        {/* flower planters flanking the walk + shrub beds on the lawn */}
        {[[-0.85, 5.4], [0.85, 5.4]].map(([px, pz], i) => (
          <group key={`fp${i}`} position={[px, 0.1, pz]}>
            <mesh geometry={geo.benchBase} material={fenceMat} scale={[1.1, 0.8, 1.3]} />
            <mesh geometry={blobGeos[i % 3]} material={gardenMats.foliage[2]} position={[0, 0.24, 0]} scale={[0.16, 0.09, 0.12]} />
            <mesh geometry={geo.lightDot} material={rugMats[0]} position={[-0.1, 0.3, 0.02]} scale={0.65} />
            <mesh geometry={geo.lightDot} material={fenceMat} position={[0.08, 0.31, -0.03]} scale={0.6} />
            <mesh geometry={geo.lightDot} material={rugMats[3]} position={[0.02, 0.3, 0.06]} scale={0.55} />
          </group>
        ))}
        {[[-3.2, 7.2], [3.6, 6.8], [4.4, -3.4], [-4.6, -4.2], [5.2, 2.6]].map(([px, pz], i) => (
          <mesh
            key={`sb${i}`}
            geometry={blobGeos[(i + 1) % 3]}
            material={gardenMats.foliage[(i + 2) % 4]}
            position={[px, 0.05, pz]}
            scale={[0.24, 0.09, 0.2]}
          />
        ))}
      </group>

      {/* residents' parked cars */}
      <group ref={parkRef} visible={false}>
        {[0, 1, 2].map((k) => (
          <group key={`pc${k}`} position={[-7.3 + k * 0.95, 0, 8.9]} rotation={[0, Math.PI / 2, 0]} scale={CAR_SCALE}>
            <mesh geometry={geo.carBody} material={carMats[(k + 1) % 4]} />
            <mesh geometry={geo.carCabin} material={carCabinMat} />
            {[[-0.1, 0.14], [0.1, 0.14], [-0.1, -0.14], [0.1, -0.14]].map(([wx, wz], wi) => (
              <mesh key={wi} geometry={geo.wheel} material={carCabinMat} position={[wx, 0.045, wz]} />
            ))}
          </group>
        ))}
      </group>

      {/* civilians — a walker on the loop, one by the pool, one by the bench */}
      {civData.map((d, k) => (
        <group key={`cv${k}`} ref={(el) => (civRefs.current[k] = el)} visible={false}>
          {renderFigure(d.c, k)}
        </group>
      ))}

      {/* site cabins + material laydown (depletes as floors rise) */}
      <group ref={siteRef} visible={false}>
        <mesh geometry={geo.cabin} material={carMats[0]} position={[7.3, 0.25, 1.2]} rotation={[0, 0.12, 0]} />
        <mesh geometry={geo.cabin} material={carMats[1]} position={[7.35, 0.25, 1.95]} rotation={[0, -0.06, 0]} />
        <mesh geometry={geo.cabin} material={carMats[2]} position={[7.32, 0.75, 1.55]} rotation={[0, 0.04, 0]} />
        <mesh ref={(el) => (palletRefs.current[0] = el)} geometry={geo.pallet} material={palletMat} position={[5.9, 0, -4.9]} />
        <mesh ref={(el) => (palletRefs.current[1] = el)} geometry={geo.pallet} material={palletMat} position={[5.0, 0, -5.6]} scale={[0.8, 1, 0.8]} />
        {/* concrete mixer — drum churning at the site entrance */}
        <group position={[3.6, 0, 6.3]} rotation={[0, -0.5, 0]}>
          <mesh geometry={geo.mixerBody} material={carMats[1]} />
          <mesh geometry={geo.truckCab} material={carMats[2]} position={[0, 0, 0.58]} />
          <mesh ref={drumRef} geometry={geo.mixerDrum} material={carMats[0]} position={[0, 0.42, -0.12]} />
        </group>
      </group>

      {/* hoarding fence on the lower plinth edge */}
      <group ref={fenceRef} position={[0, 0.1, 0]} visible={false}>
        <mesh geometry={geo.fence} material={fenceMat} position={[0, 0, 5.65]} />
        <mesh geometry={geo.fence} material={fenceMat} position={[0, 0, -5.65]} />
        <mesh geometry={geo.fence} material={fenceMat} position={[5.65, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        <mesh geometry={geo.fence} material={fenceMat} position={[-5.65, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      </group>

      {/* birds — life around the finished tower (wings first: the flap
          animation drives children[0] and [1]) */}
      {birdData.map((_, k) => (
        <group key={`bird${k}`} ref={(el) => (birdsRef.current[k] = el)} visible={false}>
          <mesh geometry={geo.wing} material={wingMat} position={[0.03, 0.01, 0]} />
          <mesh geometry={geo.wing} material={wingMat} position={[-0.03, 0.01, 0]} scale={[-1, 1, 1]} />
          <mesh geometry={geo.birdBody} material={birdMat} />
          <mesh geometry={geo.birdHead} material={birdMat} position={[0, 0.012, 0.085]} />
          <mesh geometry={geo.beak} material={benchMat} position={[0, 0.01, 0.125]} />
          <mesh geometry={geo.tail} material={birdMat} position={[0, 0.005, -0.07]} />
        </group>
      ))}

      {/* LANDSCAPED GROUNDS — turns the bare moat between plinth and road into
          the garden of a luxury building: manicured lawn, a stone promenade with
          radial walks, an arrival forecourt + reflecting pool, a perimeter allée,
          colourful beds, path lighting and people. Scales in at handover. */}
      <group ref={groundsRef} visible={false}>
        {/* lawn carpet just above the survey grid */}
        <mesh geometry={geo.lawnPlate} material={lawnMat} position={[0, 0.006, 0]} receiveShadow />
        {/* stone promenade looping the building + the south entry walk to the road */}
        <mesh geometry={geo.groundsWalk} material={pathStoneMat} position={[0, 0.012, 0]} />
        <mesh geometry={geo.groundsPath} material={pathStoneMat} position={[0, 0.011, 8.1]} />
        {/* arrival forecourt — a paved plaza on the entry axis */}
        <mesh geometry={geo.forecourt} material={pathStoneMat} position={[0, 0.013, 7.6]} />
        {/* twin reflecting pools flanking the central walk */}
        {[-1, 1].map((sx) => (
          <group key={`pool${sx}`}>
            <mesh geometry={geo.poolBorder} material={fenceMat} position={[sx * 3.9, 0.05, 8.4]} scale={[1.4, 1, 1.5]} />
            <mesh geometry={geo.poolWater} material={poolMat} rotation={[-Math.PI / 2, 0, 0]} position={[sx * 3.9, 0.1, 8.4]} scale={[1.4, 1, 1.5]} />
          </group>
        ))}
        {/* GRAND ENTRANCE — a wide stair rises from the forecourt onto the lobby
            plinth, dead on-axis with the doors, so there's a clear way in */}
        {[0, 1, 2, 3].map((s) => (
          <mesh key={`est${s}`} geometry={geo.entryStep} material={pathStoneMat} position={[0, 0.205 - s * 0.05, 5.65 + s * 0.36]} castShadow receiveShadow />
        ))}
        {/* lit bollards lining the central walk from the street to the doors */}
        {[7.3, 8.7, 10.1, 11.4].map((z) =>
          [-1.7, 1.7].map((x) => (
            <group key={`eb${x}_${z}`} position={[x, 0, z]}>
              <mesh geometry={geo.bollard} material={lampMat} />
              <mesh geometry={geo.lightDot} material={lampGlowMat} position={[0, 0.25, 0]} scale={0.8} />
            </group>
          ))
        )}
        {/* perimeter allée — evenly spaced specimen trees just inside the road */}
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * Math.PI * 2 + 0.157
          const south = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)))
          if (south < 0.32) return null // keep the entry approach open
          const R = 9.7
          return (
            <group key={`gt${i}`} position={[Math.cos(a) * R, 0, Math.sin(a) * R]}>
              {renderGroundTree(i + 1, 1.7 + (i % 3) * 0.12, 0.82)}
            </group>
          )
        })}
        {/* colourful flower + hedge beds set into the lawn quadrants */}
        {[[6.4, 6.4, 0], [-6.4, 6.4, 2], [6.4, -6.4, 1], [-6.4, -6.4, 3], [9.4, -0.2, 0], [-9.4, -0.2, 2], [0.2, -9.6, 1]].map(
          ([x, z, fc], i) => (
            <group key={`gb${i}`} position={[x, 0.02, z]} rotation={[0, i * 0.5, 0]}>
              <mesh geometry={geo.hedge} material={gardenMats.hedge} scale={[2.0, 0.4, 1.25]} />
              <mesh geometry={geo.hedge} material={flowerMats[fc]} position={[0, 0.12, 0]} scale={[1.8, 0.32, 1.0]} />
              {Array.from({ length: 5 }, (_, fi) => (
                <mesh key={fi} geometry={geo.globe} material={flowerMats[(fc + fi + 1) % 4]} position={[(fi - 2) * 0.62, 0.3, (fi % 2) * 0.22 - 0.11]} scale={1.05} />
              ))}
            </group>
          )
        )}
        {/* a clipped-boxwood hedge frames the garden — OPEN at the south entry,
            with two topiary piers flanking the gateway so there's a way in */}
        <mesh geometry={geo.hedge} material={gardenMats.hedge} position={[0, 0, -10]} scale={[20, 1.05, 1.4]} castShadow />
        <mesh geometry={geo.hedge} material={gardenMats.hedge} position={[10, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[20, 1.05, 1.4]} castShadow />
        <mesh geometry={geo.hedge} material={gardenMats.hedge} position={[-10, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[20, 1.05, 1.4]} castShadow />
        <mesh geometry={geo.hedge} material={gardenMats.hedge} position={[-6.5, 0, 10]} scale={[7, 1.05, 1.4]} castShadow />
        <mesh geometry={geo.hedge} material={gardenMats.hedge} position={[6.5, 0, 10]} scale={[7, 1.05, 1.4]} castShadow />
        {[-3.1, 3.1].map((x) => (
          <group key={`pier${x}`} position={[x, 0, 10]}>
            <mesh geometry={geo.hedge} material={gardenMats.hedge} scale={[0.9, 1.9, 1.7]} castShadow />
            <mesh geometry={geo.globe} material={gardenMats.foliage[1]} position={[0, 0.66, 0]} scale={1.7} />
          </group>
        ))}
        {/* low ground-cover shrub clumps soften the lawn */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2 + 0.4
          const R = 6.6 + (i % 4) * 1.0
          const south = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)))
          if (south < 0.5) return null
          return (
            <group key={`gc${i}`} position={[Math.cos(a) * R, 0.01, Math.sin(a) * R]}>
              <mesh geometry={blobGeos[i % 3]} material={gardenMats.foliage[(i + 1) % 4]} scale={[0.42, 0.2, 0.42]} />
              <mesh geometry={blobGeos[(i + 1) % 3]} material={gardenMats.foliage[(i + 2) % 4]} position={[0.28, -0.02, 0.16]} scale={[0.3, 0.16, 0.3]} />
            </group>
          )
        })}
        {/* stepping-stone path crossing the east lawn */}
        {[0, 1, 2, 3, 4].map((s) => (
          <mesh key={`ss${s}`} geometry={geo.steppingStone} material={pathStoneMat} position={[5.6 + s * 0.95, 0.02, 3.2 - s * 0.45]} />
        ))}
        {/* bollard path lights along the promenade */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 + 0.26
          const R = 8.9
          return (
            <group key={`gl${i}`} position={[Math.cos(a) * R, 0, Math.sin(a) * R]}>
              <mesh geometry={geo.bollard} material={lampMat} />
              <mesh geometry={geo.lightDot} material={lampGlowMat} position={[0, 0.25, 0]} scale={0.9} />
            </group>
          )
        })}
        {/* garden benches + residents enjoying the grounds */}
        <group position={[4.7, 0, 6.0]} rotation={[0, -0.6, 0]}>
          <mesh geometry={geo.benchBase} material={fenceMat} />
          <mesh geometry={geo.bench} material={benchMat} />
        </group>
        <group position={[-5.3, 0, 5.2]} rotation={[0, 0.5, 0]}>
          <mesh geometry={geo.benchBase} material={fenceMat} />
          <mesh geometry={geo.bench} material={benchMat} />
        </group>
        <group position={[2.7, 0, 8.8]} rotation={[0, 2.5, 0]} scale={0.95}>{renderFigure(2, 1)}</group>
        <group position={[-2.1, 0, 8.2]} rotation={[0, -0.8, 0]} scale={0.95}>{renderFigure(1, 3)}</group>
        <group position={[7.2, 0, 2.0]} rotation={[0, 1.4, 0]} scale={0.95}>{renderFigure(0, 2)}</group>
      </group>

      {/* podium garden — clustered-crown trees + clipped hedges */}
      <group>
        {treeData.map((t, k) => (
          <group
            key={k}
            ref={(el) => (plantsRef.current[k] = el)}
            position={[t.x, t.y, t.z]}
            rotation={[t.lx, 0, t.lz]}
            visible={false}
          >
            <group>
              <mesh geometry={geo.trunk} material={gardenMats.trunk} scale={[1, t.h, 1]} position={[0, t.h / 2, 0]} castShadow />
              {t.branches.map((b, j) => (
                <mesh
                  key={j}
                  geometry={geo.trunk}
                  material={gardenMats.trunk}
                  position={[b.dx, t.h * 0.62, b.dz]}
                  rotation={[b.rx, 0, b.rz]}
                  scale={[0.45, 0.5, 0.45]}
                />
              ))}
            </group>
            <group position={[0, t.h, 0]}>
              {t.blobs.map((b, j) => (
                <mesh
                  key={j}
                  geometry={blobGeos[b.g]}
                  material={gardenMats.foliage[b.m]}
                  position={[b.dx, b.dy, b.dz]}
                  scale={[b.s, b.s * 0.85, b.s]}
                  castShadow
                />
              ))}
            </group>
          </group>
        ))}
        {hedgeData.map((h, k) => (
          <group
            key={`h${k}`}
            ref={(el) => (plantsRef.current[treeData.length + k] = el)}
            position={[h.x, 0.22, h.z]}
            rotation={[0, h.rot ? Math.PI / 2 : 0, 0]}
            visible={false}
          >
            {h.kind === 'flower' ? (
              <>
                {/* clipped green border + a vivid mass of seasonal flowers */}
                <mesh geometry={geo.hedge} material={gardenMats.hedge} scale={[h.w, 0.42, 1.02]} />
                <mesh geometry={geo.hedge} material={flowerMats[h.fc]} position={[0, 0.12, 0]} scale={[h.w * 0.92, 0.34, 0.84]} />
                {Array.from({ length: 6 }, (_, fi) => (
                  <mesh
                    key={fi}
                    geometry={geo.globe}
                    material={flowerMats[(h.fc + fi + 1) % 4]}
                    position={[((fi % 3) - 1) * h.w * 0.52, 0.3, fi < 3 ? -0.14 : 0.14]}
                    scale={0.85}
                  />
                ))}
              </>
            ) : (
              <mesh geometry={geo.hedge} material={gardenMats.hedge} scale={[h.w, 1, 1]} />
            )}
          </group>
        ))}
      </group>

      {/* furnished apartments — visible only when the section is open.
          Party walls make the cut read as real units; lamps glow warm. */}
      <group ref={sectionFurnRef} visible={false}>
        {/* ground floor — the lobby: reception, concierge, lounge */}
        <group position={[-1.25, SLAB_T, 0]}>
          <mesh geometry={geo.floorPanel} material={stoneFloorMat} />
          <mesh geometry={geo.floorPanel} material={wallMat} position={[0, 1.025, 0]} />
          <mesh geometry={geo.credenza} material={woodMat} position={[0.15, 0.03, -0.55]} scale={[1.7, 1.4, 1.3]} />
          <group position={[0.15, 0.03, -0.95]} rotation={[0, 0.15, 0]} scale={0.92}>
            {renderFigure(0, 2)}
          </group>
          <mesh geometry={geo.stool} material={figMats[2]} position={[-0.7, 0.1, 0.6]} scale={1.5} />
          <mesh geometry={geo.stool} material={figMats[2]} position={[-0.15, 0.1, 0.78]} scale={1.5} />
          <mesh geometry={geo.tableTop} material={benchMat} position={[-0.42, 0.05, 0.62]} scale={1.3} />
          <group position={[0.95, 0.03, 0.7]}>
            <mesh geometry={geo.pot} material={rugMats[0]} scale={1.5} />
            <mesh geometry={blobGeos[0]} material={gardenMats.foliage[1]} position={[0, 0.3, 0]} scale={[0.15, 0.2, 0.15]} />
          </group>
          <mesh geometry={geo.beacon} material={lampGlowMat} position={[-0.2, 1.03, 0]} scale={[0.3, 0.08, 0.3]} />
          <mesh geometry={geo.beacon} material={lampGlowMat} position={[0.45, 1.03, -0.5]} scale={[0.3, 0.08, 0.3]} />
          <mesh geometry={geo.lightPool} material={lightPoolMat} rotation={[-Math.PI / 2, 0, 0]} position={[-0.2, 0.045, 0]} />
        </group>
        {sectionRooms.map((r, k) => (
          <group key={`sr${k}`} position={[-1.25, r.f * FLOOR_HEIGHT + SLAB_T, r.z]} rotation={[0, r.rot, 0]}>
            {/* shell fitted to the WHOLE plate: wall-to-wall floor, party
                walls running cut-face to facade, dressed side zones */}
            <mesh geometry={geo.floorPanel} material={r.kind >= 3 ? stoneFloorMat : woodFloorMat} />
            <mesh geometry={geo.floorPanel} material={wallMat} position={[0, 1.025, 0]} />
            <mesh geometry={geo.partition} material={wallMat} position={[0.03, 0, -1.55]} />
            <mesh geometry={geo.partition} material={wallMat} position={[0.03, 0, 1.55]} />
            <mesh geometry={geo.curtain} material={curtainMat} position={[-1.14, 0, -0.95]} />
            <mesh geometry={geo.curtain} material={curtainMat} position={[-1.14, 0, 0.95]} />
            {/* gallery wall over a credenza — the wall is curated, not bare */}
            <group position={[0.1, 0, -1.47]}>{renderGallery(r.f)}</group>
            <mesh geometry={geo.credenza} material={woodMat} position={[0.1, 0.025, -1.32]} />
            <mesh geometry={geo.stool} material={figMats[3]} position={[-0.18, 0.08, -1.32]} scale={0.45} />
            {/* styled credenza top — stacked books in the room's signature
                colour + a sculptural brass vessel; the curated lived-in detail */}
            <mesh geometry={geo.stool} material={signatureMats[r.kind]} position={[0.34, 0.24, -1.33]} scale={[0.95, 0.16, 0.52]} rotation={[0, 0.1, 0]} />
            <mesh geometry={geo.stool} material={figMats[3]} position={[0.33, 0.265, -1.33]} scale={[0.82, 0.14, 0.46]} rotation={[0, -0.16, 0]} />
            <mesh geometry={geo.pot} material={benchMat} position={[-0.14, 0.225, -1.33]} scale={[1.15, 1.4, 1.15]} />
            <mesh geometry={geo.rug} material={rugMats[r.rug]} position={[0, 0.028, 0.1]} />
            {/* neighbouring units beyond the party walls — never empty */}
            <mesh geometry={geo.rug} material={rugMats[(r.rug + 2) % 4]} position={[-0.3, 0.028, 2.05]} scale={[0.6, 1, 0.45]} />
            <mesh geometry={geo.stool} material={figMats[(r.c + 1) % 4]} position={[0.3, 0.1, 2.0]} scale={1.3} />
            <group position={[-0.85, 0.03, 2.1]}>
              <mesh geometry={geo.pot} material={rugMats[3]} />
              <mesh geometry={blobGeos[k % 3]} material={gardenMats.foliage[k % 4]} position={[0, 0.17, 0]} scale={[0.09, 0.12, 0.09]} />
            </group>
            <mesh geometry={geo.rug} material={rugMats[(r.rug + 1) % 4]} position={[0.2, 0.028, -2.05]} scale={[0.55, 1, 0.4]} />
            <mesh geometry={geo.credenza} material={woodMat} position={[-0.7, 0.025, -2.1]} scale={[0.8, 1, 0.8]} />
            <group position={[0.85, 0.03, -2.15]}>
              <mesh geometry={geo.pot} material={rugMats[0]} />
              <mesh geometry={blobGeos[(k + 1) % 3]} material={gardenMats.foliage[(k + 2) % 4]} position={[0, 0.16, 0]} scale={[0.085, 0.11, 0.085]} />
            </group>
            {/* ceiling downlights + their warm pools on the floor */}
            <mesh geometry={geo.beacon} material={lampGlowMat} position={[-0.4, 1.03, 0]} scale={[0.3, 0.08, 0.3]} />
            <mesh geometry={geo.beacon} material={lampGlowMat} position={[0.5, 1.03, 0]} scale={[0.3, 0.08, 0.3]} />
            <mesh geometry={geo.lightPool} material={lightPoolMat} rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0.04, 0]} />
            <mesh geometry={geo.lightPool} material={lightPoolMat} rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.04, 0]} />
            {/* a statement plant in the back corner of every unit */}
            <group position={[-0.92, 0.03, -1.1]}>{renderTallPlant(k)}</group>

            {r.kind === 0 && (
              <>
                <mesh geometry={geo.bed} material={fenceMat} position={[0.05, 0, -0.25]} />
                <mesh geometry={geo.duvet} material={signatureMats[0]} position={[0.05, 0, -0.25]} />
                <mesh geometry={geo.pillow} material={figMats[3]} position={[-0.15, 0.21, -0.85]} />
                <mesh geometry={geo.pillow} material={figMats[3]} position={[0.25, 0.21, -0.85]} />
                <mesh geometry={geo.headboard} material={woodMat} position={[0.05, 0.17, -0.95]} />
                <mesh geometry={geo.stool} material={woodMat} position={[-0.62, 0.08, -0.88]} />
                <mesh geometry={geo.stool} material={woodMat} position={[0.72, 0.08, -0.88]} />
                <mesh geometry={geo.pillow} material={rugMats[r.rug]} position={[0.05, 0.22, 0.08]} scale={[2.7, 0.6, 1]} />
                <mesh geometry={geo.stool} material={figMats[2]} position={[-0.62, 0.19, -0.86]} scale={[0.4, 0.3, 0.3]} />
                {/* bedside lamps + a round mirror on the far wall */}
                <mesh geometry={geo.beacon} material={lampGlowMat} position={[-0.62, 0.22, -0.88]} scale={0.22} />
                <mesh geometry={geo.beacon} material={lampGlowMat} position={[0.72, 0.22, -0.88]} scale={0.22} />
                <mesh geometry={geo.mirror} material={mirrorMat} position={[0.55, 0.62, 1.47]} />
              </>
            )}
            {r.kind === 1 && (
              <>
                <mesh geometry={geo.sofaSeat} material={signatureMats[1]} position={[0, 0, -0.55]} />
                <mesh geometry={geo.sofaBack} material={signatureMats[1]} position={[0, 0.22, -0.77]} />
                <mesh geometry={geo.sofaSeat} material={signatureMats[1]} position={[0.66, 0, -0.3]} rotation={[0, Math.PI / 2, 0]} scale={[0.5, 1, 1]} />
                <mesh geometry={geo.tableTop} material={benchMat} position={[0, 0.05, 0.12]} scale={1.5} />
                <mesh geometry={geo.stool} material={figMats[2]} position={[-0.78, 0.1, 0.18]} scale={1.2} />
                {/* media wall on the far partition */}
                <mesh geometry={geo.credenza} material={woodMat} position={[0.15, 0.025, 1.36]} />
                <mesh geometry={geo.headboard} material={carCabinMat} position={[0.15, 0.52, 1.45]} scale={[0.85, 1.3, 1]} />
                <mesh geometry={geo.pillow} material={rugMats[(r.rug + 1) % 4]} position={[-0.3, 0.2, -0.6]} scale={0.8} />
                <mesh geometry={geo.pillow} material={figMats[3]} position={[0.32, 0.2, -0.6]} scale={0.8} />
                {/* sculptural pendant + styled coffee table */}
                <group position={[0, 0, 0.12]}>{renderPendant(0.4)}</group>
                <mesh geometry={geo.trayDeco} material={benchMat} position={[0, 0.135, 0.12]} />
                <mesh geometry={geo.stool} material={signatureMats[1]} position={[0.04, 0.16, 0.16]} scale={[0.55, 0.1, 0.4]} rotation={[0, 0.3, 0]} />
                <mesh geometry={geo.globe} material={mirrorMat} position={[-0.07, 0.16, 0.08]} scale={0.55} />
              </>
            )}
            {r.kind === 2 && (
              <>
                <mesh geometry={geo.hedge} material={signatureMats[2]} position={[0.1, 0, -0.8]} scale={[1.25, 1, 0.9]} />
                <mesh geometry={geo.cable} material={carCabinMat} position={[-0.15, 0.92, -0.8]} />
                <mesh geometry={geo.cable} material={carCabinMat} position={[0.4, 0.92, -0.8]} />
                <mesh geometry={geo.beacon} material={lampGlowMat} position={[-0.15, 0.78, -0.8]} scale={0.5} />
                <mesh geometry={geo.beacon} material={lampGlowMat} position={[0.4, 0.78, -0.8]} scale={0.5} />
                <mesh geometry={geo.dinTable} material={benchMat} position={[0, 0, 0.35]} />
                <mesh geometry={geo.stool} material={signatureMats[2]} position={[-0.32, 0.08, 0.72]} />
                <mesh geometry={geo.stool} material={signatureMats[2]} position={[0.3, 0.08, 0.72]} />
                <mesh geometry={geo.stool} material={signatureMats[2]} position={[-0.32, 0.08, 0.0]} />
                <mesh geometry={geo.stool} material={signatureMats[2]} position={[0.3, 0.08, 0.0]} />
                <mesh geometry={geo.beacon} material={benchMat} position={[0, 0.3, 0.35]} scale={[0.35, 0.2, 0.35]} />
                <mesh geometry={geo.stool} material={fenceMat} position={[-0.15, 0.39, -0.8]} scale={[0.5, 0.3, 0.4]} />
                <mesh geometry={geo.stool} material={figMats[1]} position={[0.35, 0.39, -0.8]} scale={[0.35, 0.25, 0.35]} />
                {/* pendant cluster over the table */}
                <group position={[-0.16, 0, 0.35]}>{renderPendant(0.42)}</group>
                <group position={[0.18, 0, 0.35]}>{renderPendant(0.5)}</group>
                {/* kitchen — charcoal base, honed-marble top, brass, upper cabinet */}
                <group position={[0, 0, 1.28]}>
                  <mesh geometry={geo.credenza} material={woodMat} position={[0, 0.025, 0]} scale={[1.05, 1.4, 1.0]} />
                  <mesh geometry={geo.counterTop} material={marbleTopMat} position={[0, 0, 0]} scale={[1.05, 1, 0.95]} />
                  <mesh geometry={geo.shelfBack} material={woodMat} position={[0, 0.88, 0.12]} scale={[1.2, 0.4, 1]} />
                  <mesh geometry={geo.bottle} material={mirrorMat} position={[-0.3, 0.34, 0]} />
                  <mesh geometry={geo.bottle} material={signatureMats[2]} position={[-0.22, 0.34, -0.03]} />
                  <mesh geometry={geo.globe} material={benchMat} position={[0.3, 0.345, 0]} scale={0.7} />
                </group>
              </>
            )}

            {r.kind === 3 && (
              <>
                {/* retail: display counter, plinths, shelving */}
                <mesh geometry={geo.credenza} material={benchMat} position={[0, 0.03, 0.2]} scale={[1.5, 1.6, 1.2]} />
                <mesh geometry={geo.stool} material={fenceMat} position={[-0.7, 0.12, -0.6]} scale={1.4} />
                <mesh geometry={geo.stool} material={figMats[2]} position={[-0.7, 0.32, -0.6]} scale={0.5} />
                <mesh geometry={geo.stool} material={fenceMat} position={[0.55, 0.12, -0.7]} scale={1.4} />
                <mesh geometry={geo.stool} material={figMats[1]} position={[0.55, 0.32, -0.7]} scale={0.5} />
                <mesh geometry={geo.headboard} material={signatureMats[3]} position={[0.1, 0.3, 1.42]} scale={[1.6, 1.8, 1]} />
              </>
            )}
            {r.kind === 4 && (
              <>
                {/* workspace: two desk rows, task chairs, monitors */}
                <mesh geometry={geo.dinTable} material={woodMat} position={[-0.45, 0, -0.5]} scale={[1.1, 1, 1]} />
                <mesh geometry={geo.dinTable} material={woodMat} position={[-0.45, 0, 0.6]} scale={[1.1, 1, 1]} />
                <mesh geometry={geo.stool} material={signatureMats[4]} position={[-0.85, 0.08, -0.85]} />
                <mesh geometry={geo.stool} material={signatureMats[4]} position={[-0.1, 0.08, -0.85]} />
                <mesh geometry={geo.stool} material={signatureMats[4]} position={[-0.85, 0.08, 0.95]} />
                <mesh geometry={geo.stool} material={signatureMats[4]} position={[-0.1, 0.08, 0.95]} />
                <mesh geometry={geo.stool} material={signatureMats[4]} position={[-0.6, 0.31, -0.5]} scale={[0.9, 0.5, 0.2]} />
                <mesh geometry={geo.stool} material={signatureMats[4]} position={[-0.15, 0.31, 0.6]} scale={[0.9, 0.5, 0.2]} />
                {/* library wall against the party partition */}
                <group position={[0.45, 0, 1.4]} rotation={[0, Math.PI, 0]}>{renderBookcase()}</group>
              </>
            )}
            {r.kind === 5 && (
              <>
                {/* residents' club: facing sofas, long table, double greenery */}
                <mesh geometry={geo.sofaSeat} material={signatureMats[5]} position={[0, 0, -0.62]} />
                <mesh geometry={geo.sofaBack} material={signatureMats[5]} position={[0, 0.22, -0.84]} />
                <mesh geometry={geo.sofaSeat} material={signatureMats[5]} position={[0, 0, 0.62]} rotation={[0, Math.PI, 0]} />
                <mesh geometry={geo.sofaBack} material={signatureMats[5]} position={[0, 0.22, 0.84]} />
                <mesh geometry={geo.dinTable} material={benchMat} position={[0, 0, 0]} scale={[0.9, 0.7, 0.8]} />
                <group position={[0.92, 0.03, -1.1]}>
                  <mesh geometry={geo.pot} material={rugMats[3]} scale={1.3} />
                  <mesh geometry={blobGeos[2]} material={gardenMats.foliage[0]} position={[0, 0.24, 0]} scale={[0.12, 0.17, 0.12]} />
                </group>
                {/* library wall + sculptural pendant over the table */}
                <group position={[0.55, 0, 1.4]} rotation={[0, Math.PI, 0]}>{renderBookcase()}</group>
                <group position={[0, 0, 0]}>{renderPendant(0.5)}</group>
              </>
            )}

            {/* floor lamp at true human height (~1.8m) */}
            {(r.kind === 0 || r.kind === 1 || r.kind === 5) && (
              <group position={[-0.95, 0, 0.7]}>
                <mesh geometry={geo.lampPole} material={woodMat} scale={[0.6, 0.5, 0.6]} />
                <mesh geometry={geo.lampShade} material={lampGlowMat} position={[0, 0.68, 0]} />
                <mesh geometry={geo.lightPool} material={lightPoolMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} scale={0.8} />
              </group>
            )}
            {/* a potted plant in every plan — pot, stem, upright crown */}
            <group position={[1.0, 0.03, 0.78]}>
              <mesh geometry={geo.pot} material={rugMats[0]} />
              <mesh geometry={blobGeos[(k + 1) % 3]} material={gardenMats.foliage[(k + 2) % 4]} position={[0, 0.19, 0]} scale={[0.1, 0.14, 0.1]} />
            </group>

            {/* residents at home */}
            <group position={[0.7, 0, 0.55]} rotation={[0, -0.8 + r.rot, 0]} scale={0.92}>
              {renderFigure(r.c, k)}
            </group>
            {r.couple && (
              <group position={[0.5, 0, 0.32]} rotation={[0, 2.1 + r.rot, 0]} scale={0.9}>
                {renderFigure((r.c + 2) % 4, k + 1)}
              </group>
            )}
            {r.pet && (
              <group position={[-0.45, 0, 0.4]} rotation={[0, 1.2, 0]}>
                <mesh geometry={geo.petBody} material={figMats[1]} />
                <mesh geometry={geo.petHead} material={figMats[1]} position={[0, 0.11, 0.11]} />
              </group>
            )}
          </group>
        ))}
      </group>

      {/* rooftop amenity deck — cap tray + pergola */}
      <group ref={roofRef} position={[0, BUILDING_HEIGHT, 0]} scale={[0.8, 1, 0.8]} visible={false}>
        <mesh geometry={geo.tray} material={roofMat} castShadow receiveShadow />
        {[[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].map(([x, z], k) => (
          <mesh key={k} geometry={geo.post} material={roofMat} position={[x, SLAB_T + 0.45, z]} />
        ))}
        <mesh geometry={geo.tray} material={roofMat} position={[0, SLAB_T + 0.9, 0]} scale={[0.68, 0.45, 0.68]} />
        {/* parapet balustrade — nobody walks off this roof */}
        <mesh geometry={geo.ring} material={balMats[FLOOR_COUNT - 1]} position={[0, SLAB_T + RAIL_H, 0]} />
        <mesh geometry={geo.ring} material={railMats[FLOOR_COUNT - 1]} position={[0, SLAB_T + RAIL_H + 0.05, 0]} scale={[1, 0.12, 1]} />
        {/* ROOF DECK — the payoff the ride ends on: a luxury sky garden of
            timber + travertine, an infinity pool, a sunken fire-lounge, a bar,
            a pergola dining room, planting and festoon lighting */}
        <mesh geometry={geo.floorPanel} material={woodFloorMat} position={[0, SLAB_T + 0.004, 0]} scale={[1.85, 1, 0.95]} rotation={[0, Math.PI / 2, 0]} />
        {/* travertine lounge platform inset in the timber deck */}
        <mesh geometry={geo.floorPanel} material={stoneFloorMat} position={[-0.55, SLAB_T + 0.008, -0.55]} scale={[0.42, 1, 0.62]} rotation={[0, Math.PI / 2, 0]} />

        {/* INFINITY POOL along the east edge — coping, sun loungers, parasol */}
        <mesh geometry={geo.poolBorder} material={stoneFloorMat} position={[1.55, SLAB_T + 0.04, -0.15]} scale={[0.62, 1, 1.5]} />
        <mesh geometry={geo.poolWater} material={poolMat} rotation={[-Math.PI / 2, 0, 0]} position={[1.55, SLAB_T + 0.09, -0.15]} scale={[0.62, 1, 1.5]} />
        <mesh geometry={geo.lounger} material={figMats[3]} position={[2.18, SLAB_T + 0.04, -0.55]} rotation={[0, -Math.PI / 2, 0]} scale={1.1} />
        <mesh geometry={geo.lounger} material={figMats[3]} position={[2.18, SLAB_T + 0.04, 0.2]} rotation={[0, -Math.PI / 2, 0]} scale={1.1} />
        <group position={[2.25, SLAB_T, 0.95]}>
          <mesh geometry={geo.post} material={benchMat} scale={[0.4, 0.62, 0.4]} position={[0, 0.27, 0]} />
          <mesh geometry={geo.parasolTop} material={figMats[3]} position={[0, 0.62, 0]} scale={1.15} />
        </group>

        {/* SUNKEN LOUNGE — facing sofas around a glowing fire feature */}
        <mesh geometry={geo.sofaSeat} material={figMats[2]} position={[-0.55, SLAB_T, -1.0]} scale={1.0} />
        <mesh geometry={geo.sofaBack} material={figMats[2]} position={[-0.55, SLAB_T + 0.22, -1.21]} scale={1.0} />
        <mesh geometry={geo.sofaSeat} material={figMats[2]} position={[-0.55, SLAB_T, -0.1]} rotation={[0, Math.PI, 0]} scale={1.0} />
        <mesh geometry={geo.sofaBack} material={figMats[2]} position={[-0.55, SLAB_T + 0.22, 0.11]} scale={1.0} />
        <mesh geometry={geo.pillow} material={signatureMats[1]} position={[-0.92, SLAB_T + 0.2, -1.0]} scale={0.8} />
        <mesh geometry={geo.pillow} material={signatureMats[5]} position={[-0.18, SLAB_T + 0.2, -0.1]} scale={0.8} />
        {/* fire pit — travertine basin with a warm flame */}
        <mesh geometry={geo.tableTop} material={stoneFloorMat} position={[-0.55, SLAB_T + 0.02, -0.55]} scale={[1.7, 0.55, 1.7]} />
        <mesh geometry={geo.lightDot} material={lampGlowMat} position={[-0.55, SLAB_T + 0.12, -0.55]} scale={1.7} />

        {/* BAR — marble counter, back-bar bottles, stools */}
        <group position={[-2.0, SLAB_T, 0.5]} rotation={[0, 0.5, 0]}>
          <mesh geometry={geo.credenza} material={woodMat} position={[0, 0.03, 0]} scale={[1.5, 1.6, 1.0]} />
          <mesh geometry={geo.counterTop} material={marbleTopMat} position={[0, 0, 0]} scale={[1.1, 1, 0.7]} />
          <mesh geometry={geo.bottle} material={signatureMats[3]} position={[-0.28, 0.34, -0.06]} />
          <mesh geometry={geo.bottle} material={mirrorMat} position={[-0.18, 0.34, -0.06]} />
          <mesh geometry={geo.bottle} material={signatureMats[1]} position={[-0.08, 0.34, -0.06]} />
          <mesh geometry={geo.stool} material={figMats[0]} position={[0.05, 0.08, 0.42]} />
          <mesh geometry={geo.stool} material={figMats[0]} position={[-0.45, 0.08, 0.42]} />
        </group>

        {/* PERGOLA DINING — a slatted timber pergola over a long table */}
        <group position={[0.15, SLAB_T, 1.45]}>
          {[[-0.95, -0.42], [0.95, -0.42], [-0.95, 0.42], [0.95, 0.42]].map(([px, pz], i) => (
            <mesh key={`pp${i}`} geometry={geo.post} material={woodMat} position={[px, 0.46, pz]} scale={[0.55, 1.05, 0.55]} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={`sl${i}`} geometry={geo.cable} material={woodMat} position={[-0.9 + i * 0.26, 0.94, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 3.6, 1.2]} />
          ))}
          <mesh geometry={geo.dinTable} material={woodMat} position={[0, 0, 0]} scale={[1.15, 1, 0.7]} />
          {[-0.5, 0, 0.5].map((x, i) => (
            <mesh key={`dca${i}`} geometry={geo.stool} material={figMats[2]} position={[x, 0.08, -0.46]} />
          ))}
          {[-0.5, 0, 0.5].map((x, i) => (
            <mesh key={`dcb${i}`} geometry={geo.stool} material={figMats[2]} position={[x, 0.08, 0.46]} />
          ))}
        </group>

        {/* clipped planters + flowering pots + a pair of feature trees */}
        {[[-2.25, 1.4], [-1.3, 2.0], [1.3, 1.9], [2.25, 1.3], [-2.3, -1.2], [0.1, -1.55]].map(([px, pz], i) => (
          <group key={`rpl${i}`} position={[px, SLAB_T, pz]}>
            <mesh geometry={geo.hedge} material={gardenMats.hedge} scale={[0.8, 0.7, 0.5]} />
            <mesh geometry={geo.globe} material={i % 2 ? gardenMats.foliage[1] : flowerMats[i % 4]} position={[0, 0.3, 0]} scale={1.25} />
          </group>
        ))}
        {[[-2.35, 0.4], [2.3, -1.15]].map(([px, pz], i) => (
          <group key={`rtr${i}`} position={[px, SLAB_T, pz]}>
            <mesh geometry={geo.trunk} material={gardenMats.trunk} scale={[0.55, 0.95, 0.55]} position={[0, 0.45, 0]} />
            <mesh geometry={blobGeos[i % 3]} material={gardenMats.foliage[2]} position={[0, 1.0, 0]} scale={0.52} />
            <mesh geometry={blobGeos[(i + 1) % 3]} material={gardenMats.foliage[3]} position={[0.18, 0.88, 0.1]} scale={0.34} />
          </group>
        ))}

        {/* festoon string lights criss-crossing the deck — warm glow at dusk */}
        {Array.from({ length: 22 }, (_, i) => {
          const t = i / 21
          return (
            <mesh
              key={`fl${i}`}
              geometry={geo.lightDot}
              material={lampGlowMat}
              position={[-2.3 + t * 4.6, SLAB_T + 0.95 - Math.sin(t * Math.PI) * 0.22, i % 2 ? -1.3 : 1.3]}
              scale={0.7}
            />
          )
        })}

        {/* residents enjoying the deck */}
        <group position={[0.95, SLAB_T, -0.55]} rotation={[0, 2.4, 0]} scale={0.9}>{renderFigure(2, 1)}</group>
        <group position={[-1.35, SLAB_T, -0.4]} rotation={[0, 0.8, 0]} scale={0.9}>{renderFigure(0, 3)}</group>
        <group position={[1.85, SLAB_T, 0.85]} rotation={[0, -1.3, 0]} scale={0.9}>{renderFigure(1, 2)}</group>
        {/* parapet crown light — glows after dusk */}
        <mesh geometry={geo.ring} material={crownMat} position={[0, SLAB_T + 0.1, 0]} scale={[1.01, 0.18, 1.01]} />
        <mesh ref={beaconRef} geometry={geo.beacon} material={beaconMat} position={[0, SLAB_T + 1.2, 0]} />
      </group>
    </group>
  )
})

const tmpColorA = new THREE.Color()
const tmpColorB = new THREE.Color()
const tmpColorC = new THREE.Color()
const tmpColorD = new THREE.Color()
const tmpColorE = new THREE.Color()

export default Building

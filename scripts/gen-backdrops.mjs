#!/usr/bin/env node
/**
 * v3 极光底图生成器：亮/暗成对、各 10 张。
 *  - 亮色 aurora-N.svg：近白基底 + 2 层大半径柔焦色斑（低饱和，参考 DSH 品牌蓝/紫/橙/青）。
 *  - 暗色 aurora-dark-N.svg：深底（#232324 系）+ 同族色斑降明度增饱和。
 *  - 无花纹、无噪点（bento 规范：禁花纹/彩虹/复杂渐变）。
 *  - 确定性：同一 seed 产物一致；不引第三方依赖。
 */
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'

const OUT_URL = new URL('../assets/backdrops/', import.meta.url)

/* 每套：3 个色相角（OKLCH 思路的 HSL 近似）——围绕 DSH 品牌蓝的主副色。 */
const PALETTES = [
  { name: 'azure',    h1: 220, h2: 268, h3: 200 },
  { name: 'violet',   h1: 262, h2: 300, h3: 232 },
  { name: 'amber',    h1: 32,  h2: 12,  h3: 48  },
  { name: 'teal',     h1: 180, h2: 210, h3: 160 },
  { name: 'rose',     h1: 340, h2: 316, h3: 8   },
  { name: 'indigo',   h1: 242, h2: 274, h3: 214 },
  { name: 'cyan',     h1: 196, h2: 224, h3: 172 },
  { name: 'coral',    h1: 16,  h2: 344, h3: 40  },
  { name: 'emerald',  h1: 158, h2: 190, h3: 132 },
  { name: 'slate',    h1: 214, h2: 240, h3: 196 },
]

/** 确定性 PRNG（mulberry32），seed 固定则产物固定。 */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n) => Math.round(n * 10) / 10

/**
 * 生成一张极光底图（强度对齐 v3 对照稿：亮色主斑 ~hsl(l 85%)、暗色 ~hsl(l 23%)）。
 * mode='light'：双色调浅基底（h1/h2 各 8% 饱和）+ 色斑 l 84-89%、alpha 0.8-0.95。
 * mode='dark' ：近黑基底（#1c1d1f 系）+ 色斑 l 20-27%、alpha 0.8-0.95。
 */
function build(pal, idx, mode) {
  const r = rng(idx * 7919 + (mode === 'dark' ? 104729 : 0))
  const [w, h] = [400, 260]
  const blobs = [
    { x: f(40 + r() * 200), y: f(-30 + r() * 150), rad: f(170 + r() * 110), hue: pal.h1, l: mode === 'dark' ? 21 + r() * 3 : 85 + r() * 3, s: mode === 'dark' ? 34 + r() * 12 : 60 + r() * 14, a: 0.85 + r() * 0.1 },
    { x: f(200 + r() * 180), y: f(90 + r() * 160), rad: f(140 + r() * 100), hue: pal.h2, l: mode === 'dark' ? 22 + r() * 4 : 86 + r() * 3, s: mode === 'dark' ? 30 + r() * 14 : 52 + r() * 16, a: 0.8 + r() * 0.12 },
    { x: f(-40 + r() * 200), y: f(140 + r() * 130), rad: f(120 + r() * 90), hue: pal.h3, l: mode === 'dark' ? 23 + r() * 3 : 87 + r() * 3, s: mode === 'dark' ? 28 + r() * 12 : 48 + r() * 16, a: 0.7 + r() * 0.15 },
  ]
  const baseTint = mode === 'dark'
    ? { l: 11 + r() * 1.5, s: 6 }
    : { l: 96.5 + r() * 1, s: 10 }
  const layers = blobs.map((b, i) => {
    const id = `b${i}`
    const col = `hsl(${f(b.hue)} ${f(b.s)}% ${f(b.l)}%)`
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${col}" stop-opacity="${b.a.toFixed(2)}"/>
      <stop offset="55%" stop-color="${col}" stop-opacity="${(b.a * 0.5).toFixed(2)}"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </radialGradient>`
  }).join('\n    ')
  const circles = blobs.map((b, i) =>
    `<circle cx="${f(b.x)}" cy="${f(b.y)}" r="${f(b.rad)}" fill="url(#b${i})"/>`).join('\n    ')
  const c1 = `hsl(${f(pal.h1)} ${baseTint.s}% ${f(baseTint.l)}%)`
  const c2 = `hsl(${f(pal.h2)} ${baseTint.s}% ${f(baseTint.l + (mode === 'dark' ? 1.5 : 0.8))}%)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    ${layers}
  </defs>
  <rect width="${w}" height="${h}" fill="url(#base)"/>
  <g filter="url(#soft)">
    ${circles}
  </g>
</svg>
`
}

function main() {
  rmSync(OUT_URL, { recursive: true, force: true })
  mkdirSync(OUT_URL, { recursive: true })
  for (let i = 0; i < PALETTES.length; i++) {
    const pal = PALETTES[i]
    const n = i + 1
    writeFileSync(new URL(`aurora-${n}.svg`, OUT_URL), build(pal, n, 'light'))
    writeFileSync(new URL(`aurora-dark-${n}.svg`, OUT_URL), build(pal, n + 100, 'dark'))
  }
  const names = readdirSync(OUT_URL).sort()
  console.log(`generated ${names.length} files: ${names.join(', ')}`)
}

main()

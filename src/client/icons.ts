/**
 * 面板图标集（v3）：内联 Lucide 线性图标（ISC 许可；path 数据取自 lucide-static v0.469.0）
 * + 圆角图标砖配色（accent 12% 透明底）。作为默认图标；用户自定义（emoji/字符）优先。
 * 说明：emoji 跨端渲染不一、不随主题换色，故默认一律走内联 SVG（调研结论，口径同 dsh-codex-ui）。
 */

export interface GlyphElement {
  tag: 'path' | 'circle' | 'rect' | 'polyline' | 'line'
  [attr: string]: unknown
}

export interface PanelGlyph {
  /** 图标砖 accent（用于描边与 12% 透明底）。 */
  accent: string
  elements: GlyphElement[]
}

const STROKE_GLYPHS: Record<string, GlyphElement[]> = {
  conversation: [ // Lucide message-circle
    { tag: 'path', d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' },
  ],
  duanju: [ // Lucide clapperboard
    { tag: 'path', d: 'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z' },
    { tag: 'path', d: 'm6.2 5.3 3.1 3.9' },
    { tag: 'path', d: 'm12.4 3.4 3.1 4' },
    { tag: 'path', d: 'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' },
  ],
  syjy: [ // Lucide scale
    { tag: 'path', d: 'm16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z' },
    { tag: 'path', d: 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z' },
    { tag: 'path', d: 'M7 21h10' },
    { tag: 'path', d: 'M12 3v18' },
    { tag: 'path', d: 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2' },
  ],
  'file-editor': [ // Lucide file-text
    { tag: 'path', d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' },
    { tag: 'path', d: 'M14 2v4a2 2 0 0 0 2 2h4' },
    { tag: 'path', d: 'M10 9H8' },
    { tag: 'path', d: 'M16 13H8' },
    { tag: 'path', d: 'M16 17H8' },
  ],
  plugins: [ // Lucide puzzle
    { tag: 'path', d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z' },
  ],
  schedules: [ // Lucide clock
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'polyline', points: '12 6 12 12 16 14' },
  ],
}

/** 未知面板的通用图标（Lucide layout-grid）。 */
const FALLBACK_GLYPH: GlyphElement[] = [
  { tag: 'rect', width: 7, height: 7, x: 3, y: 3, rx: 1 },
  { tag: 'rect', width: 7, height: 7, x: 14, y: 3, rx: 1 },
  { tag: 'rect', width: 7, height: 7, x: 14, y: 14, rx: 1 },
  { tag: 'rect', width: 7, height: 7, x: 3, y: 14, rx: 1 },
]

const ACCENTS: Record<string, string> = {
  conversation: '#4176e6',
  duanju: '#d98324',
  syjy: '#5b6f95',
  'file-editor': '#3f9d6e',
  plugins: '#8b6bc9',
  schedules: '#3fa3b5',
}

const FALLBACK_ACCENT = '#7a8290'

/** 取某面板的内置图标（未知 key 用通用图标与中性 accent）。 */
export function panelGlyph(key: string): PanelGlyph {
  return {
    accent: ACCENTS[key] ?? FALLBACK_ACCENT,
    elements: STROKE_GLYPHS[key] ?? FALLBACK_GLYPH,
  }
}

/** 管理入口按钮图标（Lucide settings）。 */
export const MANAGE_GLYPH: GlyphElement[] = [
  { tag: 'path', d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' },
  { tag: 'circle', cx: 12, cy: 12, r: 3 },
]

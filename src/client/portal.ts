export type CardKind = 'main' | 'small'
export interface PortalCard { key: string; label: string; icon: string; description: string; kind: CardKind }
export interface PortalPrefs { cardKinds: Record<string, CardKind>; iconOverrides: Record<string, string> }

export const PREFS_STORAGE_KEY = 'dsh-portal.prefs'

/** 内置图标集（管理态「换图标」一排 12 个）。 */
export const ICON_SET = ['💬', '🗨️', '🤖', '⚡', '🧠', '📚', '⚖️', '🏛️', '🛡️', '📜', '🎓', '🔍']

/** 无侧栏 label 的内建面板的中文名回退（当前仅对话；其余已装面板均自带侧栏 label）。 */
export const LABELS: Record<string, string> = {
  conversation: '对话',
}

/** 默认主卡（其余默认小卡）。 */
const DEFAULT_MAIN = ['conversation', 'duanju', 'syjy']

/** 已知面板的一句描述；未知 key 无描述。默认图标（Lucide 内联 SVG）见 icons.ts 的 panelGlyph。 */
const DICT: Record<string, { desc: string }> = {
  conversation: { desc: '与 AI 助手对话、跑任务' },
  duanju: { desc: '梗概 · 剧本 · 分镜生成流水线' },
  syjy: { desc: '立案 · 庭审 · 文书 · 案件库' },
  'file-editor': { desc: '文件编辑器' },
  plugins: { desc: '插件管理' },
  schedules: { desc: '自动化任务' },
}

export function readPrefs(): PortalPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY)
    if (raw === null) return { cardKinds: {}, iconOverrides: {} }
    const parsed = JSON.parse(raw) as Partial<PortalPrefs>
    return {
      cardKinds: typeof parsed.cardKinds === 'object' && parsed.cardKinds !== null ? parsed.cardKinds : {},
      iconOverrides: typeof parsed.iconOverrides === 'object' && parsed.iconOverrides !== null ? parsed.iconOverrides : {},
    }
  } catch {
    return { cardKinds: {}, iconOverrides: {} }
  }
}

export function writePrefs(prefs: PortalPrefs): void {
  try { window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs)) } catch { /* 存储不可用即静默，保持默认 */ }
}

/** icon 为空串表示用内置 SVG 图标；非空则按其字面渲染（任意 emoji / 字符的自定义覆盖）。 */
export function discoverCards(entries: { key: string; label: string }[], prefs: PortalPrefs): PortalCard[] {
  return entries
    .filter(entry => entry.key !== 'portal')
    .map(entry => {
      const dict = DICT[entry.key]
      return {
        key: entry.key,
        label: entry.label === '' ? entry.key : entry.label,
        icon: prefs.iconOverrides[entry.key] ?? '',
        description: dict?.desc ?? '',
        kind: prefs.cardKinds[entry.key] ?? (DEFAULT_MAIN.includes(entry.key) ? 'main' : 'small'),
      }
    })
}

// ---------- 瀑布墙（双宽：主卡 2 格宽高块、小卡 1 格矮块） ----------

/** 4 列基准：主卡横跨 2 列、占 7 个单元行；小卡 1 列、占 4 个单元行（与 ui 的 14px 行高配）。 */
const MAIN_COL_SPAN = 2
const MAIN_ROW_SPAN = 7
const SMALL_ROW_SPAN = 4

export interface MasonryCell { col: number; colSpan: number; row: number; rowSpan: number }

/**
 * 贪心瀑布铺排：依次放到"当前最矮的那一列"（比较各可用起始列的占位高度）。
 * 落位序 = 主卡先、小卡后（同序内保持原相对顺序），随后再把小卡填进主卡留下的空位——
 * 宽卡（2 格）要求相邻两列同时腾空，先放小卡会在窄列造成大空洞；主卡先行即无洞。
 * 返回按**原始卡片顺序**对齐的 0 基网格坐标（直接映射为 CSS grid-column/grid-row）。
 */
export function planMasonry(cards: { kind: CardKind }[], columns: number): MasonryCell[] {
  const colCount = Math.max(1, Math.floor(columns))
  const heights = new Array<number>(colCount).fill(0)
  const cells: MasonryCell[] = new Array<MasonryCell>(cards.length)
  const order = cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => (a.card.kind === b.card.kind ? a.index - b.index : a.card.kind === 'main' ? -1 : 1))
  for (const { card, index } of order) {
    const colSpan = card.kind === 'main' ? Math.min(MAIN_COL_SPAN, colCount) : 1
    const rowSpan = card.kind === 'main' ? MAIN_ROW_SPAN : SMALL_ROW_SPAN
    let bestCol = 0
    let bestBase = Number.POSITIVE_INFINITY
    for (let start = 0; start + colSpan <= colCount; start += 1) {
      let base = 0
      for (let i = start; i < start + colSpan; i += 1) base = Math.max(base, heights[i]!)
      if (base < bestBase) { bestBase = base; bestCol = start }
    }
    for (let i = bestCol; i < bestCol + colSpan; i += 1) heights[i] = bestBase + rowSpan
    cells[index] = { col: bestCol, colSpan, row: bestBase, rowSpan }
  }
  return cells
}

// ---------- 卡片底图（v3 极光：亮/暗成对 10 组；由 scripts/gen-backdrops.mjs 产出） ----------

/** 亮色极光池（文件在 assets/backdrops/，经 /portal-assets 路由取用）。 */
export const BACKDROP_POOL = [
  'aurora-1.svg', 'aurora-2.svg', 'aurora-3.svg', 'aurora-4.svg', 'aurora-5.svg',
  'aurora-6.svg', 'aurora-7.svg', 'aurora-8.svg', 'aurora-9.svg', 'aurora-10.svg',
]

/** 暗色极光池：与亮色池同序号同色族（切主题不掉色相）。 */
export const BACKDROP_POOL_DARK = [
  'aurora-dark-1.svg', 'aurora-dark-2.svg', 'aurora-dark-3.svg', 'aurora-dark-4.svg', 'aurora-dark-5.svg',
  'aurora-dark-6.svg', 'aurora-dark-7.svg', 'aurora-dark-8.svg', 'aurora-dark-9.svg', 'aurora-dark-10.svg',
]

export const BACKDROP_URL_BASE = '/portal-assets/backdrops/'

export interface BackdropPair { light: string; dark: string }

/**
 * 洗牌分配（亮/暗成对）：每轮把序号洗匀后依序发卡，同屏不重样；卡数超过池大小时续池再洗
 * （并避免新一轮首张与上一轮尾张撞图）。同序号亮暗成对 → 主题切换时色相保持。
 * 每次进门户（组件挂载）调用一次即"随机加载"。
 */
export function assignBackdropPairs(
  count: number,
  lightPool: string[] = BACKDROP_POOL,
  darkPool: string[] = BACKDROP_POOL_DARK,
  random: () => number = Math.random,
): BackdropPair[] {
  const out: BackdropPair[] = []
  if (lightPool.length === 0 || count <= 0) return out
  while (out.length < count) {
    const bag = lightPool.map((_, index) => index)
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      const swap = bag[i]!
      bag[i] = bag[j]!
      bag[j] = swap
    }
    if (out.length > 0 && bag.length > 1 && lightPool[bag[0]!] === out[out.length - 1]!.light) {
      const swap = bag[0]!
      bag[0] = bag[1]!
      bag[1] = swap
    }
    for (const index of bag) {
      out.push({
        light: lightPool[index]!,
        dark: darkPool[index % Math.max(1, darkPool.length)] ?? lightPool[index]!,
      })
    }
  }
  return out.slice(0, count)
}

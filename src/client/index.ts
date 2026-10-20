/**
 * 浏览器半入口：工作台门户面板 + 侧栏图标 + 管理态（主/小卡切换、换图标、持久化）。
 */
import { createElement, useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react'
import {
  assignBackdropPairs, BACKDROP_POOL, BACKDROP_POOL_DARK, BACKDROP_URL_BASE, discoverCards, ICON_SET, LABELS,
  planMasonry, readPrefs, writePrefs,
  type BackdropPair, type CardKind, type MasonryCell, type PortalCard, type PortalPrefs,
} from './portal'
import { MANAGE_GLYPH, panelGlyph, type GlyphElement } from './icons'
import { button, ensurePortalCss, style, T } from './ui'

const PANEL_ID = 'portal'
const h = createElement

/** Lucide 线性图标（内联 SVG）：stroke 随 currentColor，颜色/底色由 .portal-tile 注入样式给。 */
function glyphSvg(elements: GlyphElement[], size: number, strokeWidth: number): unknown {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
  }, elements.map((el, index) => {
    const { tag, ...attrs } = el
    return h(tag, { key: index, ...attrs })
  }))
}

interface SlotEntry { options: Record<string, unknown> }

interface ClientContext {
  slots: {
    inject(slot: string, contribute: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
    entries(slot: string): SlotEntry[]
  }
  layout?: { selectPanel(panelId: string | null): void }
  loader?: { await?(): Promise<unknown> }
}

/** 侧栏同位 id 的 label（函数则调用；取不到/为空/抛错回退 LABELS 内置表，再回退 key）。 */
function sidebarLabel(sidebarEntries: SlotEntry[], key: string): string {
  try {
    const label = sidebarEntries.find(entry => entry.options.id === key)?.options.label
    const resolved = typeof label === 'function' ? (label as () => unknown)() : label
    if (typeof resolved === 'string' && resolved !== '') return resolved
  } catch (cause) {
    console.warn(`[dsh-portal] 侧栏标签读取失败（回退内置名）：${String(cause)}`)
  }
  return LABELS[key] ?? key
}

/** 换图标弹层状态：目标卡 key + 视口锚点（fixed 定位，不被滚动容器裁切）。 */
interface IconPickerState { key: string; top: number; left: number }

/** 弹层宽固定；高为初值（翻转判定），挂载后按实测再在视口内夹取。 */
const PICKER_WIDTH = 300
const PICKER_EST_HEIGHT = 120

/** 管理态与弹层局部样式（全走 DSH `--dsw-*` token，无硬编码色值）。 */
const chrome = {
  /** 卡片右下管理控件组（仅管理态渲染；zIndex 2 压在底图/内容层之上）。 */
  controls: {
    position: 'absolute' as const, right: '6px', bottom: '6px', zIndex: 2,
    display: 'flex', gap: '4px', alignItems: 'center',
  },
  controlBtn: {
    padding: '2px 7px', fontSize: '10px', lineHeight: '1.5', borderRadius: T.radiusSm,
    cursor: 'pointer', background: T.panel, color: T.label2,
    border: `1px solid ${T.border}`, fontFamily: T.font,
  },
  /** 换图标弹层：卡下方（锚点按钮下方）一排图标集 + 一行任意字符输入 +「确定」。 */
  picker: {
    position: 'fixed' as const, zIndex: 1000, width: `${PICKER_WIDTH}px`, boxSizing: 'border-box' as const,
    display: 'flex', flexDirection: 'column' as const, gap: '8px', padding: '10px',
    background: T.panel, border: `1px solid ${T.border}`, borderRadius: '10px',
    boxShadow: 'var(--dsw-elevation-panel, none)', fontFamily: T.font,
  },
  chipRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' },
  chip: {
    padding: '3px 0', fontSize: '15px', lineHeight: '1.3', textAlign: 'center' as const,
    borderRadius: T.radiusSm, cursor: 'pointer', background: 'transparent',
    color: T.label, border: `1px solid ${T.borderFaint}`, fontFamily: T.font,
  },
  iconRow: { display: 'flex', gap: '6px', alignItems: 'center' },
  iconInput: {
    flex: '1 1 auto', minWidth: '0', padding: '4px 8px', fontSize: '12px',
    borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: 'transparent', color: T.label, fontFamily: T.font,
  },
}

/** 管理态下发给卡片的操作面（普通态 managing=false，控件不渲染）。 */
interface CardManageFace {
  managing: boolean
  toggleKind(card: PortalCard): void
  toggleIcons(key: string, anchor: Element | null): void
}

/** 卡片右下管理控件（仅管理态渲染）：小卡「设主卡」/ 主卡「改小卡」+「换图标」。 */
function cardControls(card: PortalCard, face: CardManageFace): unknown {
  if (!face.managing) return null
  return h('div', { key: 'controls', style: chrome.controls },
    h('button', {
      key: 'kind', type: 'button', style: chrome.controlBtn,
      onClick: (event: ReactMouseEvent) => { event.stopPropagation(); face.toggleKind(card) },
    }, card.kind === 'main' ? '改小卡' : '设主卡'),
    h('button', {
      key: 'icon', type: 'button', style: chrome.controlBtn, 'data-portal-anchor': card.key,
      onClick: (event: ReactMouseEvent) => { event.stopPropagation(); face.toggleIcons(card.key, event.currentTarget) },
    }, '换图标'),
  )
}

/**
 * 瀑布墙卡片：主卡=极光底图 + 主题遮罩 + 图标砖 + 名称 + 一句描述；小卡=纯面 + 图标砖 + 名称。
 * 底图亮/暗成对经 CSS 变量（--portal-bg-l/--portal-bg-d）由 .portal-bg 按主题切换。
 * 网格坐标来自 planMasonry，点击跳转对应面板。
 */
function portalCard(card: PortalCard, cell: MasonryCell, backdrop: BackdropPair, select: (key: string) => void, face: CardManageFace): unknown {
  const isMain = card.kind === 'main'
  const glyph = panelGlyph(card.key)
  const tileStyle = {
    ...(isMain ? style.tileMain : style.tileSmall),
    '--portal-accent': glyph.accent,
  } as Record<string, unknown>
  const icon = card.icon !== ''
    ? h('span', { key: 'icon', className: 'portal-glyph portal-tile', style: tileStyle }, card.icon)
    : h('span', { key: 'icon', className: 'portal-glyph portal-tile', style: tileStyle },
      glyphSvg(glyph.elements, isMain ? 20 : 16, 1.75))
  return h('div', {
    key: card.key,
    className: 'portal-card',
    style: {
      ...style.cell,
      ...(isMain ? style.cellMain : style.cellSmall),
      gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
      gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
    },
    onClick: () => select(card.key),
  },
    isMain
      ? h('div', {
        key: 'bg', className: 'portal-bg',
        style: { '--portal-bg-l': `url(${BACKDROP_URL_BASE}${backdrop.light})`, '--portal-bg-d': `url(${BACKDROP_URL_BASE}${backdrop.dark})` },
      })
      : null,
    isMain ? h('div', { key: 'scrim', className: 'portal-scrim' }) : null,
    h('div', { key: 'inner', style: style.cardInner },
      icon,
      isMain
        ? h('div', { key: 'text' },
          h('div', { key: 'name', style: style.nameMain }, card.label),
          card.description === '' ? null : h('div', { key: 'desc', style: style.desc }, card.description))
        : h('span', { key: 'name', style: style.nameSmall }, card.label),
    ),
    cardControls(card, face),
  )
}

interface PortalPanelProps {
  entries?: () => SlotEntry[]
  sidebarEntries?: () => SlotEntry[]
  selectCard?: (key: string) => void
}

function PortalPanel(props: PortalPanelProps): unknown {
  const [managing, setManaging] = useState(false)
  const [prefs, setPrefs] = useState<PortalPrefs>(() => readPrefs())
  const [picker, setPicker] = useState<IconPickerState | null>(null)
  const [iconDraft, setIconDraft] = useState('')
  const [columns, setColumns] = useState(4)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const backdropsRef = useRef<BackdropPair[] | null>(null)

  // 弹层点击外部关闭：点「换图标」锚点（data-portal-anchor）或弹层内部除外。
  useEffect(() => {
    if (picker === null) return undefined
    const onDocumentClick = (event: MouseEvent): void => {
      const target = event.target as Element | null
      if (target !== null && target.closest('[data-portal-anchor]') !== null) return
      const node = pickerRef.current
      if (node !== null && node.contains(event.target as Node)) return
      setPicker(null)
    }
    document.addEventListener('click', onDocumentClick)
    return () => { document.removeEventListener('click', onDocumentClick) }
  }, [picker])

  // 实测高度与初值有差时，在视口内再夹取一次（防底部卡片弹层越界）。
  useEffect(() => {
    if (picker === null) return undefined
    const node = pickerRef.current
    if (node === null) return undefined
    const height = node.getBoundingClientRect().height
    if (height <= 0 || picker.top + height <= window.innerHeight - 8) return undefined
    const top = Math.max(8, window.innerHeight - 8 - height)
    setPicker(prev => (prev === null || prev.top === top ? prev : { ...prev, top }))
    return undefined
  }, [picker])

  // 瀑布列数随容器宽度自适应（窄 2 / 中 3 / 宽 4；640 总宽下内容区约 600 → 4 列）；
  // 无 ResizeObserver 时按窗口宽度兜底一次。
  useEffect(() => {
    const el = wrapRef.current
    const compute = (width: number): void => setColumns(width < 500 ? 2 : width < 620 ? 3 : 4)
    compute(el?.clientWidth ?? window.innerWidth)
    if (el === null || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth
      compute(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** 写入并即时生效：本地 state 触发重渲染，localStorage 供跨刷新/重启保持。 */
  const applyPrefs = (next: PortalPrefs): void => {
    writePrefs(next)
    setPrefs(next)
  }

  const toggleKind = (card: PortalCard): void => {
    const next: CardKind = card.kind === 'main' ? 'small' : 'main'
    applyPrefs({ ...prefs, cardKinds: { ...prefs.cardKinds, [card.key]: next } })
    // 切主/小后卡尺寸变化、旧锚点失效：关闭已打开的换图标弹层（控件 stopPropagation，外点监听收不到本点击）。
    setPicker(null)
    setIconDraft('')
  }

  /** 选中/确定（非空即暂存）：写入 iconOverrides、卡图标立即更新、弹层关闭。 */
  const pickIcon = (key: string, value: string): void => {
    const icon = value.trim()
    if (icon === '') return
    applyPrefs({ ...prefs, iconOverrides: { ...prefs.iconOverrides, [key]: icon } })
    setPicker(null)
    setIconDraft('')
  }

  /** 开/合弹层：再次点同一「换图标」即关闭；位置取锚点按钮 rect，在视口内夹取。 */
  const toggleIcons = (key: string, anchor: Element | null): void => {
    if (picker !== null && picker.key === key) {
      setPicker(null)
      setIconDraft('')
      return
    }
    const rect = anchor === null ? null : anchor.getBoundingClientRect()
    const fitsBelow = rect === null || rect.bottom + 6 + PICKER_EST_HEIGHT <= window.innerHeight - 8
    const top = rect === null ? 120
      : fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - PICKER_EST_HEIGHT)
    const left = rect === null ? 24
      : Math.min(Math.max(rect.left, 12), Math.max(12, window.innerWidth - PICKER_WIDTH - 12))
    setIconDraft('')
    setPicker({ key, top, left })
  }

  /** 换图标弹层：一排图标集（点即选）+ 一行任意 emoji/字符输入 +「确定」（非空即暂存）。 */
  const renderPicker = (state: IconPickerState): unknown => h('div', {
    key: 'portal-icon-picker', ref: pickerRef,
    style: { ...chrome.picker, top: `${state.top}px`, left: `${state.left}px` },
  },
    h('div', { key: 'chips', style: chrome.chipRow },
      ICON_SET.map(icon => h('button', {
        key: icon, type: 'button', style: chrome.chip, title: icon,
        onClick: () => pickIcon(state.key, icon),
      }, icon))),
    h('div', { key: 'input-row', style: chrome.iconRow },
      h('input', {
        key: 'icon-input', type: 'text', value: iconDraft, placeholder: '或直接输入任意 emoji / 字符',
        'aria-label': '或直接输入任意 emoji / 字符', style: chrome.iconInput,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIconDraft(event.target.value),
      }),
      h('button', {
        key: 'icon-confirm', type: 'button', style: button.small,
        onClick: () => pickIcon(state.key, iconDraft),
      }, '确定'),
    ),
  )

  const sidebarEntries = props.sidebarEntries?.() ?? []
  const listing = (props.entries?.() ?? [])
    .map(entry => String(entry.options.key ?? ''))
    .filter(key => key !== '')
    .map(key => ({ key, label: sidebarLabel(sidebarEntries, key) }))
  const cards = discoverCards(listing, prefs)
  const select = (key: string): void => { props.selectCard?.(key) }
  const face: CardManageFace = { managing, toggleKind, toggleIcons }
  // 底图随机分配：挂载时一次性洗牌（每次进门户重新随机、同屏不重样）；卡片数增长时按新规模重发。
  if (backdropsRef.current === null || backdropsRef.current.length < cards.length) {
    backdropsRef.current = assignBackdropPairs(Math.max(cards.length, 20))
  }
  const backdrops = backdropsRef.current
  const fallback: BackdropPair = { light: BACKDROP_POOL[0] ?? '', dark: BACKDROP_POOL_DARK[0] ?? '' }
  const cells = planMasonry(cards, columns)
  return h('div', { key: 'portal-root', style: style.page },
    h('div', { key: 'portal-title-row', style: style.titleRow },
      h('span', { key: 'portal-title', style: style.title }, '工作台'),
      h('button', {
        key: 'portal-manage', type: 'button', style: button.normal,
        onClick: () => { setManaging(prev => !prev); setPicker(null); setIconDraft('') },
      },
      managing
        ? '✓ 完成'
        : [h('span', { key: 'manage-glyph', className: 'portal-glyph' }, glyphSvg(MANAGE_GLYPH, 14, 2)), '管理卡片']),
    ),
    h('div', {
      key: 'portal-grid', ref: wrapRef,
      style: { ...style.masonry, '--portal-cols': String(columns) },
    },
      cards.map((card, index) => portalCard(
        card,
        cells[index] ?? { col: 0, colSpan: 1, row: index * 4, rowSpan: 4 },
        backdrops[index] ?? fallback,
        select, face,
      ))),
    picker === null ? null : renderPicker(picker),
  )
}

function PortalIcon(): unknown {
  return h('svg', {
    width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  },
  h('path', { key: 'roof', d: 'M2.5 7.5 8 2.5l5.5 5' }),
  h('path', { key: 'body', d: 'M4 7v6h8V7' }))
}

export const inject = ['slots', 'layout']

export function apply(ctx: ClientContext): void {
  ensurePortalCss()
  /** 卡片点击跳转：对话走官方 selectPanel(null)，其余取卡 key；失败只警告。 */
  const selectCard = (key: string): void => {
    try {
      ctx.layout?.selectPanel(key === 'conversation' ? null : key)
    } catch (cause) {
      console.warn('[dsh-portal] 面板跳转失败：', String(cause))
    }
  }
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    inject: () => ({
      entries: () => ctx.slots.entries('main'),
      sidebarEntries: () => ctx.slots.entries('sidebar.panellist'),
      selectCard,
    }),
  }, PortalPanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 0,
    label: () => '门户',
  }, PortalIcon))

  // 启动落点：等装载就绪 + 门户面板在 main 注册可见后，抢选中门户；失败只 warn（侧栏兜底）。
  void (async () => {
    try {
      try { await ctx.loader?.await?.() } catch { /* 无 loader：走下一步轮询 */ }
      for (let i = 0; i < 20; i += 1) {
        if (ctx.slots.entries('main').some(entry => entry.options.key === PANEL_ID)) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      try { ctx.layout?.selectPanel(PANEL_ID) } catch (cause) {
        console.warn(`[dsh-portal] 启动选中门户失败（可从侧栏进入）：${String(cause)}`)
      }
    } catch (cause) {
      console.warn(`[dsh-portal] 启动落点轮询异常（忽略，可从侧栏进入）：${String(cause)}`)
    }
  })()
}

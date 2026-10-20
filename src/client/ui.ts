/**
 * 浏览器半 UI 基元（v3）：全部走 DSH 的 --dsw-* token（双主题自适应），
 * 颜色/圆角/字体不硬编码（唯一例外：每个面板的图标强调色，属面板身份色而非主题色）。
 * 卡片口径照 dsh-codex-ui：半透明面 + 发丝描边（label 10%）+ 圆角 20 + hover 只加描边/轻浮；
 * 排版照 Ant 中文规范：页题 18/600、卡名 15(14)/500、描述 13/1.6。
 * 伪类/主题切换等静态 CSS 经 ensurePortalCss() 注入（内联样式无法表达 hover 与暗色底图切换）。
 */

export const T = {
  bg: 'var(--dsw-alias-bg-base)',
  panel: 'var(--dsw-alias-bg-layer-1)',
  border: 'var(--dsw-alias-border-l2)',
  borderFaint: 'var(--dsw-alias-border-l1)',
  label: 'var(--dsw-alias-label-primary)',
  label2: 'var(--dsw-alias-label-secondary)',
  caption: 'var(--dsw-alias-label-caption)',
  onBrand: 'var(--dsw-alias-brand-primary-invert)',
  btn: 'var(--dsw-alias-button-primary-fill)',
  btnDanger: 'var(--dsw-alias-state-error-primary)',
  radiusSm: 'var(--dsw-radius-sm)',
  radiusMd: 'var(--dsw-radius-md)',
  font: 'var(--dsw-font-family)',
}

const CSS_ID = 'dsh-portal-theme-css'

/**
 * 注入门户静态样式（幂等）：卡片描边/hover、底图亮暗切换、遮罩、图标砖。
 * 亮暗切换跟随 DSH 真开关 body[data-ds-dark-theme]；颜色一律 token 合成（color-mix），不写死色值。
 */
export function ensurePortalCss(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(CSS_ID) !== null) return
  const el = document.createElement('style')
  el.id = CSS_ID
  el.textContent = `
.portal-card { border: 1px solid color-mix(in srgb, ${T.label} 10%, transparent); border-radius: var(--dsw-radius-xl); box-shadow: var(--dsw-elevation-soft, none); transition: transform .15s ease, border-color .15s ease; }
.portal-card:hover { border-color: color-mix(in srgb, ${T.label} 20%, transparent); transform: translateY(-2px); }
.portal-card::before { content: ''; position: absolute; inset: 0; z-index: 1; background-color: transparent; transition: background-color .15s ease; pointer-events: none; }
.portal-card:hover::before { background-color: color-mix(in srgb, ${T.label} 5%, transparent); }
.portal-bg { position: absolute; inset: 0; background-image: var(--portal-bg-l); background-size: cover; background-position: center; background-repeat: no-repeat; }
body[data-ds-dark-theme] .portal-bg { background-image: var(--portal-bg-d); }
.portal-scrim { position: absolute; inset: 0; background: color-mix(in srgb, ${T.panel} 52%, transparent); }
.portal-glyph { display: flex; align-items: center; justify-content: center; }
.portal-glyph svg { display: block; }
.portal-tile { background: color-mix(in srgb, var(--portal-accent, ${T.label2}) 12%, transparent); color: var(--portal-accent, ${T.label2}); }
body[data-ds-dark-theme] .portal-tile { background: color-mix(in srgb, var(--portal-accent, ${T.label2}) 20%, transparent); color: color-mix(in srgb, var(--portal-accent, ${T.label2}) 55%, ${T.label}); }
`
  document.head.appendChild(el)
}

/** 卡片底色/描边/投影口径（B 卡片）：与 syjy 同款取值。 */
export const style = {
  /** 居中容器：门户整页（总宽 640、居中、超高滚动）。 */
  page: {
    display: 'flex', flexDirection: 'column' as const, gap: '12px',
    width: '100%', maxWidth: '640px', height: '100%', margin: '0 auto',
    padding: '24px 20px', boxSizing: 'border-box' as const,
    fontFamily: T.font, fontSize: '13px', color: T.label,
    background: T.bg, overflowY: 'auto' as const,
  },
  /** 顶部轻标题行：左「工作台」、右按钮区。 */
  titleRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
  },
  /** 页题（Ant：18/600）。 */
  title: { fontSize: '18px', fontWeight: 600, color: T.label, lineHeight: 1.4 },
  /** 瀑布墙网格：列数由 --portal-cols 注入（随容器宽度 2/3/4），单元行高 12、间距 12。 */
  masonry: {
    display: 'grid',
    gridTemplateColumns: 'repeat(var(--portal-cols, 4), minmax(0, 1fr))',
    gridAutoRows: '12px', gap: '12px', alignContent: 'start' as const,
  },
  /** 卡片基底（主/小共用）：描边/圆角/hover 走 .portal-card 注入样式；overflow 裁切底图圆角。 */
  cell: {
    position: 'relative' as const, overflow: 'hidden' as const,
    display: 'flex', alignItems: 'center',
    cursor: 'pointer',
  },
  /** 主卡：2 格宽高块（大图标砖 + 名称 + 一句描述）；底色照 DSH 面板面（底图加载失败时的兜底）。 */
  cellMain: {
    padding: '0 18px', gap: '12px',
    background: T.panel,
  },
  /** 小卡：1 格矮块（小图标砖 + 名称）。 */
  cellSmall: { padding: '0 14px', gap: '10px', background: T.panel },
  /** 内容层：压在底图与遮罩之上（z 2 > hover 罩层 z 1）。 */
  cardInner: {
    position: 'relative' as const, zIndex: 2,
    display: 'flex', gap: '12px', alignItems: 'center', width: '100%',
    height: '100%',
  },
  /** 图标砖（主卡 40/12 圆角 + 主卡图标 20；颜色走 --portal-accent + .portal-tile 注入样式）。 */
  tileMain: {
    width: '40px', height: '40px', borderRadius: T.radiusMd, flex: 'none' as const,
    fontSize: '20px', lineHeight: 1,
  },
  /** 小卡图标砖 32/10 圆角 + 图标 16。 */
  tileSmall: {
    width: '32px', height: '32px', borderRadius: '10px', flex: 'none' as const,
    fontSize: '15px', lineHeight: 1,
  },
  nameMain: { fontSize: '15px', fontWeight: 500, color: T.label, lineHeight: 1.4 },
  nameSmall: { fontSize: '14px', fontWeight: 500, color: T.label, lineHeight: 1.4 },
  desc: { fontSize: '13px', color: T.label2, lineHeight: 1.6, marginTop: '3px' },
  caption: { color: T.caption, fontSize: '11px' },
}

export const button = {
  primary: {
    padding: '6px 16px', fontSize: '13px', borderRadius: T.radiusSm, cursor: 'pointer',
    background: T.btn, color: T.onBrand, border: 'none', fontFamily: T.font,
  },
  normal: {
    padding: '5px 12px', fontSize: '13px', borderRadius: '10px', cursor: 'pointer',
    display: 'inline-flex' as const, alignItems: 'center' as const, gap: '6px',
    background: 'transparent', color: T.label2, border: '1px solid color-mix(in srgb, ' + T.label + ' 12%, transparent)', fontFamily: T.font,
  },
  danger: {
    padding: '6px 14px', fontSize: '13px', borderRadius: T.radiusSm, cursor: 'pointer',
    background: 'transparent', color: T.btnDanger, border: `1px solid ${T.btnDanger}`, fontFamily: T.font,
  },
  ghost: {
    padding: '4px 10px', fontSize: '12px', borderRadius: T.radiusSm, cursor: 'pointer',
    background: 'transparent', color: T.label2, border: 'none', fontFamily: T.font,
  },
  small: {
    padding: '3px 10px', fontSize: '12px', borderRadius: T.radiusSm, cursor: 'pointer',
    background: 'transparent', color: T.label2, border: `1px solid ${T.border}`, fontFamily: T.font,
  },
}

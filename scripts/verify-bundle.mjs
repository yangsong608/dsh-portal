// 自证：⓪ 产物新鲜度门（防「构建失败打旧包」假绿）；① 客户端产物形态（照 syjy verify 头段）；
// ①+ 门户静态锚点与行为面接线（T2 两条 + T5 全量清单）；
// ①++ 增量：瀑布布局 + 卡底图池 + 资产目录；② 宿主资产路由行为（handler 直驱）。
// 用法：pnpm run bundle && node scripts/verify-bundle.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'

let failed = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}

// ---------- ⓪ 产物新鲜度（按各自的源码树对比） ----------
const clientArtifactMtime = statSync(new URL('../lib/client.js', import.meta.url)).mtimeMs
const hostArtifactMtime = statSync(new URL('../lib/index.js', import.meta.url)).mtimeMs
// 容错读取：缺文件不算崩（内容检查会如实 FAIL），避免校验器自身抛错掩盖真实结果。
const safeMtime = (path) => { try { return statSync(new URL(path, import.meta.url)).mtimeMs } catch { return 0 } }
const clientSrcMtime = Math.max(
  safeMtime('../src/client/index.ts'),
  safeMtime('../src/client/portal.ts'),
  safeMtime('../src/client/ui.ts'),
  safeMtime('../src/client/icons.ts'),
)
const hostSrcMtime = statSync(new URL('../src/host/index.ts', import.meta.url)).mtimeMs
check('客户端产物新于客户端源码', clientArtifactMtime >= clientSrcMtime)
check('宿主产物新于宿主源码', hostArtifactMtime >= hostSrcMtime)

// ---------- ① 客户端产物形态（照 syjy verify 头段） ----------
const artifact = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const head = artifact.slice(0, 400)
const tail = artifact.slice(-200)
check('开头是模块加载器登记', head.includes('window.__ModuleLoader__.load('))
check('登记 id 是 dsh-portal', head.includes('"dsh-portal"'))
check('结尾闭合工厂与登记调用', tail.trimEnd().endsWith('});'))
check('React 保持外部引用', /require\(["']react["']\)/.test(artifact))
check('没有内联 React 实现', !/react\.production|__SECRET_INTERNALS|useSyncExternalStore/.test(artifact))

// ---------- ①+ 产物静态锚点（门户标题与管理入口；须为带引号字符串字面，注释文案不可满足） ----------
check('产物含门户标题「工作台」', artifact.includes('"工作台"'))
check('产物含管理入口「管理卡片」', artifact.includes('管理卡片'))

// ---------- ①+ 本插件行为面静态锚点（源码接线） ----------
const CLIENT_SRC = new URL('../src/client/', import.meta.url)
const readClientSrc = (f) => { try { return readFileSync(new URL(f, CLIENT_SRC), 'utf8') } catch { return '' } }
const clientSrc = ['index.ts', 'portal.ts', 'ui.ts', 'icons.ts'].map(readClientSrc).join('\n')
check('产物含管理态文案', artifact.includes('设主卡') && artifact.includes('改小卡') && artifact.includes('换图标'))
check('产物含 emoji 输入提示', artifact.includes('或直接输入任意 emoji'))
check('启动选中接线在源', clientSrc.includes("selectPanel(PANEL_ID)"))
check('装载等待接线在源', clientSrc.includes('loader?.await?.()'))
check('偏好存储键在源', clientSrc.includes("'dsh-portal.prefs'"))
check('内置图标集 12 个', (clientSrc.match(/ICON_SET = \[.*?\]/s) ?? [''])[0].split(',').length === 12)
check('对话用 selectPanel(null)', clientSrc.includes("=== 'conversation' ? null"))

// ---------- ①++ 增量：瀑布布局 + 底图池 + 资产目录 ----------
const hostSrc = readFileSync(new URL('../src/host/index.ts', import.meta.url), 'utf8')
check('瀑布布局计划函数在源', clientSrc.includes('planMasonry'))
check('底图洗牌分配在源', clientSrc.includes('assignBackdropPairs'))
{
  const pool = (clientSrc.match(/BACKDROP_POOL = \[[^\]]*\]/s) ?? [''])[0]
  const entries = pool.split(',').map(s => s.trim()).filter(s => /\.svg['"]?$/.test(s))
  const dark = (clientSrc.match(/BACKDROP_POOL_DARK = \[[^\]]*\]/s) ?? [''])[0]
  const darkEntries = dark.split(',').map(s => s.trim()).filter(s => /\.svg['"]?$/.test(s))
  check('底图池 亮/暗各 10 张（aurora 对）', entries.length === 10 && darkEntries.length === 10 && pool.includes('aurora-1.svg') && pool.includes('aurora-10.svg') && dark.includes('aurora-dark-1.svg') && dark.includes('aurora-dark-10.svg'))
}
check('卡片遮罩用主题面 color-mix', clientSrc.includes('color-mix'))
check('宿主含资产路由接线', hostSrc.includes("'/portal-assets'"))
{
  let backdrops = []
  try { backdrops = readdirSync(new URL('../assets/backdrops/', import.meta.url)).filter(f => f.endsWith('.svg')) } catch { backdrops = [] }
  check('资产目录 20 张 SVG（aurora 亮/暗各 10）', backdrops.length === 20
    && backdrops.filter(f => /^aurora-\d{1,2}\.svg$/.test(f)).length === 10
    && backdrops.filter(f => /^aurora-dark-\d{1,2}\.svg$/.test(f)).length === 10)
}
// v3 图标与主题样式（Lucide 内联线性图标，替代 emoji 默认；样式经注入 class 支持 hover/暗色底图切换）
check('图标集为内联 SVG（Lucide 路径在源）', clientSrc.includes('clapperboard') && clientSrc.includes('strokeWidth') && clientSrc.includes('panelGlyph') && clientSrc.includes('MANAGE_GLYPH'))
check('暗色底图走 CSS 变量切换', clientSrc.includes('--portal-bg-d') || clientSrc.includes('aurora-dark'))
check('卡片 hover/过渡经注入样式', clientSrc.includes('.portal-card:hover'))

// ---------- ② 宿主资产路由行为（捕获 register 的 route 后直驱 handler） ----------
const hostModule = await import('../lib/index.js')
check('宿主导出 apply 与 inject', typeof hostModule.apply === 'function' && Array.isArray(hostModule.inject))
const routes = []
const mockCtx = {
  provide: (name, value) => value,
  get: () => undefined,
  effect: (callback) => { callback(); return () => {} },
  webServer: { register: (route) => { routes.push(route); return () => {} } },
}
hostModule.apply(mockCtx)
const assetRoute = routes.find(r => r.path === '/portal-assets')
check('宿主注册 /portal-assets 路由（prefix）', assetRoute !== undefined && assetRoute.kind === 'prefix')
if (assetRoute === undefined || typeof assetRoute.handler !== 'function') {
  check('路由：合法资产 200 + svg mime', false)
  check('路由：路径穿越拒绝（404）', false)
  check('路由：不存在文件 404', false)
} else {
  const drive = (urlPath) => new Promise((resolve) => {
    const state = { code: 0, headers: null, body: Buffer.alloc(0) }
    const res = {
      writeHead: (code, headers) => { state.code = code; state.headers = headers ?? null },
      end: (body) => { if (body !== undefined) state.body = Buffer.isBuffer(body) ? body : Buffer.from(String(body)); resolve(state) },
      destroy: () => { state.code = 0; resolve(state) },
      on: () => {},
    }
    assetRoute.handler({ url: urlPath, method: 'GET', headers: {} }, res)
    setTimeout(() => resolve(state), 2000)
  })
  const okResp = await drive('/portal-assets/backdrops/aurora-1.svg')
  check('路由：合法资产 200 + svg mime', okResp.code === 200 && String(okResp.headers?.['content-type'] ?? '').includes('image/svg+xml') && okResp.body.length > 200)
  const travResp = await drive('/portal-assets/../package.json')
  check('路由：路径穿越拒绝（404）', travResp.code === 404)
  const missResp = await drive('/portal-assets/backdrops/nope.svg')
  check('路由：不存在文件 404', missResp.code === 404)
}

console.log(failed === 0 ? '自证全部通过' : `自证 ${failed} 项未通过`)
process.exit(failed === 0 ? 0 : 1)

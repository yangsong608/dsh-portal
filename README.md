# 工作台门户插件（dsh-portal）

DSH 的**门户插件**：启动 DSH 后先落到「工作台门户」——**双宽瀑布墙**（主卡 2 格宽高块、小卡 1 格矮块，按当前最矮列贪心铺排，列数随容器 2/3/4 自适应），主卡叠**极光底图**（亮/暗成对，随主题切换；进入门户随机分配、同屏不重样），卡片用**内联 Lucide 线性图标 + accent 图标砖**；点卡进入对应面板；左侧原有快捷菜单与其跳转完全不变。

- 状态：**已实施**（T1-T5 全链验收 + 瀑布流/底图增量 + v3 视觉改版；对应设计稿 `../docs/10-工作台门户插件设计稿.md`、实施计划 `../docs/11-工作台门户插件实施计划.md`）。
- 工程契约：照抄 `../../bjjy/模拟法庭插件`（双 tsdown 构建、客户端「模块工厂」三行壳、宿主产物不压缩）。
- 宿主半：占位日志 + 一张卡片底图静态路由（`/portal-assets/* → assets/`）；其余全部在浏览器半：卡片目录从 `ctx.slots.entries('main')` 动态枚举，配置存本机 localStorage。

## 目录

- `src/host/index.ts` 宿主半侧：占位日志 + `/portal-assets` 静态路由（白名单文件名、防目录穿越、404 兜底、svg mime + 缓存头）。
- `src/client/index.ts` 浏览器半侧：注册 `main` key=`portal` 面板 + `sidebar.panellist` id=`portal` 侧栏图标；启动选中落点（`loader.await` → `selectPanel('portal')`）；瀑布渲染 + 图标砖 + 主卡底图（CSS 变量亮/暗对切）/遮罩层；卡片点击跳转。
- `src/client/portal.ts` 卡片模型：`discoverCards`（枚举→卡片，排除门户自身；`icon` 空串=内置 SVG、非空=自定义覆盖）、描述字典、`planMasonry`（瀑布坐标）、`assignBackdropPairs`/`BACKDROP_POOL`/`BACKDROP_POOL_DARK`（亮/暗成对洗牌分配）、`readPrefs`/`writePrefs`、`ICON_SET`（12 个可选 emoji）。
- `src/client/icons.ts` 图标集：内联 Lucide 线性图标（message-circle/clapperboard/scale/file-text/puzzle/clock/layout-grid/settings）+ 每面板 accent 配色。
- `src/client/ui.ts` UI 基元：走 DSH `--dsw-*` token；`ensurePortalCss()` 注入卡片 hover/暗色底图/遮罩/图标砖样式（伪类与主题切换内联样式表达不了）。
- `assets/backdrops/` 20 张极光底图（亮 `aurora-1..10` + 暗 `aurora-dark-1..10`，同序号同色族，程序化 SVG）。
- `cordis.patch.yml` 安装后生效的插件行（`id: portal`，`name: dsh-portal`）。
- `scripts/gen-backdrops.mjs` 极光生成器（确定性种子，可重跑再生亮/暗各 10 张）。
- `scripts/verify-bundle.mjs` 自证：产物新鲜度门 + 产物形态 + 门户静态锚点 + 资产目录/路由行为（30 项，全 PASS 才算过）。

## 构建与自证

```bash
pnpm install
pnpm run bundle    # 产 lib/index.js（宿主，ESM 未压缩）与 lib/client.js（浏览器「模块工厂」包裹）
pnpm run verify    # 形态与静态锚点自证：30 项全 PASS、退出码 0 才算过
```

## 安装进 DSH（开发验证用）

在 DSH 目标 profile（如 `deepseek-harness/apps/desktop/.desktop-build/development/home/profiles/desktop/`）中：

1. `package.json` 的 `dependencies` 加 `"dsh-portal": "link:<本目录绝对路径>"`，`dsh.profile.bundles` 数组追加 `"dsh-portal"`；
2. 该 profile 目录 `pnpm install`；
3. 重启桌面（`pnpm run start:desktop`，工作目录 `deepseek-harness/`）。

启动日志出现 `[dsh-portal] host half loaded`；界面侧栏出现「门户」图标（order 置最前），启动即落门户页。

## 行为

- **启动落门户**：每次启动（不做「记住上次」）等装载就绪后抢选中门户；时序异常时放弃抢占（不报错），经侧栏图标可进入。
- **点卡跳转**：整卡热区，主/小卡行为一致；「对话」卡走 `selectPanel(null)`（官方回会话语义），其余取卡 key（`selectPanel(key)`）；失败仅 console.warn。
- **侧栏门户图标**：新增「门户」图标可随时回门户；其余侧栏图标与其跳转一个不动。
- **管理卡片**：门户页右上「管理卡片」（齿轮为内联 SVG）进入管理态（该按钮变「✓ 完成」）——每卡右下浮出「设主卡 / 改小卡」与「换图标」；「换图标」弹层 = 内置 12 图标集 + 「或直接输入任意 emoji / 字符」输入框 + 「确定」。所有更改即时生效、即时写入本机存储。
- **默认分类**：对话 / 短剧工坊 / 模拟法庭 = 主卡（2 格宽高块），其余已装面板 = 小卡（1 格矮块）；卡片集合随面板注册变化（插件启停/HMR）动态跟随。
- **瀑布墙**：总宽 640 居中；列数随容器宽度自适应（窄 2 / 中 3 / 宽 4，640 下为 3 列）；**主卡先落位、小卡后填**，再按「当前最矮列」贪心铺排——同列卡片竖向紧邻（间距=网格 gap 12px，无大空隙）。
- **卡片底图（v3 极光）**：仅主卡带底图——10 组亮/暗成对（同序号同色族）随机分配、同屏不重样，经 CSS 变量随主题切换（`aurora-N` ↔ `aurora-dark-N`）；底图上覆主题遮罩（`color-mix` 主题面 52%，明暗自适应），小卡回归纯面。每次进入门户重新随机。
- **图标（v3）**：默认内置内联 Lucide 线性图标 + accent 色图标砖（12% 透明底，随主题提亮）；「换图标」设为任意 emoji/字符后按自定义覆盖渲染。
- **卡片观感（v3）**：圆角 20、发丝描边（label 10% → hover 20%）、hover 上浮 2px（150ms 过渡），排版 Ant 中文规范（页题 18/600、卡名 15(14)/500、描述 13/1.6）。

## 配置存储与复位

- 配置存本机 `localStorage['dsh-portal.prefs']`，结构 `{ "cardKinds": { "面板key": "main" | "small" }, "iconOverrides": { "面板key": "图标" } }`。
- 复位方法：删除该项即可回到默认态（默认分类 + 默认图标）：

```js
localStorage.removeItem('dsh-portal.prefs')
```

- 注意桌面端为**懒提交**（写入后约数秒才落 leveldb）；若要「改配置后立即重启进程验证」，请留数秒落盘窗口再重启，否则未提交写入会丢（进程正常退出不受影响）。

## 边界

| 情形 | 行为 |
|---|---|
| 插件未安装 | 不出现卡片、不出现侧栏图标（无置灰态） |
| 面板 key 无侧栏 label | 名称回退内置中文表（如对话），再回退裸 key |
| localStorage 不可用 | 读回默认、写静默失败，不报错、不阻塞 |
| 启动时序异常 | 重试后放弃抢占（不报错），侧栏图标兜底可进门户 |
| 底图路由/文件不可用 | 主卡无底图降级（卡底色兜底，遮罩与文字照常），不报错 |
| 插件被禁用/卸载 | 回归 DSH 原状（启动落点=会话），零残留（无宿主数据、无写盘） |

## 硬约束

- 宿主产物禁止压缩；客户端禁止打包 react 等基线九模块（只从宿主取）。
- 样式全走 DSH token（`--dsw-*`），不硬编码色值（弹层/按钮/卡片描边与遮罩同口径；唯一例外：图标 accent 为面板身份色、底图为生成资产，均非主题色）。
- 无业务写盘：唯一持久面为浏览器 localStorage 键 `dsh-portal.prefs`；宿主仅注册只读静态路由。

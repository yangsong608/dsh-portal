window.__ModuleLoader__.load({
	id: "dsh-portal",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/portal.ts
		const PREFS_STORAGE_KEY = "dsh-portal.prefs";
		/** 内置图标集（管理态「换图标」一排 12 个）。 */
		const ICON_SET = [
			"💬",
			"🗨️",
			"🤖",
			"⚡",
			"🧠",
			"📚",
			"⚖️",
			"🏛️",
			"🛡️",
			"📜",
			"🎓",
			"🔍"
		];
		/** 无侧栏 label 的内建面板的中文名回退（当前仅对话；其余已装面板均自带侧栏 label）。 */
		const LABELS = { conversation: "对话" };
		/** 默认主卡（其余默认小卡）。 */
		const DEFAULT_MAIN = [
			"conversation",
			"duanju",
			"syjy"
		];
		/** 已知面板的一句描述；未知 key 无描述。默认图标（Lucide 内联 SVG）见 icons.ts 的 panelGlyph。 */
		const DICT = {
			conversation: { desc: "与 AI 助手对话、跑任务" },
			duanju: { desc: "梗概 · 剧本 · 分镜生成流水线" },
			syjy: { desc: "立案 · 庭审 · 文书 · 案件库" },
			"file-editor": { desc: "文件编辑器" },
			plugins: { desc: "插件管理" },
			schedules: { desc: "自动化任务" }
		};
		function readPrefs() {
			try {
				const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
				if (raw === null) return {
					cardKinds: {},
					iconOverrides: {}
				};
				const parsed = JSON.parse(raw);
				return {
					cardKinds: typeof parsed.cardKinds === "object" && parsed.cardKinds !== null ? parsed.cardKinds : {},
					iconOverrides: typeof parsed.iconOverrides === "object" && parsed.iconOverrides !== null ? parsed.iconOverrides : {}
				};
			} catch {
				return {
					cardKinds: {},
					iconOverrides: {}
				};
			}
		}
		function writePrefs(prefs) {
			try {
				window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
			} catch {}
		}
		/** icon 为空串表示用内置 SVG 图标；非空则按其字面渲染（任意 emoji / 字符的自定义覆盖）。 */
		function discoverCards(entries, prefs) {
			return entries.filter((entry) => entry.key !== "portal").map((entry) => {
				const dict = DICT[entry.key];
				return {
					key: entry.key,
					label: entry.label === "" ? entry.key : entry.label,
					icon: prefs.iconOverrides[entry.key] ?? "",
					description: dict?.desc ?? "",
					kind: prefs.cardKinds[entry.key] ?? (DEFAULT_MAIN.includes(entry.key) ? "main" : "small")
				};
			});
		}
		/** 4 列基准：主卡横跨 2 列、占 7 个单元行；小卡 1 列、占 4 个单元行（与 ui 的 14px 行高配）。 */
		const MAIN_COL_SPAN = 2;
		const MAIN_ROW_SPAN = 7;
		const SMALL_ROW_SPAN = 4;
		/**
		* 贪心瀑布铺排：依次放到"当前最矮的那一列"（比较各可用起始列的占位高度）。
		* 落位序 = 主卡先、小卡后（同序内保持原相对顺序），随后再把小卡填进主卡留下的空位——
		* 宽卡（2 格）要求相邻两列同时腾空，先放小卡会在窄列造成大空洞；主卡先行即无洞。
		* 返回按**原始卡片顺序**对齐的 0 基网格坐标（直接映射为 CSS grid-column/grid-row）。
		*/
		function planMasonry(cards, columns) {
			const colCount = Math.max(1, Math.floor(columns));
			const heights = new Array(colCount).fill(0);
			const cells = new Array(cards.length);
			const order = cards.map((card, index) => ({
				card,
				index
			})).sort((a, b) => a.card.kind === b.card.kind ? a.index - b.index : a.card.kind === "main" ? -1 : 1);
			for (const { card, index } of order) {
				const colSpan = card.kind === "main" ? Math.min(MAIN_COL_SPAN, colCount) : 1;
				const rowSpan = card.kind === "main" ? MAIN_ROW_SPAN : SMALL_ROW_SPAN;
				let bestCol = 0;
				let bestBase = Number.POSITIVE_INFINITY;
				for (let start = 0; start + colSpan <= colCount; start += 1) {
					let base = 0;
					for (let i = start; i < start + colSpan; i += 1) base = Math.max(base, heights[i]);
					if (base < bestBase) {
						bestBase = base;
						bestCol = start;
					}
				}
				for (let i = bestCol; i < bestCol + colSpan; i += 1) heights[i] = bestBase + rowSpan;
				cells[index] = {
					col: bestCol,
					colSpan,
					row: bestBase,
					rowSpan
				};
			}
			return cells;
		}
		/** 亮色极光池（文件在 assets/backdrops/，经 /portal-assets 路由取用）。 */
		const BACKDROP_POOL = [
			"aurora-1.svg",
			"aurora-2.svg",
			"aurora-3.svg",
			"aurora-4.svg",
			"aurora-5.svg",
			"aurora-6.svg",
			"aurora-7.svg",
			"aurora-8.svg",
			"aurora-9.svg",
			"aurora-10.svg"
		];
		/** 暗色极光池：与亮色池同序号同色族（切主题不掉色相）。 */
		const BACKDROP_POOL_DARK = [
			"aurora-dark-1.svg",
			"aurora-dark-2.svg",
			"aurora-dark-3.svg",
			"aurora-dark-4.svg",
			"aurora-dark-5.svg",
			"aurora-dark-6.svg",
			"aurora-dark-7.svg",
			"aurora-dark-8.svg",
			"aurora-dark-9.svg",
			"aurora-dark-10.svg"
		];
		const BACKDROP_URL_BASE = "/portal-assets/backdrops/";
		/**
		* 洗牌分配（亮/暗成对）：每轮把序号洗匀后依序发卡，同屏不重样；卡数超过池大小时续池再洗
		* （并避免新一轮首张与上一轮尾张撞图）。同序号亮暗成对 → 主题切换时色相保持。
		* 每次进门户（组件挂载）调用一次即"随机加载"。
		*/
		function assignBackdropPairs(count, lightPool = BACKDROP_POOL, darkPool = BACKDROP_POOL_DARK, random = Math.random) {
			const out = [];
			if (lightPool.length === 0 || count <= 0) return out;
			while (out.length < count) {
				const bag = lightPool.map((_, index) => index);
				for (let i = bag.length - 1; i > 0; i -= 1) {
					const j = Math.floor(random() * (i + 1));
					const swap = bag[i];
					bag[i] = bag[j];
					bag[j] = swap;
				}
				if (out.length > 0 && bag.length > 1 && lightPool[bag[0]] === out[out.length - 1].light) {
					const swap = bag[0];
					bag[0] = bag[1];
					bag[1] = swap;
				}
				for (const index of bag) out.push({
					light: lightPool[index],
					dark: darkPool[index % Math.max(1, darkPool.length)] ?? lightPool[index]
				});
			}
			return out.slice(0, count);
		}
		//#endregion
		//#region src/client/icons.ts
		const STROKE_GLYPHS = {
			conversation: [{
				tag: "path",
				d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
			}],
			duanju: [
				{
					tag: "path",
					d: "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"
				},
				{
					tag: "path",
					d: "m6.2 5.3 3.1 3.9"
				},
				{
					tag: "path",
					d: "m12.4 3.4 3.1 4"
				},
				{
					tag: "path",
					d: "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
				}
			],
			syjy: [
				{
					tag: "path",
					d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"
				},
				{
					tag: "path",
					d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"
				},
				{
					tag: "path",
					d: "M7 21h10"
				},
				{
					tag: "path",
					d: "M12 3v18"
				},
				{
					tag: "path",
					d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"
				}
			],
			"file-editor": [
				{
					tag: "path",
					d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
				},
				{
					tag: "path",
					d: "M14 2v4a2 2 0 0 0 2 2h4"
				},
				{
					tag: "path",
					d: "M10 9H8"
				},
				{
					tag: "path",
					d: "M16 13H8"
				},
				{
					tag: "path",
					d: "M16 17H8"
				}
			],
			plugins: [{
				tag: "path",
				d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"
			}],
			schedules: [{
				tag: "circle",
				cx: 12,
				cy: 12,
				r: 10
			}, {
				tag: "polyline",
				points: "12 6 12 12 16 14"
			}]
		};
		/** 未知面板的通用图标（Lucide layout-grid）。 */
		const FALLBACK_GLYPH = [
			{
				tag: "rect",
				width: 7,
				height: 7,
				x: 3,
				y: 3,
				rx: 1
			},
			{
				tag: "rect",
				width: 7,
				height: 7,
				x: 14,
				y: 3,
				rx: 1
			},
			{
				tag: "rect",
				width: 7,
				height: 7,
				x: 14,
				y: 14,
				rx: 1
			},
			{
				tag: "rect",
				width: 7,
				height: 7,
				x: 3,
				y: 14,
				rx: 1
			}
		];
		const ACCENTS = {
			conversation: "#4176e6",
			duanju: "#d98324",
			syjy: "#5b6f95",
			"file-editor": "#3f9d6e",
			plugins: "#8b6bc9",
			schedules: "#3fa3b5"
		};
		const FALLBACK_ACCENT = "#7a8290";
		/** 取某面板的内置图标（未知 key 用通用图标与中性 accent）。 */
		function panelGlyph(key) {
			return {
				accent: ACCENTS[key] ?? FALLBACK_ACCENT,
				elements: STROKE_GLYPHS[key] ?? FALLBACK_GLYPH
			};
		}
		/** 管理入口按钮图标（Lucide settings）。 */
		const MANAGE_GLYPH = [{
			tag: "path",
			d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
		}, {
			tag: "circle",
			cx: 12,
			cy: 12,
			r: 3
		}];
		//#endregion
		//#region src/client/ui.ts
		/**
		* 浏览器半 UI 基元（v3）：全部走 DSH 的 --dsw-* token（双主题自适应），
		* 颜色/圆角/字体不硬编码（唯一例外：每个面板的图标强调色，属面板身份色而非主题色）。
		* 卡片口径照 dsh-codex-ui：半透明面 + 发丝描边（label 10%）+ 圆角 20 + hover 只加描边/轻浮；
		* 排版照 Ant 中文规范：页题 18/600、卡名 15(14)/500、描述 13/1.6。
		* 伪类/主题切换等静态 CSS 经 ensurePortalCss() 注入（内联样式无法表达 hover 与暗色底图切换）。
		*/
		const T = {
			bg: "var(--dsw-alias-bg-base)",
			panel: "var(--dsw-alias-bg-layer-1)",
			border: "var(--dsw-alias-border-l2)",
			borderFaint: "var(--dsw-alias-border-l1)",
			label: "var(--dsw-alias-label-primary)",
			label2: "var(--dsw-alias-label-secondary)",
			caption: "var(--dsw-alias-label-caption)",
			onBrand: "var(--dsw-alias-brand-primary-invert)",
			btn: "var(--dsw-alias-button-primary-fill)",
			btnDanger: "var(--dsw-alias-state-error-primary)",
			radiusSm: "var(--dsw-radius-sm)",
			radiusMd: "var(--dsw-radius-md)",
			font: "var(--dsw-font-family)"
		};
		const CSS_ID = "dsh-portal-theme-css";
		/**
		* 注入门户静态样式（幂等）：卡片描边/hover、底图亮暗切换、遮罩、图标砖。
		* 亮暗切换跟随 DSH 真开关 body[data-ds-dark-theme]；颜色一律 token 合成（color-mix），不写死色值。
		*/
		function ensurePortalCss() {
			if (typeof document === "undefined") return;
			if (document.getElementById(CSS_ID) !== null) return;
			const el = document.createElement("style");
			el.id = CSS_ID;
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
`;
			document.head.appendChild(el);
		}
		/** 卡片底色/描边/投影口径（B 卡片）：与 syjy 同款取值。 */
		const style = {
			/** 居中容器：门户整页（总宽 640、居中、超高滚动）。 */
			page: {
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				width: "100%",
				maxWidth: "640px",
				height: "100%",
				margin: "0 auto",
				padding: "24px 20px",
				boxSizing: "border-box",
				fontFamily: T.font,
				fontSize: "13px",
				color: T.label,
				background: T.bg,
				overflowY: "auto"
			},
			/** 顶部轻标题行：左「工作台」、右按钮区。 */
			titleRow: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "8px"
			},
			/** 页题（Ant：18/600）。 */
			title: {
				fontSize: "18px",
				fontWeight: 600,
				color: T.label,
				lineHeight: 1.4
			},
			/** 瀑布墙网格：列数由 --portal-cols 注入（随容器宽度 2/3/4），单元行高 12、间距 12。 */
			masonry: {
				display: "grid",
				gridTemplateColumns: "repeat(var(--portal-cols, 4), minmax(0, 1fr))",
				gridAutoRows: "12px",
				gap: "12px",
				alignContent: "start"
			},
			/** 卡片基底（主/小共用）：描边/圆角/hover 走 .portal-card 注入样式；overflow 裁切底图圆角。 */
			cell: {
				position: "relative",
				overflow: "hidden",
				display: "flex",
				alignItems: "center",
				cursor: "pointer"
			},
			/** 主卡：2 格宽高块（大图标砖 + 名称 + 一句描述）；底色照 DSH 面板面（底图加载失败时的兜底）。 */
			cellMain: {
				padding: "0 18px",
				gap: "12px",
				background: T.panel
			},
			/** 小卡：1 格矮块（小图标砖 + 名称）。 */
			cellSmall: {
				padding: "0 14px",
				gap: "10px",
				background: T.panel
			},
			/** 内容层：压在底图与遮罩之上（z 2 > hover 罩层 z 1）。 */
			cardInner: {
				position: "relative",
				zIndex: 2,
				display: "flex",
				gap: "12px",
				alignItems: "center",
				width: "100%",
				height: "100%"
			},
			/** 图标砖（主卡 40/12 圆角 + 主卡图标 20；颜色走 --portal-accent + .portal-tile 注入样式）。 */
			tileMain: {
				width: "40px",
				height: "40px",
				borderRadius: T.radiusMd,
				flex: "none",
				fontSize: "20px",
				lineHeight: 1
			},
			/** 小卡图标砖 32/10 圆角 + 图标 16。 */
			tileSmall: {
				width: "32px",
				height: "32px",
				borderRadius: "10px",
				flex: "none",
				fontSize: "15px",
				lineHeight: 1
			},
			nameMain: {
				fontSize: "15px",
				fontWeight: 500,
				color: T.label,
				lineHeight: 1.4
			},
			nameSmall: {
				fontSize: "14px",
				fontWeight: 500,
				color: T.label,
				lineHeight: 1.4
			},
			desc: {
				fontSize: "13px",
				color: T.label2,
				lineHeight: 1.6,
				marginTop: "3px"
			},
			caption: {
				color: T.caption,
				fontSize: "11px"
			}
		};
		const button = {
			primary: {
				padding: "6px 16px",
				fontSize: "13px",
				borderRadius: T.radiusSm,
				cursor: "pointer",
				background: T.btn,
				color: T.onBrand,
				border: "none",
				fontFamily: T.font
			},
			normal: {
				padding: "5px 12px",
				fontSize: "13px",
				borderRadius: "10px",
				cursor: "pointer",
				display: "inline-flex",
				alignItems: "center",
				gap: "6px",
				background: "transparent",
				color: T.label2,
				border: "1px solid color-mix(in srgb, " + T.label + " 12%, transparent)",
				fontFamily: T.font
			},
			danger: {
				padding: "6px 14px",
				fontSize: "13px",
				borderRadius: T.radiusSm,
				cursor: "pointer",
				background: "transparent",
				color: T.btnDanger,
				border: `1px solid ${T.btnDanger}`,
				fontFamily: T.font
			},
			ghost: {
				padding: "4px 10px",
				fontSize: "12px",
				borderRadius: T.radiusSm,
				cursor: "pointer",
				background: "transparent",
				color: T.label2,
				border: "none",
				fontFamily: T.font
			},
			small: {
				padding: "3px 10px",
				fontSize: "12px",
				borderRadius: T.radiusSm,
				cursor: "pointer",
				background: "transparent",
				color: T.label2,
				border: `1px solid ${T.border}`,
				fontFamily: T.font
			}
		};
		//#endregion
		//#region src/client/index.ts
		/**
		* 浏览器半入口：工作台门户面板 + 侧栏图标 + 管理态（主/小卡切换、换图标、持久化）。
		*/
		const PANEL_ID = "portal";
		const h = react.createElement;
		/** Lucide 线性图标（内联 SVG）：stroke 随 currentColor，颜色/底色由 .portal-tile 注入样式给。 */
		function glyphSvg(elements, size, strokeWidth) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true"
			}, elements.map((el, index) => {
				const { tag, ...attrs } = el;
				return h(tag, {
					key: index,
					...attrs
				});
			}));
		}
		/** 侧栏同位 id 的 label（函数则调用；取不到/为空/抛错回退 LABELS 内置表，再回退 key）。 */
		function sidebarLabel(sidebarEntries, key) {
			try {
				const label = sidebarEntries.find((entry) => entry.options.id === key)?.options.label;
				const resolved = typeof label === "function" ? label() : label;
				if (typeof resolved === "string" && resolved !== "") return resolved;
			} catch (cause) {
				console.warn(`[dsh-portal] 侧栏标签读取失败（回退内置名）：${String(cause)}`);
			}
			return LABELS[key] ?? key;
		}
		/** 弹层宽固定；高为初值（翻转判定），挂载后按实测再在视口内夹取。 */
		const PICKER_WIDTH = 300;
		const PICKER_EST_HEIGHT = 120;
		/** 管理态与弹层局部样式（全走 DSH `--dsw-*` token，无硬编码色值）。 */
		const chrome = {
			/** 卡片右下管理控件组（仅管理态渲染；zIndex 2 压在底图/内容层之上）。 */
			controls: {
				position: "absolute",
				right: "6px",
				bottom: "6px",
				zIndex: 2,
				display: "flex",
				gap: "4px",
				alignItems: "center"
			},
			controlBtn: {
				padding: "2px 7px",
				fontSize: "10px",
				lineHeight: "1.5",
				borderRadius: T.radiusSm,
				cursor: "pointer",
				background: T.panel,
				color: T.label2,
				border: `1px solid ${T.border}`,
				fontFamily: T.font
			},
			/** 换图标弹层：卡下方（锚点按钮下方）一排图标集 + 一行任意字符输入 +「确定」。 */
			picker: {
				position: "fixed",
				zIndex: 1e3,
				width: `${PICKER_WIDTH}px`,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				padding: "10px",
				background: T.panel,
				border: `1px solid ${T.border}`,
				borderRadius: "10px",
				boxShadow: "var(--dsw-elevation-panel, none)",
				fontFamily: T.font
			},
			chipRow: {
				display: "grid",
				gridTemplateColumns: "repeat(6, 1fr)",
				gap: "4px"
			},
			chip: {
				padding: "3px 0",
				fontSize: "15px",
				lineHeight: "1.3",
				textAlign: "center",
				borderRadius: T.radiusSm,
				cursor: "pointer",
				background: "transparent",
				color: T.label,
				border: `1px solid ${T.borderFaint}`,
				fontFamily: T.font
			},
			iconRow: {
				display: "flex",
				gap: "6px",
				alignItems: "center"
			},
			iconInput: {
				flex: "1 1 auto",
				minWidth: "0",
				padding: "4px 8px",
				fontSize: "12px",
				borderRadius: T.radiusSm,
				border: `1px solid ${T.border}`,
				background: "transparent",
				color: T.label,
				fontFamily: T.font
			}
		};
		/** 卡片右下管理控件（仅管理态渲染）：小卡「设主卡」/ 主卡「改小卡」+「换图标」。 */
		function cardControls(card, face) {
			if (!face.managing) return null;
			return h("div", {
				key: "controls",
				style: chrome.controls
			}, h("button", {
				key: "kind",
				type: "button",
				style: chrome.controlBtn,
				onClick: (event) => {
					event.stopPropagation();
					face.toggleKind(card);
				}
			}, card.kind === "main" ? "改小卡" : "设主卡"), h("button", {
				key: "icon",
				type: "button",
				style: chrome.controlBtn,
				"data-portal-anchor": card.key,
				onClick: (event) => {
					event.stopPropagation();
					face.toggleIcons(card.key, event.currentTarget);
				}
			}, "换图标"));
		}
		/**
		* 瀑布墙卡片：主卡=极光底图 + 主题遮罩 + 图标砖 + 名称 + 一句描述；小卡=纯面 + 图标砖 + 名称。
		* 底图亮/暗成对经 CSS 变量（--portal-bg-l/--portal-bg-d）由 .portal-bg 按主题切换。
		* 网格坐标来自 planMasonry，点击跳转对应面板。
		*/
		function portalCard(card, cell, backdrop, select, face) {
			const isMain = card.kind === "main";
			const glyph = panelGlyph(card.key);
			const tileStyle = {
				...isMain ? style.tileMain : style.tileSmall,
				"--portal-accent": glyph.accent
			};
			const icon = card.icon !== "" ? h("span", {
				key: "icon",
				className: "portal-glyph portal-tile",
				style: tileStyle
			}, card.icon) : h("span", {
				key: "icon",
				className: "portal-glyph portal-tile",
				style: tileStyle
			}, glyphSvg(glyph.elements, isMain ? 20 : 16, 1.75));
			return h("div", {
				key: card.key,
				className: "portal-card",
				style: {
					...style.cell,
					...isMain ? style.cellMain : style.cellSmall,
					gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
					gridRow: `${cell.row + 1} / span ${cell.rowSpan}`
				},
				onClick: () => select(card.key)
			}, isMain ? h("div", {
				key: "bg",
				className: "portal-bg",
				style: {
					"--portal-bg-l": `url(${BACKDROP_URL_BASE}${backdrop.light})`,
					"--portal-bg-d": `url(${BACKDROP_URL_BASE}${backdrop.dark})`
				}
			}) : null, isMain ? h("div", {
				key: "scrim",
				className: "portal-scrim"
			}) : null, h("div", {
				key: "inner",
				style: style.cardInner
			}, icon, isMain ? h("div", { key: "text" }, h("div", {
				key: "name",
				style: style.nameMain
			}, card.label), card.description === "" ? null : h("div", {
				key: "desc",
				style: style.desc
			}, card.description)) : h("span", {
				key: "name",
				style: style.nameSmall
			}, card.label)), cardControls(card, face));
		}
		function PortalPanel(props) {
			const [managing, setManaging] = (0, react.useState)(false);
			const [prefs, setPrefs] = (0, react.useState)(() => readPrefs());
			const [picker, setPicker] = (0, react.useState)(null);
			const [iconDraft, setIconDraft] = (0, react.useState)("");
			const [columns, setColumns] = (0, react.useState)(4);
			const pickerRef = (0, react.useRef)(null);
			const wrapRef = (0, react.useRef)(null);
			const backdropsRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (picker === null) return void 0;
				const onDocumentClick = (event) => {
					const target = event.target;
					if (target !== null && target.closest("[data-portal-anchor]") !== null) return;
					const node = pickerRef.current;
					if (node !== null && node.contains(event.target)) return;
					setPicker(null);
				};
				document.addEventListener("click", onDocumentClick);
				return () => {
					document.removeEventListener("click", onDocumentClick);
				};
			}, [picker]);
			(0, react.useEffect)(() => {
				if (picker === null) return void 0;
				const node = pickerRef.current;
				if (node === null) return void 0;
				const height = node.getBoundingClientRect().height;
				if (height <= 0 || picker.top + height <= window.innerHeight - 8) return void 0;
				const top = Math.max(8, window.innerHeight - 8 - height);
				setPicker((prev) => prev === null || prev.top === top ? prev : {
					...prev,
					top
				});
			}, [picker]);
			(0, react.useEffect)(() => {
				const el = wrapRef.current;
				const compute = (width) => setColumns(width < 500 ? 2 : width < 620 ? 3 : 4);
				compute(el?.clientWidth ?? window.innerWidth);
				if (el === null || typeof ResizeObserver === "undefined") return void 0;
				const observer = new ResizeObserver((entries) => {
					const width = entries[0]?.contentRect.width ?? el.clientWidth;
					compute(width);
				});
				observer.observe(el);
				return () => observer.disconnect();
			}, []);
			/** 写入并即时生效：本地 state 触发重渲染，localStorage 供跨刷新/重启保持。 */
			const applyPrefs = (next) => {
				writePrefs(next);
				setPrefs(next);
			};
			const toggleKind = (card) => {
				const next = card.kind === "main" ? "small" : "main";
				applyPrefs({
					...prefs,
					cardKinds: {
						...prefs.cardKinds,
						[card.key]: next
					}
				});
				setPicker(null);
				setIconDraft("");
			};
			/** 选中/确定（非空即暂存）：写入 iconOverrides、卡图标立即更新、弹层关闭。 */
			const pickIcon = (key, value) => {
				const icon = value.trim();
				if (icon === "") return;
				applyPrefs({
					...prefs,
					iconOverrides: {
						...prefs.iconOverrides,
						[key]: icon
					}
				});
				setPicker(null);
				setIconDraft("");
			};
			/** 开/合弹层：再次点同一「换图标」即关闭；位置取锚点按钮 rect，在视口内夹取。 */
			const toggleIcons = (key, anchor) => {
				if (picker !== null && picker.key === key) {
					setPicker(null);
					setIconDraft("");
					return;
				}
				const rect = anchor === null ? null : anchor.getBoundingClientRect();
				const fitsBelow = rect === null || rect.bottom + 6 + PICKER_EST_HEIGHT <= window.innerHeight - 8;
				const top = rect === null ? 120 : fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - PICKER_EST_HEIGHT);
				const left = rect === null ? 24 : Math.min(Math.max(rect.left, 12), Math.max(12, window.innerWidth - PICKER_WIDTH - 12));
				setIconDraft("");
				setPicker({
					key,
					top,
					left
				});
			};
			/** 换图标弹层：一排图标集（点即选）+ 一行任意 emoji/字符输入 +「确定」（非空即暂存）。 */
			const renderPicker = (state) => h("div", {
				key: "portal-icon-picker",
				ref: pickerRef,
				style: {
					...chrome.picker,
					top: `${state.top}px`,
					left: `${state.left}px`
				}
			}, h("div", {
				key: "chips",
				style: chrome.chipRow
			}, ICON_SET.map((icon) => h("button", {
				key: icon,
				type: "button",
				style: chrome.chip,
				title: icon,
				onClick: () => pickIcon(state.key, icon)
			}, icon))), h("div", {
				key: "input-row",
				style: chrome.iconRow
			}, h("input", {
				key: "icon-input",
				type: "text",
				value: iconDraft,
				placeholder: "或直接输入任意 emoji / 字符",
				"aria-label": "或直接输入任意 emoji / 字符",
				style: chrome.iconInput,
				onChange: (event) => setIconDraft(event.target.value)
			}), h("button", {
				key: "icon-confirm",
				type: "button",
				style: button.small,
				onClick: () => pickIcon(state.key, iconDraft)
			}, "确定")));
			const sidebarEntries = props.sidebarEntries?.() ?? [];
			const cards = discoverCards((props.entries?.() ?? []).map((entry) => String(entry.options.key ?? "")).filter((key) => key !== "").map((key) => ({
				key,
				label: sidebarLabel(sidebarEntries, key)
			})), prefs);
			const select = (key) => {
				props.selectCard?.(key);
			};
			const face = {
				managing,
				toggleKind,
				toggleIcons
			};
			if (backdropsRef.current === null || backdropsRef.current.length < cards.length) backdropsRef.current = assignBackdropPairs(Math.max(cards.length, 20));
			const backdrops = backdropsRef.current;
			const fallback = {
				light: BACKDROP_POOL[0] ?? "",
				dark: BACKDROP_POOL_DARK[0] ?? ""
			};
			const cells = planMasonry(cards, columns);
			return h("div", {
				key: "portal-root",
				style: style.page
			}, h("div", {
				key: "portal-title-row",
				style: style.titleRow
			}, h("span", {
				key: "portal-title",
				style: style.title
			}, "工作台"), h("button", {
				key: "portal-manage",
				type: "button",
				style: button.normal,
				onClick: () => {
					setManaging((prev) => !prev);
					setPicker(null);
					setIconDraft("");
				}
			}, managing ? "✓ 完成" : [h("span", {
				key: "manage-glyph",
				className: "portal-glyph"
			}, glyphSvg(MANAGE_GLYPH, 14, 2)), "管理卡片"])), h("div", {
				key: "portal-grid",
				ref: wrapRef,
				style: {
					...style.masonry,
					"--portal-cols": String(columns)
				}
			}, cards.map((card, index) => portalCard(card, cells[index] ?? {
				col: 0,
				colSpan: 1,
				row: index * 4,
				rowSpan: 4
			}, backdrops[index] ?? fallback, select, face))), picker === null ? null : renderPicker(picker));
		}
		function PortalIcon() {
			return h("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}, h("path", {
				key: "roof",
				d: "M2.5 7.5 8 2.5l5.5 5"
			}), h("path", {
				key: "body",
				d: "M4 7v6h8V7"
			}));
		}
		const inject = ["slots", "layout"];
		function apply(ctx) {
			ensurePortalCss();
			/** 卡片点击跳转：对话走官方 selectPanel(null)，其余取卡 key；失败只警告。 */
			const selectCard = (key) => {
				try {
					ctx.layout?.selectPanel(key === "conversation" ? null : key);
				} catch (cause) {
					console.warn("[dsh-portal] 面板跳转失败：", String(cause));
				}
			};
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				inject: () => ({
					entries: () => ctx.slots.entries("main"),
					sidebarEntries: () => ctx.slots.entries("sidebar.panellist"),
					selectCard
				})
			}, PortalPanel));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 0,
				label: () => "门户"
			}, PortalIcon));
			(async () => {
				try {
					try {
						await ctx.loader?.await?.();
					} catch {}
					for (let i = 0; i < 20; i += 1) {
						if (ctx.slots.entries("main").some((entry) => entry.options.key === PANEL_ID)) break;
						await new Promise((resolve) => setTimeout(resolve, 100));
					}
					try {
						ctx.layout?.selectPanel(PANEL_ID);
					} catch (cause) {
						console.warn(`[dsh-portal] 启动选中门户失败（可从侧栏进入）：${String(cause)}`);
					}
				} catch (cause) {
					console.warn(`[dsh-portal] 启动落点轮询异常（忽略，可从侧栏进入）：${String(cause)}`);
				}
			})();
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

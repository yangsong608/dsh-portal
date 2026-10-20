import { readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
//#region src/host/index.ts
/**
* 宿主半侧：工作台门户——纯客户端功能 + 一张卡片底图静态路由（/portal-assets/* → assets/）。
* 路由只放行「可选单层 backdrops/ 前缀 + 白名单文件名」，目录穿越与未知文件一律 404。
*/
const ASSETS_DIR = fileURLToPath(new URL("../assets/", import.meta.url));
const ROUTE_PATH = "/portal-assets";
const MIME = {
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp"
};
/** 安全路径：可选单层 backdrops/ 前缀 + 白名单文件名（文件名不含点号，天然拒绝 `..` 穿越）。 */
const SAFE_PATH = /^(?:backdrops\/)?[a-z0-9][a-z0-9-]*\.(svg|png|jpg|webp)$/;
const inject = ["webServer"];
function notFound(res) {
	res.writeHead(404);
	res.end();
}
/** /portal-assets/<rel>：白名单校验 → 读文件 → 200（mime + 缓存头）；一切异常 404。 */
function serveAsset(req, res) {
	let rel = "";
	try {
		const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
		rel = decodeURIComponent(pathname.slice(15));
	} catch {
		notFound(res);
		return;
	}
	if (!SAFE_PATH.test(rel)) {
		notFound(res);
		return;
	}
	const full = join(ASSETS_DIR, rel);
	if (!full.startsWith(ASSETS_DIR.endsWith(sep) ? ASSETS_DIR : ASSETS_DIR + sep)) {
		notFound(res);
		return;
	}
	let body;
	try {
		body = readFileSync(full);
	} catch {
		notFound(res);
		return;
	}
	const ext = rel.slice(rel.lastIndexOf("."));
	res.writeHead(200, {
		"content-type": MIME[ext] ?? "application/octet-stream",
		"cache-control": "public, max-age=3600",
		"x-content-type-options": "nosniff"
	});
	res.end(body);
}
function apply(ctx) {
	console.log("[dsh-portal] host half loaded（门户为纯客户端插件 + 卡片底图资产路由）");
	const webServer = ctx.webServer ?? (typeof ctx.get === "function" ? ctx.get("webServer", false) : void 0);
	if (webServer === void 0 || typeof webServer.register !== "function") {
		console.warn("[dsh-portal] webServer 不可用：卡片底图路由未注册（门户其余功能不受影响）");
		return;
	}
	const route = {
		kind: "prefix",
		path: ROUTE_PATH,
		handler: serveAsset
	};
	if (typeof ctx.effect === "function") ctx.effect(() => webServer.register(route), "portal: /portal-assets route");
	else webServer.register(route);
}
//#endregion
export { apply, inject };

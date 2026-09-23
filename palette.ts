/**
 * 配色表 + 选择持久化。
 *
 * 这里是 `index.ts` 里 BORDER_HEX 之外的第二来源：
 *   - 启动时先读配置文件，有值就用它，没有就用 index.ts 的 BORDER_HEX；
 *   - `/dragon` 切换后写回配置文件，重启仍生效。
 *
 * 配置文件路径（按优先级）：
 *   1. `$PI_DRAGON_THEME_CONFIG`
 *   2. `<agent dir>/.dragon-theme.json`，agent dir 是 `$PI_CODING_AGENT_DIR`
 *      或默认的 `~/.pi/agent`
 *
 * 故意不写进扩展自己的目录：扩展目录可能是 git 仓库（会被 git status 看到），
 * 也可能是 pi install 下来的包（升级时被覆盖）。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ─────────────────────────────── 配色表 ───────────────────────────────

export interface Palette {
	/** `/dragon` 的主参数名（角色名），也是补全与菜单里显示的值。 */
	key: string;
	/** 中文名，文档里用。 */
	label: string;
	/** 英文名，CLI 文案（补全 / 菜单 / 通知）里用。 */
	en: string;
	/** 6 位 hex，带 #。 */
	hex: string;
	/** 别名：颜色词 / 中文名，都能当参数用。 */
	aliases: string[];
}

export const PALETTES: Palette[] = [
	{
		key: "goku",
		label: "悟空金",
		en: "Goku gold",
		hex: "#f0c674",
		aliases: ["gold", "yellow", "悟空"],
	},
	{
		key: "vegeta",
		label: "贝吉塔蓝",
		en: "Vegeta blue",
		hex: "#7d9ed4",
		aliases: ["blue", "贝吉塔"],
	},
	{
		key: "piccolo",
		label: "短笛绿",
		en: "Piccolo green",
		hex: "#7fc95a",
		aliases: ["green", "短笛"],
	},
];

// ─────────────────────────────── 解析 ───────────────────────────────

/** 校验 6 位 hex（必须带 #）。 */
export function isValidHex(value: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** 按 key / 别名找配色，大小写不敏感；找不到返回 undefined。 */
export function resolvePalette(input: string): Palette | undefined {
	const needle = input.trim().toLowerCase();
	if (needle.length === 0) return undefined;
	return PALETTES.find(
		(p) =>
			p.key === needle ||
			p.hex === needle ||
			p.aliases.some((a) => a.toLowerCase() === needle),
	);
}

// ─────────────────────────────── 落盘 ───────────────────────────────

/** 配置文件完整路径。 */
export function configPath(): string {
	const override = process.env.PI_DRAGON_THEME_CONFIG?.trim();
	if (override) return override;
	const agentDir =
		process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent");
	return join(agentDir, ".dragon-theme.json");
}

/** 读取记住的 hex；文件不存在、JSON 坏了、值不合法，一律当没设置。 */
export function readSavedHex(): string | undefined {
	try {
		const parsed = JSON.parse(readFileSync(configPath(), "utf8")) as {
			borderHex?: unknown;
		};
		const hex = parsed?.borderHex;
		return typeof hex === "string" && isValidHex(hex) ? hex.toLowerCase() : undefined;
	} catch {
		return undefined;
	}
}

/** 写入记住的 hex。成功返回 undefined，失败返回错误信息（不抛，免得把命令打断）。 */
export function saveHex(hex: string): string | undefined {
	try {
		const target = configPath();
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, `${JSON.stringify({ borderHex: hex }, null, 2)}\n`, "utf8");
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

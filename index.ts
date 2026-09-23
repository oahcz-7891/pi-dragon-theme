/**
 * Editor Border Color — 把输入框的上下两条边框线固定成一个颜色，
 * 并让 working 指示器（spinner + "Working" 文案）使用同一个颜色。
 *
 * 装了它会覆盖主题的 thinkingOff~thinkingMax / bashMode 边框色；
 * 删掉文件并重启后恢复主题默认行为。
 *
 * 原理：
 * interactive-mode 在“切换思考等级 / 进入 bash 模式 / 换主题”时都会执行
 *     this.editor.borderColor = theme.getThinkingBorderColor(level);
 * 所以只在构造函数里赋值会被覆盖。这里用 getter/setter 把实例上的
 * borderColor 锁定：getter 永远返回我们的着色函数，setter 忽略外部写入。
 *
 * working 颜色：
 * 开启 embedWorkingStatus 后，pi 会走
 *     colorFn = (text) => editor.borderColor(text)
 * 交给 WorkingStatusIndicator 同时给 spinner 和文案上色，
 * 因此 working 自动和边框同色。
 *
 * 圆角输入框：
 * 默认 pi 的 editor 只画上下两条横线；EDITOR_ROUNDED = true 时
 * 在子类里把宽度减 2 交给基类渲染，再补上 │ 与 ╭╮╰╯，得到完整圆角盒子。
 *
 * 安装方式（二选一）：
 *   1. package 方式：pi install /绝对路径/pi-dragon-theme（或 pi install git:github.com/xxx/pi-dragon-theme）
 *   2. 手拷方式：把 index.ts 与 rounded-frame.ts 一起放进 ~/.pi/agent/extensions/
 * 生效方式：重启 pi（首次新增文件），之后改动可用 /reload
 */

import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type {
	EditorTheme,
	TUI,
	TuiMouseEvent,
	TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import { installRoundedCustom, type RoundedDialogsConfig } from "./rounded-frame.ts";
import { PalettePicker } from "./picker.ts";
import {
	PALETTES,
	readSavedHex,
	resolvePalette,
	saveHex,
} from "./palette.ts";

// ─────────────────────────────── 配置 ───────────────────────────────

/**
 * 默认边框颜色，6 位 hex。原方案 = 悟空金 #f0c674。
 *
 * 只是默认值：`/dragon` 保存过选择时会被它覆盖（见 palette.ts）；
 * 想回到它就用 `/dragon goku`。
 */
const BORDER_HEX = "#f0c674";

/**
 * working 指示器（spinner + "Working" 文案）的颜色，6 位 hex。
 * 留成 undefined 就跟随 BORDER_HEX（即默认的与边框同色）。
 */
const WORKING_HEX: string | undefined = undefined;

/** 想再细分时用：单独指定 spinner 与文案的颜色，优先级高于 WORKING_HEX。 */
const WORKING_SPINNER_HEX: string | undefined = undefined;
const WORKING_TEXT_HEX: string | undefined = undefined;

/**
 * working 指示器显示的固定文案（spinner 右侧那行字），如 "Working"。
 * 留成 undefined 就保持 pi 默认文案。
 * 只要 WORKING_WORDS 非空，就以随机词为准，这个会被忽略。
 */
const WORKING_TEXT: string | undefined = undefined;

/**
 * 娜美克星语风随机词。非空时每轮开始随机取一个，
 * 并按 WORKING_ROTATE_MS 在 streaming 期间持续轮换。想加词直接往数组里塞。
 *
 * 音系参考动画里那套：双辅音（kk / pp / tt / rr）、
 * -nga / -puru / -tto / -paro 结尾、a/i/u/o/e 元音为主。
 * Takkaraputo / Popurunga / Pupirittoparo 是原作召唤神龙的咒语，
 * Purunga 是神龙之名，Yunzabit 一般被当成「龙珠」的娜美克语（存疑）。
 */
const WORKING_WORDS: string[] = [
	"Takkaraputo",
	"Popurunga",
	"Pupirittoparo",
	"Rittoparo",
	"Purunga",
	"Yunzabit",
];

/** 轮换间隔（毫秒）。0 = 每轮只随机一次，中途不再变。 */
const WORKING_ROTATE_MS = 4000;

/** 随机文案后面要不要加省略号，跟 Claude 一样那种。 */
const WORKING_SUFFIX = "…";

/**
 * 输入框（editor）本身要不要圆角。true 时渲染成
 *   ╭──────────────╮
 *   │ > 输入内容    │
 *   ╰──────────────╯
 * 关掉就设 EDITOR_ROUNDED = false，恢复 pi 默认的上下两条横线。
 * 只影响这个扩展自己的 editor，不影响内置 select / confirm / input 弹框。
 */
const EDITOR_ROUNDED = true;

/**
 * 给所有扩展的 `ctx.ui.custom()` 弹框套圆角边框。
 * 关掉就设 ENABLED = false；只想给 overlay 浮层加就设 OVERLAY_ONLY = true。
 * 注意：内置的 select / confirm / input / editor 不走 custom，不受影响。
 */
const ROUNDED_ENABLED = true;
const ROUNDED_CONFIG: RoundedDialogsConfig = {
	borderColor: "accent",
	paddingX: 1,
	paddingY: 0,
	overlayOnly: false,
};

// ─────────────────────────────── 着色 ───────────────────────────────

export type ColorMode = "truecolor" | "256color";
type ColorFn = (text: string) => string;

function hexToRgb(hex: string): [number, number, number] {
	const cleaned = hex.replace("#", "");
	if (cleaned.length !== 6) {
		throw new Error(`Invalid hex color: ${hex}`);
	}
	const r = parseInt(cleaned.slice(0, 2), 16);
	const g = parseInt(cleaned.slice(2, 4), 16);
	const b = parseInt(cleaned.slice(4, 6), 16);
	if ([r, g, b].some(Number.isNaN)) {
		throw new Error(`Invalid hex color: ${hex}`);
	}
	return [r, g, b];
}

/** 与 pi 主题一致的近似算法：在 6×6×6 色块与 24 级灰阶之间取更近的那个。 */
function rgbTo256(r: number, g: number, b: number): number {
	const q = [r, g, b].map((v) => Math.round((v / 255) * 5));
	const cubeIndex = 16 + 36 * q[0]! + 6 * q[1]! + q[2]!;
	const cubeValue = q.map((v) => v * 51);
	const grayIndex = Math.max(0, Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10)));
	const grayValue = 8 + grayIndex * 10;
	const cubeDist =
		(cubeValue[0]! - r) ** 2 + (cubeValue[1]! - g) ** 2 + (cubeValue[2]! - b) ** 2;
	const grayDist = (grayValue - r) ** 2 + (grayValue - g) ** 2 + (grayValue - b) ** 2;
	return grayDist < cubeDist ? 232 + grayIndex : cubeIndex;
}

/** 生成前景色着色函数；按终端颜色能力自动选择 truecolor / 256 色。 */
function makeColorFn(hex: string, mode: ColorMode): ColorFn {
	const [r, g, b] = hexToRgb(hex);
	const ansi =
		mode === "truecolor" ? `\x1b[38;2;${r};${g};${b}m` : `\x1b[38;5;${rgbTo256(r, g, b)}m`;
	return (text: string) => `${ansi}${text}\x1b[39m`;
}

/**
 * 可变的边框着色器。
 *
 * editor 的 borderColor getter 与 rounded-frame 都持有同一个 `paint` 引用，
 * 换色时只替换内部函数，不重建任何组件 —— 所以 `/dragon` 一敲完就生效，
 * 输入框里的草稿也不会丢（也不需要 /reload）。
 */
class BorderColor {
	private hexValue: string;
	private mode: ColorMode;
	private fn: ColorFn;
	/** 稳定的引用，外部只拿它。 */
	readonly paint: ColorFn;

	constructor(hex: string, mode: ColorMode = "truecolor") {
		this.hexValue = hex;
		this.mode = mode;
		this.fn = makeColorFn(hex, mode);
		this.paint = (text: string) => this.fn(text);
	}

	get hex(): string {
		return this.hexValue;
	}

	setHex(hex: string): void {
		if (hex === this.hexValue) return;
		this.hexValue = hex;
		this.fn = makeColorFn(hex, this.mode);
	}

	/** 终端颜色能力要到 session_start 才知道，那时补一次。 */
	setMode(mode: ColorMode): void {
		if (mode === this.mode) return;
		this.mode = mode;
		this.fn = makeColorFn(this.hexValue, mode);
	}
}

// ───────────────────────────── 编辑器 ─────────────────────────────

/** 只取用到的字段，避免依赖未导出的内部类型。 */
type WorkingIndicatorLike = {
	kind?: string;
	spinnerColorFn?: ColorFn;
	messageColorFn?: ColorFn;
	updateDisplay?: () => void;
};

class FixedBorderEditor extends CustomEditor {
	private readonly mode: ColorMode;
	private readonly rounded: boolean;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		colorFn: ColorFn,
		mode: ColorMode,
		rounded: boolean,
	) {
		// embedWorkingStatus: true → working 指示器渲染在顶边框内，
		// 并用 borderColor 给 spinner 与文案上色（即与边框同色）。
		super(tui, theme, keybindings, { embedWorkingStatus: true });
		this.mode = mode;
		this.rounded = rounded;

		// pi 会在思考等级 / bash 模式 / 主题变化时覆写 borderColor，
		// 用访问器把它锁死，外部赋值一律忽略。
		Object.defineProperty(this, "borderColor", {
			get: () => colorFn,
			set: () => {},
			configurable: true,
			enumerable: true,
		});
	}

	/**
	 * 圆角输入框。基类只画上下两条横线（内容是内缩 padding 的整行），
	 * 这里把宽度减 2 交给基类渲染，再给每一行左右补上 │，
	 * 顶/底两行补上 ╭╮ / ╰╯，就得到一个完整的圆角盒子。
	 *
	 * 行数不变（顶边仍是第 0 行），所以硬光标定位、内联渲染的
	 * 行数计算都不用改。
	 */
	override render(width: number): string[] {
		const safeWidth = Math.floor(width);
		// 太窄画不下左右边框，交回基类，免得把内容挤坏。
		if (!this.rounded || safeWidth < 4) {
			return super.render(width);
		}

		const lines = super.render(safeWidth - 2);
		if (lines.length === 0) {
			return lines;
		}

		// 基类 layout： [顶边框, ...可见内容行, 底边框, ...补全列表]
		// renderedVisibleLineCount 是私有字段，这里按结构取用。
		const visibleCount = (
			this as unknown as { renderedVisibleLineCount?: number }
		).renderedVisibleLineCount ?? Math.max(0, lines.length - 2);
		const bottomIndex = Math.min(1 + visibleCount, lines.length - 1);

		const corner = (ch: string) => this.borderColor(ch);
		const out: string[] = [];

		const top = lines[0]!;
		out.push(corner("╭") + top + corner("╮"));

		for (let i = 1; i < bottomIndex; i++) {
			out.push(corner("│") + lines[i]! + corner("│"));
		}

		if (bottomIndex >= 1) {
			out.push(corner("╰") + lines[bottomIndex]! + corner("╯"));
		}

		// 补全列表留在盒子下方，但整体右移 1 格，跟输入文字对齐。
		for (let i = bottomIndex + 1; i < lines.length; i++) {
			out.push(" " + lines[i]!);
		}

		return out;
	}

	/**
	 * 圆角后内容整体右移 1 列（左 │），基类的鼠标命中测试要跟着平移，
	 * 否则点击定位会差一格。行坐标不变。
	 */
	override handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (!this.rounded || event.width < 4) {
			return super.handleMouse(event);
		}
		return super.handleMouse({ ...event, x: event.x - 1, width: event.width - 2 });
	}

	/**
	 * pi 在每次开始 streaming 时 new 一个 WorkingStatusIndicator，
	 * 并用 editor.borderColor 生成的同一个 colorFn 给 spinner 和文案上色。
	 * Loader 实例上其实有 spinnerColorFn / messageColorFn 两个独立字段，
	 * 在交给基类前替换掉它们，working 就能和边框不同色。
	 * 只动 kind === "working" 的情况，retry / compaction 保持原样。
	 */
	override setWorkingStatusIndicator(indicator?: unknown): void {
		const target = indicator as WorkingIndicatorLike | undefined;
		if (target && target.kind === "working") {
			const spinnerHex = WORKING_SPINNER_HEX ?? WORKING_HEX;
			const textHex = WORKING_TEXT_HEX ?? WORKING_HEX;
			if (spinnerHex) {
				target.spinnerColorFn = makeColorFn(spinnerHex, this.mode);
			}
			if (textHex) {
				target.messageColorFn = makeColorFn(textHex, this.mode);
			}
			// 换完颜色要重渲染一次，否则当前帧还是旧色。
			target.updateDisplay?.();
		}
		super.setWorkingStatusIndicator(indicator as never);
	}
}

// ───────────────────────────── 注册 ─────────────────────────────

export default function (pi: ExtensionAPI) {
	// 当前配色：index.ts 的 BORDER_HEX 起步，被 /dragon 记住的选择覆盖。
	const border = new BorderColor(readSavedHex() ?? BORDER_HEX);
	// 留着给 /dragon 换色后主动重绘，不然要等下一次按键才看到新颜色。
	let currentTui: TUI | undefined;

	/** 应用配色：改内存 → 重绘 → 落盘。 */
	const applyColor = (hex: string, label: string, ctx: ExtensionContext): void => {
		border.setHex(hex);
		currentTui?.requestRender(true);

		const err = saveHex(hex);
		ctx.ui.notify(
			err
				? `Border → ${label}, but saving the config failed: ${err}`
				: `Border → ${label} (saved)`,
			err ? "warning" : "info",
		);
	};

	// ── /dragon：切换编辑器 / 弹框边框配色（可选，默认仍是 BORDER_HEX）──
	pi.registerCommand("dragon", {
		description: "Border color: goku / vegeta / piccolo",
		getArgumentCompletions: (prefix) => {
			const needle = prefix.trim().toLowerCase();
			const items = PALETTES.map((p) => ({
				value: p.key,
				label: p.key,
				description: p.en,
			}));
			const hit = items.filter((x) => x.value.startsWith(needle));
			return hit.length > 0 ? hit : null;
		},
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();

			// 不带参数 → 弹选择菜单。
			// 走 ctx.ui.custom() 而不是 ctx.ui.select()：内置 select 不经过 custom()，
			// 套不上圆角框（见 picker.ts 顶部注释）。
			if (arg.length === 0) {
				// 当前配色用名字表示；万一配置里是手写的自定义 hex 才回退到 hex。
				const current = PALETTES.find((p) => p.hex === border.hex);
				const picked = await ctx.ui.custom<string | undefined>(
					(_tui, theme, _keybindings, done) =>
						new PalettePicker(
							`Border color (current: ${current?.en ?? border.hex})`,
							PALETTES.map((p) => ({ value: p.key, label: `${p.key} · ${p.en}` })),
							theme,
							done,
						),
				);
				const target = PALETTES.find((p) => p.key === picked);
				if (target) applyColor(target.hex, `${target.key} · ${target.en}`, ctx);
				return;
			}

			// 只认三个主参数及其别名
			const named = resolvePalette(arg);
			if (!named) {
				ctx.ui.notify(
					`Unknown color "${arg}". Try: ${PALETTES.map((p) => p.key).join(" / ")}`,
					"warning",
				);
				return;
			}
			applyColor(named.hex, `${named.key} · ${named.en}`, ctx);
		},
	});
	// ── working 文案随机化（像 Claude Code 那样）──
	let rotateTimer: ReturnType<typeof setInterval> | undefined;

	const stopRotating = () => {
		if (rotateTimer !== undefined) {
			clearInterval(rotateTimer);
			rotateTimer = undefined;
		}
	};

	const pickWord = () =>
		`${WORKING_WORDS[Math.floor(Math.random() * WORKING_WORDS.length)]!}${WORKING_SUFFIX}`;

	// 每轮开始先随机一个词；需要的话再开个定时器持续轮换。
	pi.on("turn_start", (_event, ctx) => {
		if (WORKING_WORDS.length === 0) return;
		ctx.ui.setWorkingMessage(pickWord());
		stopRotating();
		if (WORKING_ROTATE_MS > 0) {
			rotateTimer = setInterval(
				() => ctx.ui.setWorkingMessage(pickWord()),
				WORKING_ROTATE_MS,
			);
		}
	});

	// 一轮结束就停掉轮换，省得空闲时还在空转。
	pi.on("agent_end", () => stopRotating());

	pi.on("session_start", (_event, ctx) => {
		if (WORKING_WORDS.length === 0 && WORKING_TEXT) {
			ctx.ui.setWorkingMessage(WORKING_TEXT);
		}

		const mode = ctx.ui.theme.getColorMode() as ColorMode;
		border.setMode(mode);

		// 包装共享的 ctx.ui.custom，之后任何扩展的 custom 弹框都会被套上圆角框。
		// /reload 会重建 uiContext，所以每次 session_start 都要重新装一遍（幂等）。
		if (ROUNDED_ENABLED) {
			// border 用和输入框边框同一个色源，两者永远同色、且跟着 /dragon 变。
			installRoundedCustom(ctx.ui, ctx.ui.theme, {
				...ROUNDED_CONFIG,
				border: border.paint,
			});
		}
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			currentTui = tui;
			return new FixedBorderEditor(
				tui,
				theme,
				keybindings,
				border.paint,
				mode,
				EDITOR_ROUNDED,
			);
		});
	});
}

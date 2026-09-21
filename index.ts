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
 * 安装位置：~/.pi/agent/extensions/editor-border.ts（全局自动发现）
 * 生效方式：重启 pi（首次新增文件），之后改动可用 /reload
 */

import {
	CustomEditor,
	type ExtensionAPI,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";

// ─────────────────────────────── 配置 ───────────────────────────────

/** 边框颜色，6 位 hex。 */
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

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		colorFn: ColorFn,
		mode: ColorMode,
	) {
		// embedWorkingStatus: true → working 指示器渲染在顶边框内，
		// 并用 borderColor 给 spinner 与文案上色（即与边框同色）。
		super(tui, theme, keybindings, { embedWorkingStatus: true });
		this.mode = mode;

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
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const mode = ctx.ui.theme.getColorMode() as ColorMode;
			return new FixedBorderEditor(
				tui,
				theme,
				keybindings,
				makeColorFn(BORDER_HEX, mode),
				mode,
			);
		});
	});
}

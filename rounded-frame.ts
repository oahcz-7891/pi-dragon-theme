/**
 * RoundedFrame — 给任意 `ctx.ui.custom()` 组件套一层圆角边框。
 *
 * 为什么能覆盖“别人的”弹框：
 *   pi 每个 session 只 `createExtensionUIContext()` 一次，并把同一个 uiContext
 *   对象交给所有扩展；每个扩展的 `ctx.ui` 是一个 getter，返回的正是这个共享对象
 *   （见 dist/core/extensions/runner.js）。所以把 `ui.custom` 换成包装版，之后
 *   任何扩展调用 `ctx.ui.custom()` 都会经过这里。
 *
 * 注意：
 *   - 只管 `custom()`；内置的 select/confirm/input/editor 不走这里。
 *   - 如果某个扩展先把 `ctx.ui.custom` 存成变量再调用，就绕过了包装。
 *   - `/reload` 会重建 uiContext，所以每次 session_start 都要重新安装（见 index.ts）。
 */

import {
	isFocusable,
	truncateToWidth,
	visibleWidth,
	type Component,
	type Focusable,
	type TuiMouseEvent,
	type TuiMouseEventResult,
} from "@earendil-works/pi-tui";

/** 只取用到的 theme 字段，避免依赖未导出的内部类型。 */
type ThemeLike = { fg(color: string, text: string): string };
type ColorFn = (text: string) => string;

export interface RoundedDialogsConfig {
	/** 边框颜色名（theme.fg 的 key），如 "accent" / "border"。传了 border 时忽略。 */
	borderColor: string;
	/** 直接指定着色函数（优先级高于 borderColor），可用来跟编辑器边框同色。 */
	border?: ColorFn;
	/** 边框与内容之间的水平间距，默认 1。 */
	paddingX: number;
	/** 上下各加几行空行，默认 0。 */
	paddingY: number;
	/** 只给 overlay 浮层套框；true 时非浮层的 custom UI 保持原样。 */
	overlayOnly: boolean;
}

interface DisposableComponent extends Component {
	dispose?: () => void;
	/** overlay 在没有 overlayOptions 时会读它来推断宽度。 */
	width?: number;
	wantsKeyRelease?: boolean;
}

/** 圆角边框容器：把内层组件渲染进 ╭─╮ / ╰─╯ 里，并转发焦点与输入。 */
export class RoundedFrame implements Component, Focusable {
	private readonly inner: DisposableComponent;
	private readonly border: ColorFn;
	private readonly paddingX: number;
	private readonly paddingY: number;
	private _focused = false;

	constructor(inner: DisposableComponent, options: { border: ColorFn; paddingX: number; paddingY: number }) {
		this.inner = inner;
		this.border = options.border;
		this.paddingX = Math.max(0, options.paddingX);
		this.paddingY = Math.max(0, options.paddingY);
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		// 转发给内层，内层才会输出 CURSOR_MARKER，IME 光标才不会错位。
		if (isFocusable(this.inner)) {
			(this.inner as Component & Focusable).focused = value;
		}
	}

	/** 让 overlay 的宽度推断把边框算进去。 */
	get width(): number | undefined {
		const w = this.inner.width;
		return typeof w === "number" ? w + 2 * (this.paddingX + 1) : undefined;
	}

	get wantsKeyRelease(): boolean {
		return this.inner.wantsKeyRelease ?? false;
	}

	invalidate(): void {
		this.inner.invalidate?.();
	}

	dispose(): void {
		this.inner.dispose?.();
	}

	handleInput(data: string): void {
		this.inner.handleInput?.(data);
	}

	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		return this.inner.handleMouse?.(event);
	}

	render(width: number): string[] {
		const safeWidth = Math.max(1, Math.floor(width));
		// 太窄画不下边框，直接透传，免得把别人组件挤坏。
		if (safeWidth < 4) {
			return this.inner.render(safeWidth);
		}

		const innerWidth = safeWidth - 2;
		const contentWidth = Math.max(1, innerWidth - this.paddingX * 2);
		const pad = " ".repeat(this.paddingX);
		const blank = this.border("│") + " ".repeat(innerWidth) + this.border("│");

		const top = this.border(`╭${"─".repeat(innerWidth)}╮`);
		const bottom = this.border(`╰${"─".repeat(innerWidth)}╯`);

		const lines: string[] = [top];
		for (let i = 0; i < this.paddingY; i++) lines.push(blank);

		for (const raw of this.inner.render(contentWidth)) {
			// 只在超宽时才截断，避免误伤 CURSOR_MARKER 等零宽序列。
			const clipped = visibleWidth(raw) > contentWidth ? truncateToWidth(raw, contentWidth, "") : raw;
			const fill = " ".repeat(Math.max(0, contentWidth - visibleWidth(clipped)));
			// 边框字符单独上色，别把颜色串到内层内容上。
			lines.push(this.border("│") + pad + clipped + fill + pad + this.border("│"));
		}

		for (let i = 0; i < this.paddingY; i++) lines.push(blank);
		lines.push(bottom);
		return lines;
	}
}

/** 标记：同一个 uiContext 只包装一次，防止 reload/重复 session_start 叠加多层。 */
const PATCH_FLAG = Symbol.for("pi-dragon-theme.rounded-custom");

/**
 * 把共享的 `ctx.ui.custom` 换成包装版。对同一个对象重复调用是幂等的。
 * 返回 true 表示本次真的装上了（或已装过）。
 */
export function installRoundedCustom(
	ui: unknown,
	theme: ThemeLike,
	config: RoundedDialogsConfig,
): boolean {
	const target = ui as Record<PropertyKey, unknown> & {
		custom?: (factory: unknown, options?: unknown) => unknown;
	};
	if (typeof target.custom !== "function" || target[PATCH_FLAG]) {
		return false;
	}

	const original = target.custom;

	target.custom = function (this: unknown, factory: unknown, options?: unknown) {
		const overlayOnly = config.overlayOnly;
		const isOverlay =
			!!options && typeof options === "object" && (options as { overlay?: boolean }).overlay === true;
		if (overlayOnly && !isOverlay) {
			return original.call(this, factory, options);
		}

		const wrapped = (tui: unknown, currentTheme: unknown, keybindings: unknown, done: unknown) => {
			const t = (currentTheme as ThemeLike | undefined) ?? theme;
			const frame = (component: DisposableComponent) =>
				new RoundedFrame(component, {
					border: config.border ?? ((text) => t.fg(config.borderColor, text)),
					paddingX: config.paddingX,
					paddingY: config.paddingY,
				});

			const result = (factory as (...a: unknown[]) => unknown)(tui, currentTheme, keybindings, done);
			// custom() 的 factory 允许返回 Promise<Component>。
			return result && typeof (result as PromiseLike<unknown>).then === "function"
				? (result as Promise<DisposableComponent>).then(frame)
				: frame(result as DisposableComponent);
		};

		return original.call(this, wrapped, options);
	};

	target[PATCH_FLAG] = true;
	return true;
}

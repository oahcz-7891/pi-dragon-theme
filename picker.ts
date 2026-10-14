/**
 * `/dragon` 的选择菜单。
 *
 * 为什么不用 `ctx.ui.select()`：
 * 内置 select 走的是 pi 自己的 ExtensionSelectorComponent
 * （interactive-mode.js 里 `select:` → `showExtensionSelector()`），
 * 根本不经过 `ctx.ui.custom()`，所以 rounded-frame.ts 的圆角包装抓不到它。
 * 换成 `ctx.ui.custom()` 自己搭一个，边框就能被套上，
 * 颜色也跟随 /dragon 的当前配色（RoundedFrame 持有的是 border.paint）。
 *
 * DragonMenu 用 pi-tui 的 SettingsList 搭一个设置页，每一项都能用
 * 空格 / 回车「就地」调节，菜单不关：
 *   - Border color        → 在 goku / vegeta / piccolo 之间循环；
 *   - Collapsed thinking  → 在 1 line / 2 lines / hidden 之间循环。
 * 上下键移动光标，Esc 关闭。
 *
 * 键盘导航复用 pi-tui 的 SettingsList，观感和内置弹框一致。
 * 这里只画内容，不画边框 —— 边框由外层的 RoundedFrame 负责。
 */

import {
	Container,
	SettingsList,
	Spacer,
	Text,
	type Component,
	type Focusable,
	type SettingItem,
} from "@earendil-works/pi-tui";
import { getSettingsListTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { THINKING_MODES, THINKING_MODE_LABELS, type ThinkingMode } from "./palette.ts";

/** 一个配色选项：key 是 `/dragon` 的主参数名，label 是菜单里的展示名。 */
export interface DragonColorOption {
	key: string;
	label: string;
}

export interface DragonMenuOptions {
	theme: Theme;
	/** 可选配色，按数组顺序循环。 */
	colors: DragonColorOption[];
	/** 当前配色对应的展示名（对不上任何一个时循环会从第一个开始）。 */
	colorValue: string;
	/** 「收起思考」当前的显示方式。 */
	thinkingMode: ThinkingMode;
	/** 循环到某个配色后回调（传 key），菜单保持打开。 */
	onColor: (key: string) => void;
	/** 把思考显示方式切到某个值后回调，菜单保持打开。 */
	onThinking: (mode: ThinkingMode) => void;
}

/**
 * `/dragon` 根菜单：一个设置页。
 *
 * 两项都是「值项」——光标移上去按空格 / 回车就地循环，不打开子菜单、不关菜单。
 */
export class DragonMenu implements Component, Focusable {
	private readonly container = new Container();
	private readonly list: SettingsList;
	private _focused = false;

	constructor(options: DragonMenuOptions, onClose: () => void) {
		// SettingsList 用 values.indexOf(currentValue) 定位，所以 values 得和右侧显示的文字一致。
		const colorLabels = options.colors.map((c) => c.label);
		const byLabel = new Map(options.colors.map((c) => [c.label, c.key]));
		const thinkingLabels = THINKING_MODES.map((mode) => THINKING_MODE_LABELS[mode]);
		const thinkingByLabel = new Map(
			THINKING_MODES.map((mode) => [THINKING_MODE_LABELS[mode], mode]),
		);

		const items: SettingItem[] = [
			{
				id: "color",
				label: "Border color",
				description: "Editor / modal border color. Space or Enter cycles it.",
				currentValue: options.colorValue,
				values: colorLabels,
			},
			{
				id: "thinking",
				label: "Collapsed thinking",
				description:
					"Live reasoning lines under pi's `Thinking...` header: `1 line` / `2 lines`, or `hidden` for the native header only.",
				currentValue: THINKING_MODE_LABELS[options.thinkingMode],
				values: thinkingLabels,
			},
		];

		this.list = new SettingsList(
			items,
			items.length,
			getSettingsListTheme(),
			(id, newValue) => {
				if (id === "color") {
					const key = byLabel.get(newValue);
					if (key !== undefined) options.onColor(key);
					return;
				}
				if (id === "thinking") {
					const mode = thinkingByLabel.get(newValue);
					if (mode !== undefined) options.onThinking(mode);
				}
			},
			onClose,
		);

		this.container.addChild(new Spacer(1));
		this.container.addChild(
			new Text(options.theme.fg("accent", options.theme.bold("Dragon theme")), 0, 0),
		);
		this.container.addChild(new Spacer(1));
		this.container.addChild(this.list);
	}

	/** 让 RoundedFrame 的 isFocusable() 认出来，焦点才会转发进来。 */
	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
	}

	render(width: number): string[] {
		return this.container.render(width);
	}

	invalidate(): void {
		this.container.invalidate();
	}

	handleInput(data: string): void {
		this.list.handleInput(data);
	}
}

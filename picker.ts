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
 *   - Collapsed thinking  → on / off 切换。
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
	/** 「收起思考实时行」当前是否开启。 */
	thinkingEnabled: boolean;
	/** 循环到某个配色后回调（传 key），菜单保持打开。 */
	onColor: (key: string) => void;
	/** 把开关切到某个值后回调，菜单保持打开。 */
	onThinking: (enabled: boolean) => void;
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
					"Live second line under the `Thinking...` header while thinking is hidden. Space toggles it.",
				currentValue: options.thinkingEnabled ? "on" : "off",
				values: ["on", "off"],
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
				if (id === "thinking") options.onThinking(newValue === "on");
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

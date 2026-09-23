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
 * 键盘导航直接复用 pi-tui 的 SelectList：上下 / 回车 / esc 都已经实现，
 * 配色主题用 pi 自己的 getSelectListTheme()，观感和内置 select 一致。
 *
 * 这里只画内容，不画边框 —— 边框由外层的 RoundedFrame 负责。
 */

import {
	Container,
	SelectList,
	Spacer,
	Text,
	type Component,
	type Focusable,
	type SelectItem,
} from "@earendil-works/pi-tui";
import { getSelectListTheme, type Theme } from "@earendil-works/pi-coding-agent";

export class PalettePicker implements Component, Focusable {
	private readonly container = new Container();
	private readonly list: SelectList;
	private _focused = false;

	constructor(
		title: string,
		items: SelectItem[],
		theme: Theme,
		done: (value: string | undefined) => void,
	) {
		this.list = new SelectList(items, items.length, getSelectListTheme());
		this.list.onSelect = (item) => done(item.value);
		this.list.onCancel = () => done(undefined);

		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text(theme.fg("accent", theme.bold(title)), 0, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(this.list);
		this.container.addChild(new Spacer(1));
		this.container.addChild(
			new Text(theme.fg("dim", "↑↓ navigate  enter select  esc cancel"), 0, 0),
		);
		this.container.addChild(new Spacer(1));
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

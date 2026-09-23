# pi-dragon-theme

Dragon Ball / Namek-flavored pi extension. Three TUI tweaks:

- **Editor box** — rounded frame (`EDITOR_ROUNDED`) whose border is locked to `#f0c674`, resisting theme / thinking-level / bash-mode overrides.
- **Modals** — every extension `ctx.ui.custom()` dialog wrapped in the same rounded border.
- **Working words** — "Working" replaced by a rotating Namekian word (`Purunga…`).
- **`/dragon`** — optional command to switch the border color at runtime.

## Install

```bash
pi install /abs/path/to/pi-dragon-theme
# or
pi install git:github.com/oahcz-7891/pi-dragon-theme
```

Restart pi. Later edits: `/reload`.

## Config

Edit the constants at the top of `index.ts` (`BORDER_HEX`, `EDITOR_ROUNDED`, `WORKING_WORDS`, `WORKING_ROTATE_MS`, `ROUNDED_ENABLED`, …).

## Colors · `/dragon`

The border color defaults to `BORDER_HEX` in `index.ts` (`#f0c674`, Goku gold). Switching it is **optional** — use the `/dragon` command instead of editing the file:

```
/dragon                # picker menu (shows the current color)
/dragon goku           # Goku gold      #f0c674   (default)
/dragon vegeta         # Vegeta blue    #7d9ed4
/dragon piccolo        # Piccolo green  #7fc95a
```

The command surface (list description, Tab completions, picker, notifications) is in English. Color words and Chinese names still work as aliases: `gold` / `blue` / `green`, `悟空` / `贝吉塔` / `短笛`.

The picker is built with `ctx.ui.custom()` (see `picker.ts`) rather than `ctx.ui.select()`, so it gets the same rounded frame as everything else — pi's built-in `select` / `confirm` / `input` / `editor` dialogs bypass `custom()` and cannot be framed. Keyboard navigation reuses pi-tui's `SelectList`.
The choice is saved to `<agent dir>/.dragon-theme.json` (`~/.pi/agent/` by default, override with `$PI_CODING_AGENT_DIR` or `$PI_DRAGON_THEME_CONFIG`) and survives restarts.

The editor border, the rounded wrapper around `ctx.ui.custom()` dialogs, the working spinner, and the thinking / bash-mode border all read the same mutable color source, so a switch applies on the next frame — no `/reload` needed, and any draft text in the editor is kept.

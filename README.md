# pi-dragon-theme

Dragon Ball / Namek-flavored pi extension: rounded editor frame, framed modals, Namekian working spinner, and a tok/s stat.

## Features

- **Editor box** — rounded frame (`EDITOR_ROUNDED`) with a border locked to `#f0c674` (ignores theme / thinking-level / bash-mode overrides) and a golden `>` prompt (`PROMPT_GLYPH`) at the start of the input line; wrapped lines are indented to match.
- **Modals** — every `ctx.ui.custom()` dialog gets the same rounded border. pi's own full-width `DynamicBorder` rules are stripped (`stripInnerRules`, on by default; set it `false` in `ROUNDED_CONFIG` to keep pi's look), including key-hint footers below the bottom rule (e.g. ask-user-question).
- **Working words** — "Working" replaced by a rotating Namekian word (`Purunga…`).
- **Collapsed thinking** — with thinking hidden (`ctrl+T`), pi's `Thinking...` header is kept and a second line goes live under it: while the model thinks it shows the **latest line of the reasoning** (tail-truncated, so the newest words stay visible), and once the block finishes it appends a dim `… (ctrl+t 展开)` hint. Only collapsed blocks change; expanded thinking and the click-to-peek on a single block are untouched. Toggle with `/dragon thinking` (persisted), or set `THINKING_COLLAPSED_ENABLED = false` for a new default.
- **TPS** — `⚡ 48.2 tok/s` in the footer status area, dim like the native stats. Updates while streaming, keeps the last value until the next turn.
- **`/dragon`** — optional runtime border-color switch.

## Install

```bash
pi install /abs/path/to/pi-dragon-theme
# or
pi install git:github.com/oahcz-7891/pi-dragon-theme
```

Restart pi. Later edits: `/reload`.

## Config

Constants at the top of `index.ts`: `BORDER_HEX`, `PROMPT_LEAD`, `PROMPT_GLYPH`, `EDITOR_ROUNDED`, `WORKING_WORDS`, `WORKING_ROTATE_MS`, `ROUNDED_ENABLED`, `TPS_*`, …

- **Prompt** — `PROMPT_LEAD` is the space before the prompt, `PROMPT_GLYPH` the glyph (`">"`; `""` disables, or use `❯` / `›` / `▸`). Indent width follows the real glyph width, and the prompt uses the border color so `/dragon` recolors it.
- **TPS** — uses `usage.output` (thinking tokens included) and starts at the first streamed token, so it measures pure generation speed. `TPS_PREFIX` / `TPS_SUFFIX` (`⚡ ` / ` tok/s`), `TPS_REFRESH_MS` throttles redraws, `TPS_ENABLED = false` disables it. Drawn via `ctx.ui.setStatus()` on the extension-status line, leaving the native `↑↓R W $ %` line untouched.
- **Collapsed thinking** — `/dragon thinking` toggles the live second line; `THINKING_COLLAPSED_ENABLED` is the default when nothing is saved, `THINKING_HINT` is the suffix shown after the thinking block ends (empty string hides it). The header line is pi's own `Thinking...`; the live line follows pi's style (`italic` + `thinkingText`), the hint is `dim`.

## Colors · `/dragon`

Defaults to `BORDER_HEX` (`#f0c674`, Goku gold). Switching is optional — prefer the command over editing the file:

```
/dragon                # picker menu (shows the current color)
/dragon goku           # Goku gold      #f0c674   (default)
/dragon vegeta         # Vegeta blue    #7d9ed4
/dragon piccolo        # Piccolo green  #7fc95a
/dragon thinking       # toggle the live collapsed-thinking second line (on/off)
```

Surface text is English; `gold` / `blue` / `green` also work as aliases. The picker uses `ctx.ui.custom()` (`picker.ts`) so it gets the rounded frame too — built-in `select` / `confirm` / `input` / `editor` dialogs bypass `custom()` and cannot be framed. Choices are saved to `<agent dir>/.dragon-theme.json` (`~/.pi/agent/`, overridable via `$PI_CODING_AGENT_DIR` or `$PI_DRAGON_THEME_CONFIG`) and survive restarts; `/dragon thinking` is persisted as `collapsedThinking` in the same file (default comes from `THINKING_COLLAPSED_ENABLED`).

Editor border, modal wrapper, spinner, and thinking / bash-mode border all read the same mutable color source, so a switch applies on the next frame — no `/reload`, and draft text is kept.

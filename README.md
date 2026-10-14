# pi-dragon-theme

Dragon Ball / Namek-flavored pi extension: rounded editor frame, framed modals, Namekian working spinner, and a tok/s stat.

## Features

- **Editor box** — rounded frame (`EDITOR_ROUNDED`) with a border locked to `#f0c674` (ignores theme / thinking-level / bash-mode overrides) and a golden `>` prompt (`PROMPT_GLYPH`) at the start of the input line; wrapped lines are indented to match.
- **Modals** — every `ctx.ui.custom()` dialog gets the same rounded border. pi's own full-width `DynamicBorder` rules are stripped (`stripInnerRules`, on by default; set it `false` in `ROUNDED_CONFIG` to keep pi's look), including key-hint footers below the bottom rule (e.g. ask-user-question).
- **Working words** — "Working" replaced by a rotating Namekian word (`Purunga…`).
- **Collapsed thinking** — with thinking hidden (`ctrl+T`) you pick how much of the live reasoning shows *under* pi's native `Thinking...` header, via `/dragon thinking` (persisted) or the `/dragon` menu. `1 line` / `2 lines` append that many live reasoning rows (each tail-truncated so the newest words stay visible, with a dim `… (ctrl+t 展开)` hint once the block ends); `hidden` shows just pi's native `Thinking...` line. Expanded thinking and the click-to-peek on a single block are untouched.
- **TPS** — `48.2 tok/s` in the footer status area, in the border/theme color (follows `/dragon`). Live per-message speed while streaming; once generation stops it switches to the session average (cumulative output tokens ÷ cumulative pure generation time, tool waits and TTFT excluded). Pinned to the session — never cleared mid-run, only on a new/other session.
- **`/dragon`** — runtime settings menu: border color and the collapsed-thinking display (`1 line` / `2 lines` / `hidden`), both changed in place with Space.

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
- **TPS** — uses `usage.output` (thinking tokens included) and starts at the first streamed token, so it measures pure generation speed. `TPS_PREFIX` (empty by default) / `TPS_SUFFIX` (` tok/s`), `TPS_REFRESH_MS` throttles redraws, `TPS_ENABLED = false` disables it. Streaming shows the current message's live speed; at every stop it shows the session average (cumulative tokens ÷ cumulative pure generation seconds, tool waits and TTFT excluded). Only `session_start` clears it. Drawn via `ctx.ui.setStatus()` on the extension-status line, leaving the native `↑↓R W $ %` line untouched.
- **Collapsed thinking** — `/dragon thinking` cycles `1 line` → `2 lines` → `hidden`, or name one directly (`/dragon thinking 1` / `2` / `off`). `THINKING_MODE_DEFAULT` is the default when nothing is saved (`"line2"`), `THINKING_HINT` is the suffix shown after the thinking block ends (empty string hides it). The row count counts only the appended live rows (the `Thinking...` header is pi's own and always kept); `hidden` keeps the native single-line header. The appended rows follow pi's style (`italic` + `thinkingText`), the hint is `dim`.

## Colors · `/dragon`

Defaults to `BORDER_HEX` (`#f0c674`, Goku gold). Switching is optional — prefer the command over editing the file:

```
/dragon                # settings menu (see below)
/dragon goku           # Goku gold      #f0c674   (default)
/dragon vegeta         # Vegeta blue    #7d9ed4
/dragon piccolo        # Piccolo green  #7fc95a
/dragon thinking       # cycle the live rows under Thinking... (1 line → 2 lines → hidden)
/dragon thinking 1     # Thinking... + 1 live reasoning row
/dragon thinking 2     # Thinking... + 2 live reasoning rows
/dragon thinking off   # just pi's native Thinking... row
```

`/dragon` with no argument opens a settings menu (a `SettingsList`). Both rows are value rows — move the cursor with `↑↓` and press `Space` (or `Enter`) to change the value in place, without closing the menu:

- **Border color** — cycles `goku · Goku gold` → `vegeta · Vegeta blue` → `piccolo · Piccolo green` → back; the new color applies on the next frame.
- **Collapsed thinking** — cycles `1 line` → `2 lines` → `hidden`.

The menu stays open while you change things; `Esc` closes it.

Surface text is English; `gold` / `blue` / `green` also work as aliases. The picker uses `ctx.ui.custom()` (`picker.ts`) so it gets the rounded frame too — built-in `select` / `confirm` / `input` / `editor` dialogs bypass `custom()` and cannot be framed. Choices are saved to `<agent dir>/.dragon-theme.json` (`~/.pi/agent/`, overridable via `$PI_CODING_AGENT_DIR` or `$PI_DRAGON_THEME_CONFIG`) and survive restarts; the thinking display is persisted as `thinkingMode` (`"line1"` / `"line2"` / `"hidden"`; the old boolean `collapsedThinking` is still read for compatibility), with the default coming from `THINKING_MODE_DEFAULT`.

Editor border, modal wrapper, spinner, thinking / bash-mode border, and the `tok/s` status line all read the same mutable color source, so a switch applies on the next frame — no `/reload`, and draft text is kept.

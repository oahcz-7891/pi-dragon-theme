# pi-dragon-tui

**English** | [简体中文](README.zh-CN.md)

Dragon Ball / Namek-flavored pi extension: rounded editor frame, framed modals, Namekian spinner, and a tok/s stat.

![editor frame, Namekian spinner and tok/s](assets/overview.png)

## Install

```bash
pi install npm:pi-dragon-tui
# or
pi install git:github.com/oahcz-7891/pi-dragon-tui
```

Restart pi. Later edits: `/reload`.

## Features

- **Editor box** — rounded frame and a golden `>` prompt; wrapped lines keep the indent. Border color ignores theme / thinking-level / bash-mode overrides.
- **Modals** — every `ctx.ui.custom()` dialog gets the same rounded border, with pi's own full-width rules and key-hint footers stripped (keep them via `stripInnerRules: false` in `ROUNDED_CONFIG`). Built-in `select` / `confirm` / `input` / `editor` bypass `custom()` and stay unframed.
- **Working words** — "Working" rotates through Namekian words (`Purunga…`).
- **Collapsed thinking** — with thinking hidden (`ctrl+T`), pick how much live reasoning shows under pi's `Thinking...` header: `1 line`, `2 lines`, or `hidden`. Rows follow pi's thinking style, are tail-truncated so the newest words stay visible, and end with a dim `… (ctrl+t 展开)` hint. Expanded thinking is untouched.
- **TPS** — `48.2 tok/s` on the status line, in the border color. Live per-message speed while streaming, then the session average (output tokens ÷ pure generation time; tool waits and TTFT excluded). Pinned to the session; the native status line is untouched.
- **`/dragon`** — settings menu for border color and collapsed thinking: `↑↓` to move, `Space` to change in place, `Esc` to close.

## Commands

```
/dragon                # settings menu
/dragon goku           # Goku gold      #f0c674  (default)
/dragon vegeta         # Vegeta blue    #7d9ed4
/dragon piccolo        # Piccolo green  #7fc95a
/dragon thinking       # cycle: 1 line → 2 lines → hidden
/dragon thinking 1|2|off
```

![the /dragon settings menu](assets/dragon-menu.png)

`gold` / `blue` / `green` also work as aliases. Choices are saved to `<agent dir>/.dragon-tui.json` (`~/.pi/agent/`, overridable via `$PI_CODING_AGENT_DIR` or `$PI_DRAGON_TUI_CONFIG`) and survive restarts. Every color consumer reads one mutable source, so switching applies on the next frame — no `/reload`, and draft text is kept.

## Config

Constants at the top of `index.ts`:

- **Prompt** — `BORDER_HEX` (border color), `PROMPT_LEAD` / `PROMPT_GLYPH` (space and glyph before the input line; `""` disables, or use `❯` / `›` / `▸`), `EDITOR_ROUNDED`, `ROUNDED_ENABLED`.
- **TPS** — `TPS_ENABLED`, `TPS_PREFIX` / `TPS_SUFFIX` (` tok/s`), `TPS_REFRESH_MS`.
- **Thinking / spinner** — `THINKING_MODE_DEFAULT` (`"line2"`), `THINKING_HINT` (suffix after the block; `""` hides it), `WORKING_WORDS`, `WORKING_ROTATE_MS`.

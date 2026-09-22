# pi-dragon-theme

Dragon Ball / Namek-flavored pi extension. Three tweaks to the TUI:

- **Fixed editor border** — locks the input box top/bottom border to one color (`#f0c674`), resisting pi's theme/thinking-level/bash-mode overwrites.
- **Rounded modals** — wraps every extension `ctx.ui.custom()` dialog in a rounded frame sharing the same border color.
- **Random working words** — replaces "Working" with a rotating Namekian word (`Purunga…`, `Takkaraputo…`).

## Install

```bash
pi install /abs/path/to/pi-dragon-theme
# or
pi install git:github.com/oahcz-7891/pi-dragon-theme
```

Restart pi. Later edits: `/reload`.

## Config

Edit the constants at the top of `index.ts` (`BORDER_HEX`, `WORKING_WORDS`, `WORKING_ROTATE_MS`, `ROUNDED_ENABLED`, …).

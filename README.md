# pi-dragon-theme

Dragon Ball / Namek-flavored pi extension. Three TUI tweaks:

- **Editor box** — rounded frame (`EDITOR_ROUNDED`) whose border is locked to `#f0c674`, resisting theme / thinking-level / bash-mode overrides.
- **Modals** — every extension `ctx.ui.custom()` dialog wrapped in the same rounded border.
- **Working words** — "Working" replaced by a rotating Namekian word (`Purunga…`).

## Install

```bash
pi install /abs/path/to/pi-dragon-theme
# or
pi install git:github.com/oahcz-7891/pi-dragon-theme
```

Restart pi. Later edits: `/reload`.

## Config

Edit the constants at the top of `index.ts` (`BORDER_HEX`, `EDITOR_ROUNDED`, `WORKING_WORDS`, `WORKING_ROTATE_MS`, `ROUNDED_ENABLED`, …).

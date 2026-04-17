# BoxTer — Project Status & Roadmap

_Last updated: 2026-04-17_

## Current State

- **Version:** v1.0.1 released
- **Branch:** `main` (clean, synced with origin)
- **Stack:** Electron 33 + React 19 + Vite + react-grid-layout + xterm.js
- **Panels:** Terminal, Browser, Notes, Files
- **Workspaces:** multi-tab, save/load sessions, auto-restore
- **Distribution:** auto-updater, Homebrew cask, winget/Flathub scaffolds

---

## Roadmap

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

### Phase 3.1 — Quick Wins (start here)

- [x] **One-press theme toggle** (`Alt+T`) — _done 2026-04-17_
  - Themes: Dark, Light, Cyberpunk, Solarized, Dracula
  - CSS variables scoped by `[data-theme]` on `:root`, persist via `electron-store`
  - Theme button in toolbar (cycles), shows current theme letter (D/L/C/S/V)
  - Shortcut `Alt+T` — `Ctrl+Shift+T` was already bound to undo-close panel
  - Added to command palette (Ctrl+K → "Cycle theme") and shortcut help
  - Files: `hooks/useTheme.js` (new), `components/Toolbar.jsx`, `components/App.jsx`, `components/ShortcutHelp.jsx`, `styles/global.css`

- [x] **Live status banner (top)** — _done 2026-04-17_
  - Shows: workspace name + index, panel counts (terminal/browser/notes/files), focused panel, memory %, CPU load, uptime, theme, online/offline, live clock
  - Toggle with `Alt+B` (persists in localStorage)
  - New IPC handler: `system:stats` (memory, cpu load, uptime, terminals count, app version)
  - Files: `StatusBanner.jsx` (new), `main.js` (+ipc), `preload.js` (+system.stats), `App.jsx`, `ShortcutHelp.jsx`, `global.css`
  - Note: git branch of cwd deferred — needs per-terminal cwd tracking (future enhancement)

### Phase 3.2 — Dynamic Layout

- [x] ~~Neural-network panel connections~~ — _removed 2026-04-17_
  - Built but user feedback: not useful, decorative only. Replaced by Canvas view below.

- [x] **Canvas / Map view** — _done 2026-04-17_ ⭐ major feature
  - **Click-to-zoom**: when zoomed out (<70%), clicking a panel smoothly animates canvas to center + zoom on that panel. `Alt+Z` zooms to focused panel. Fit button auto-picks between "zoom to focused" and "fit all" based on current zoom.
  - Toggle between Grid mode (current tiling) and Canvas mode (infinite pan/zoom whiteboard)
  - Canvas mode: freely-positioned panels on an infinite 2D space
  - Pan: drag on empty space / middle-click / spacebar+drag
  - Zoom: mouse wheel (pointer-anchored), `+`/`-` keys
  - **Fit-to-view** — `Ctrl+0` — zoom out to see all panels at once
  - **100% zoom** — `Ctrl+1`
  - **Minimap** in corner — click to jump
  - Per-workspace: `canvasLayout` (panel positions), `canvasView` (scale/tx/ty), `viewMode`
  - Auto-init canvas positions from grid layout on first switch
  - Toolbar button: Grid ↔ Canvas toggle
  - **Panel types in canvas**: Terminal + Notes + Files only. Browser panel shown as placeholder card (URL + icon) in canvas mode — webview doesn't render well under CSS transforms
  - Persistence: added to workspace auto-save + session save/load

- [ ] **Layout presets** (grid, stacked, split-screen, focus-mode)
- [ ] **Snap-to-grid + alignment guides** while dragging

### Phase 3.3 — Power Features

- [ ] **Panel linking / pipes** — terminal output → notes auto-append
- [ ] **AI Assistant panel** — Claude API integration for in-context help
- [ ] **Split terminal** — tmux-style horizontal/vertical splits in one panel
- [ ] **Quick snippets** — `Ctrl+Enter` on notes selection → paste to terminal
- [x] **Workspace templates** — _done 2026-04-17_
  - 5 built-in templates: Dev Setup, Research, Debug, Writing, Learning
  - Each template spawns a new workspace with predefined panels + grid + canvas layouts
  - Template picker modal (card grid with accent-colored icons, panel-type dots, double-click to create)
  - Empty workspace shows "Start from template…" primary CTA
  - `Ctrl+Alt+N` shortcut + command palette entries (one per template)
  - Files: `utils/templates.js` (new), `components/TemplatePicker.jsx` (new), `App.jsx`, `ShortcutHelp.jsx`, `global.css`

### Phase 3.4 — Navigation & Search

- [x] **Global search (`Ctrl+P`)** — _done 2026-04-17_
  - Searches: workspace names, panel names/types, notes content (with snippet preview), file names, browser URLs
  - Ranked scoring: exact > prefix > substring; word-boundary bonus; Panel/Workspace rank above raw content
  - Arrow keys navigate, Enter jumps (switches workspace + focuses panel), Esc closes
  - Color-coded category pills: Workspace (purple), Panel (cyan), Notes (yellow), File (light blue), URL (pink)
  - Inline match highlighting via `<mark>`
  - Files: `utils/searchIndex.js` (new), `components/GlobalSearch.jsx` (new), `App.jsx` (+state, shortcut, navigate), `ShortcutHelp.jsx`, `global.css`
  - Note: terminal history not searchable — xterm.js doesn't expose scrollback easily (deferred)
- [ ] **Floating mini-map** — top-right preview of all panels
- [x] **Activity timeline** — _done 2026-04-17_
  - Collapsible bottom bar with ring-buffer of last 200 events in localStorage
  - Categories: Panel / Workspace / UI / Session / Content (+ icons, color-coded)
  - Filter chips with live counts, clear-all button
  - Relative + absolute timestamps, auto-refresh every 30s
  - Click an entry with `workspaceId` → jumps to that workspace + focuses panel
  - Logs: panel add/close/rename/duplicate, workspace add/close/rename/switch, theme cycle, view-mode switch, session save/load
  - Toggle with `Alt+H` (persists in localStorage)
  - Files: `utils/activityLog.js` (new), `components/ActivityTimeline.jsx` (new), `App.jsx` (+hooks), `ShortcutHelp.jsx`, `global.css`

### Phase 3.5 — Sync & Cloud

- [ ] **Cloud sync** — sessions/notes via GitHub Gist or Drive
- [ ] **Shareable workspace links** — export/import workspace as URL

---

## Notes / Decisions

- User prefers: easy → hard build order (theme → banner → connections)
- Keep Electron-only for now (no web version)
- Each feature = new branch + PR

---

## Backlog Ideas (not prioritized)

- Plugin system for custom panel types
- Markdown preview in Notes
- Terminal recording/playback
- Collaborative workspaces (CRDT)
- Voice commands

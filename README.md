# BoxTer

A tiling workspace manager for your desktop. Run terminals, browsers, and notes side by side in resizable panels — all in one window.

```
┌─────────────────────────────────────────────┐
│  [B] BoxTer    > Terminal  @ Browser  # Notes│
├──────────┬──────────┬───────────────────────┤
│ Terminal │ Browser  │  Terminal              │
│   $      │ google   │   $                    │
│          │          │                        │
├──────────┤          ├───────────────────────┤
│ Notes    │          │  Browser               │
│ # todo   │          │  github.com            │
└──────────┴──────────┴───────────────────────┘
```

## Features

- **Tiling Grid Layout** — Drag, drop, and resize panels freely
- **Terminal Panels** — Full terminal emulator (xterm.js + node-pty)
- **Browser Panels** — Embed any webpage with navigation controls
- **Notes Panels** — Quick scratchpad with save support
- **Session Management** — Save and restore your workspace layouts
- **Dark Theme** — Easy on the eyes, built for long sessions
- **Cross Platform** — Linux, macOS, Windows

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm or yarn

### Install & Run

```bash
# Clone the repo
git clone https://github.com/Sunil-ghodela/BoxTer.git
cd BoxTer

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Linux Sandbox Note

On Linux you may see a `chrome-sandbox` permission error when running with the default sandbox. The `npm run dev` and `npm start` scripts include `--no-sandbox` for this reason. If you prefer full sandboxing:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
npm run dev:sandbox
```

This only matters in development — production builds (AppImage/deb) package the sandbox correctly.

### Build for Distribution

```bash
# Build distributable package
npm run build

# Output will be in the release/ directory
```

## Usage

1. Launch the app — you'll see the welcome screen
2. Click **Terminal**, **Browser**, or **Notes** to add panels
3. **Drag** panel headers to rearrange
4. **Resize** by dragging panel edges/corners
5. **Close** panels with the `x` button
6. Use **Sessions** to save/load your workspace layouts

## Tech Stack

- [Electron](https://www.electronjs.org/) — Desktop shell
- [React](https://react.dev/) — UI framework
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) — Drag & resize grid
- [xterm.js](https://xtermjs.org/) + [node-pty](https://github.com/microsoft/node-pty) — Terminal emulation
- [Vite](https://vitejs.dev/) — Build tooling

## Contributing

PRs welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)

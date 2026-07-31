# QML Viewer

Chinese version: [README.md](README.md)

A QML editor and preview tool built with Electron + React + TypeScript, supporting both Electron desktop mode and a pure web browser mode.

It includes a Qt-free Qt Quick-compatible runtime that parses QML, evaluates bindings and handlers in isolated QuickJS, and renders through a retained DOM/Canvas scene graph. It targets layout and behavior validation for common UI, not Qt ABI or pixel parity.

## Features

- **QML code editing**: Monaco Editor with syntax and semantic highlighting, contextual completion, and code folding
- **Self-rendered preview**: Built-in QML -> HTML rendering engine that shows the result directly in the right panel
- **Interactive behavior preview**: Supports common property bindings, signal handlers, models, states, animations, and navigation behavior
- **Runtime inspector**: Inspect the current QML object tree, ids, and property snapshot
- **Resizable panels**: Left and right panels can be resized by dragging the divider
- **File operations**: Open multiple files, open directories for batch QML import, and save QML files
- **UI settings**: Switch between Chinese and English, and toggle day/night themes

## Tech Stack

- **Electron** - desktop app framework (optional)
- **React** - UI framework
- **TypeScript** - type safety
- **Vite** - build tool
- **Monaco Editor** - code editor

## Requirements

- Node.js >= 18

## Installation

```bash
npm install
```

## Usage

### Development mode (Web)

```bash
npm run dev
```

Run on a specific port (note that `--` passes arguments through to Vite):

```bash
npm run dev -- --port 5175
```

Fail immediately if the port is already in use (do not fall back to another port):

```bash
npm run dev -- --port 5175 --strictPort
```

### Development mode (Windows / Electron)

```bash
npm run dev:win
```

### Build production version (Web)

```bash
npm run build
```

### Complete validation

```bash
npm run check
```

### Build production version (Windows / Electron)

```bash
npm run build:win
```

### Preview the build output (Web)

```bash
npm run server
```

Run preview on a specific port:

```bash
npm run server -- --port 5175
```

### Preview the build output (Windows / Electron window)

Launch the Electron desktop window after building to verify the production build:

```bash
npm run win
```

## Project Structure

```
qml-viewer/
├── electron/                  # Electron main process
│   ├── main.ts                # Main process entry
│   ├── preload.cjs           # Preload script (file operation IPC)
│   └── fileOps.ts            # File read/write IPC
├── src/                      # React renderer process
│   ├── components/           # React components
│   │   ├── EditorPanel.tsx       # Editor panel
│   │   ├── PreviewPanel.tsx      # Owned runtime preview and object inspector
│   │   ├── SplitPane.tsx         # Resizable split pane
│   │   └── Toolbar.tsx           # Toolbar
│   ├── renderer/
│   │   └── parser.ts         # QML parser
│   ├── runtime/              # Objects, bindings, QuickJS, components, and scene graph
│   ├── i18n/                 # Internationalization config
│   │   ├── index.tsx
│   │   ├── zh-CN.ts
│   │   └── en-US.ts
│   ├── utils/
│   │   └── qmlLang.ts        # Monaco QML language registration
│   ├── styles/
│   │   └── main.css
│   ├── App.tsx               # Root component
│   ├── main.tsx              # React entry
│   └── index.html            # HTML template
├── docs/
│   └── plan.md               # Implementation plan
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts             # Vite config for web mode
└── vite.win.config.ts         # Vite config for Windows/Electron mode
```

## Features in Detail

### Editor

- The left panel is the QML code editor
- Supports QML syntax and semantic highlighting for types, properties, signals, handlers, methods, variables, enums, and more
- Supports autocompletion, code folding, and bracket matching

#### Contextual completion shortcuts

| Shortcut | Purpose | Where to use |
|---------|---------|--------------|
| `Alt+/` | Show writable properties of the current QML object, including grouped properties such as `anchors`, `Layout`, and `font` | Place the cursor inside an object body, e.g. inside `Button { }` |
| `Alt+.` | Show child controls suitable for the current object; at top level, show `pragma`, `import`, and available root types | Place the cursor inside an object body for children, or outside for top-level declarations |

After selecting a suggestion, press `Enter` or `Tab` to insert it. When typing values after a colon, the editor also suggests booleans, enums, colors, model references, and other values based on the property type.

### Preview (self-rendered engine)

- The right panel is the QML preview area
- The built-in QML -> HTML rendering engine parses QML and renders it as HTML/CSS
- Click the "Refresh preview" button to update the preview
- Supports common Qt Quick base elements, layouts, Qt Quick Controls, views, models, and delegates
- Supports common layout approaches such as anchors, Row/Column, Grid/Flow, and Qt Quick Layouts
- Supports property bindings, event handlers, states, transitions, and common animation APIs
- Supports previews for common data views such as ListView, GridView, PathView, TableView, and TreeView
- ChartView, WebEngineView, VideoOutput, and some graphics effects are approximated using browser capabilities

See the [QML Compatibility Checklist](docs/qml-compatibility-checklist.md) for supported scope and known differences.

### File Operations

- **Open files**: Click the "Open File" button in the toolbar to select multiple `.qml` files and add them to the file list on the left
- **Open directories**: Click the "Open Directory" button in the toolbar to batch import `.qml` files from a directory
- **Save files**: Click the "Save File" button in the toolbar
  - Electron mode: saves to the local file system
  - Web mode: saves directly to a file (requires the File System Access API)

### Language Switching

- Click the language button on the right side of the toolbar to switch between Chinese and English

## Rendering Engine Notes

### Supported scope

The rendering engine is intended for QML UI validation and covers common controls, layouts, bindings, signals, models, views, states, and animations. Some complex controls and Qt runtime semantics are approximated using the browser. The full status is documented in the [QML Compatibility Checklist](docs/qml-compatibility-checklist.md).

### How it works

1. `renderer/parser.ts` parses QML into a source-located syntax tree
2. `runtime/QmlDocument.ts` creates the object tree and activates bindings, handlers, and Loaders
3. `runtime/QmlJsEngine.ts` evaluates JavaScript in isolated QuickJS WASM
4. `runtime/QmlDomSceneGraph.ts` projects the retained object tree to DOM, Canvas, and WebGL

## License

ISC
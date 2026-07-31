# Owned Qt Quick Runtime Plan

## Product Goal

Build and ship a useful Qt Quick-compatible QML editor and runtime without linking to or launching Qt. QML is parsed, evaluated, and rendered by code owned by this repository. Browser and Electron APIs provide platform integrations.

## Architecture

| Layer | Implementation |
|---|---|
| Editor | React, Monaco Editor, shared runtime type catalog |
| Parser | Source-located lexer/parser with recoverable diagnostics |
| Object runtime | Typed properties, aliases, ownership, ids, methods, and signals |
| JavaScript | Sandboxed QuickJS WASM with live QML object proxies |
| Rendering | Retained DOM/CSS scene graph plus Canvas/WebGL projections |
| Components | Component, async Loader, qmldir modules, and lifecycle ownership |
| UI systems | Anchors, layouts, controls, input, models, views, states, and animations |
| Platform | Narrow Electron file/network/clipboard adapters and browser media/web views |
| Tooling | Monaco metadata, source diagnostics, runtime object inspector, Vitest, and CI |

## Delivered Stages

1. Parser, object model, bindings, QuickJS bridge, and retained scene graph.
2. Common Qt Quick Controls and semantic native DOM projections.
3. Advanced controls, overlays, and stack/swipe/split navigation.
4. Structured TableView and TreeView data projection and selection.
5. Async Loader source activation integrated into document lifecycle.
6. Keyboard navigation, pointer capture, easing, and keyframe animations.
7. Chart series, effects, WebEngineView, and VideoOutput browser backends.
8. Runtime object inspection, compatibility documentation, and continuous validation.

## Validation Contract

Every change must pass:

```bash
npm run check
```

`check` runs the complete test suite serially and creates a production build. UI changes additionally require browser checks at desktop and narrow viewports.

## Compatibility Boundary

The runtime targets common declarative Qt Quick UI behavior, not ABI compatibility with Qt. Native C++ QML plugins, exact Qt rendering, advanced shader semantics, accessibility/input-method parity, and every Qt module are outside the current boundary. These require owned browser/Electron adapters or future runtime implementations.

Current subsystem status is tracked in [qml-compatibility-checklist.md](qml-compatibility-checklist.md); the implementation history is in [runtime-roadmap.md](runtime-roadmap.md).

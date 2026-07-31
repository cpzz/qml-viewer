# Qt Quick Compatible Runtime Roadmap

## Goal

Build a Qt Quick compatible QML runtime inside the Electron application without linking to or launching the Qt runtime.

Primary compatibility targets:

- QtQml language and object semantics
- QtQuick scene and input semantics
- QtQuick.Layouts
- QtQuick.Controls
- Pure QML and JavaScript components
- Models, delegates, states, transitions, and animations

Native C++ QML plugins cannot run directly. Browser or Electron adapters will provide equivalents for platform services where practical.

## Architecture

1. Parser: owned lexer and recursive-descent parser with source locations and recoverable diagnostics.
2. Object runtime: typed properties, ownership, ids, aliases, default/required/readonly semantics, signals, and methods.
3. Binding engine: automatic dependency tracking, incremental reevaluation, loop detection, and binding restoration.
4. JavaScript: isolated QuickJS WASM execution with controlled QML object bridges and host APIs.
5. Scene graph: retained QML item tree rendered through DOM/CSS first, with Canvas/WebGL for effects that need it.
6. Components: module resolver, qmldir-compatible metadata, Component, Loader, dynamic creation, and lifecycle management.
7. UI systems: anchors, layouts, focus, pointer/keyboard/touch input, models/views, controls, states, and animations.
8. Tooling: shared type metadata for runtime, completion, diagnostics, object inspection, and debugging.

PreviewPanel uses this runtime directly. There is no Qt or legacy iframe-renderer fallback.

## Compatibility Gates

Every implementation commit must pass:

```sh
npm test
npm run build
```

UI changes additionally require browser interaction checks. A subsystem replaces the legacy implementation only after its focused tests and representative QML fixtures pass.

## Delivery Stages

- [x] Add deterministic test infrastructure and parser regression tests.
- [x] Preserve typed property declaration metadata in the AST.
- [x] Add QML object ownership and typed property semantics.
- [x] Add reactive property dependency tracking and binding lifecycle.
- [x] Instantiate parsed AST nodes as runtime object documents with id registration.
- [x] Add source-located parsing, property ranges, top-level recovery, and structural diagnostics.
- [x] Preserve nested object arrays and template literals, with missing-value and template diagnostics.
- [x] Add lexical QML scopes, aliases, default-property child routing, signals, and methods.
- [x] Integrate QuickJS WASM and initial expression/handler execution.
- [x] Add live QML property proxies, callable methods/signals, and allowlisted host functions.
- [x] Add recursive object-valued live proxies and native Promise bridging for asynchronous host functions.
- [x] Add type registry and instantiate initial built-in QtQml/QtQuick types.
- [x] Connect core runtime visual properties to an initial retained DOM scene graph.
- [x] Implement initial anchors, transforms, clipping, stacking, focus, pointer, and keyboard input.
- [x] Implement initial Component, Loader, custom QML sources, imports, and module resolution.
- [x] Add qmldir metadata parsing and provider-backed versioned component sources.
- [x] Add async Electron module sources, singleton/internal qmldir semantics, and controlled file/network/clipboard adapters.
- [x] Add initial nested custom type factories with deferred root completion.
- [x] Activate nested component bindings and handlers in isolated component scopes.
- [x] Implement initial ListModel and Repeater delegate lifecycle.
- [x] Implement initial ListView, GridView, PathView virtualization and navigation semantics.
- [x] Add model-driven variable delegate sizing for virtualized ListView.
- [x] Add ListView section metadata, highlight lifecycle, and item snapping.
- [x] Add declarative PathLine/PathQuad geometry and PathAttribute values to PathView.
- [x] Implement initial states, transitions, behaviors, and animation groups.
- [x] Build runtime state machines from declarative State, PropertyChanges, and Transition AST objects.
- [x] Add color/vector interpolation, pause/script actions, repeat loops, and typed state transitions.
- [x] Implement initial QtQuick.Layouts and basic QtQuick.Controls behavior.
- [x] Add reactive implicit content sizes and layout preferred-size negotiation.
- [x] Add Layout alignment flags and Control tab/click focus policies.
- [x] Project Control background and contentItem block properties with padding geometry.
- [x] Add Popup, Dialog, and Menu overlay lifecycles with close policies.
- [x] Add palette styling, extended native controls, popup centering/transitions, and focus trapping.
- [x] Map touch/pen pointers through MouseArea and enforce composed-event propagation policies.
- [x] Add Canvas 2D/WebGL contexts, ShaderEffect fallback projection, particle drawing, and data-driven charts.
- [x] Add Electron adapters for platform features.
- [x] Switch PreviewPanel to the new runtime and remove the legacy HTML renderer after compatibility acceptance.
- [x] Add serializable runtime object inspection and continuous test/build validation.

## Current Limitations

PreviewPanel now runs the owned runtime directly; unsupported QML syntax is shown as a source-located preview error. The retained DOM scene graph, QuickJS bridge, components, views, controls, states, animations, graphics, and Electron adapters are covered by focused tests and an integrated fixture.

Remaining compatibility work is incremental Qt surface expansion: uncommon grammar, additional control styles/types, advanced shader and particle semantics, and native C++ plugin equivalents. Native Qt plugins are intentionally unsupported and require browser or Electron adapters.

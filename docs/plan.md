# QML Viewer - 实现计划（Phase 1）

## 项目概述

使用 npm + Electron + TypeScript 实现 QML 文档编辑预览工具。**不依赖 Qt6/qml6 等外部工具**，在 Electron 中通过 HTML/CSS 模拟渲染基础 QML UI 元素，用于 UI 布局验证。

## 技术栈

| 层面 | 选型 |
|------|------|
| 包管理 | npm |
| 桌面框架 | Electron |
| 语言 | TypeScript |
| 构建工具 | Vite + vite-plugin-electron |
| UI 框架 | Vue 3 + Composition API |
| 代码编辑器 | Monaco Editor（支持 QML 语法高亮） |
| QML 渲染 | 自实现 QML → HTML 渲染引擎 |
| 国际化 | vue-i18n |
| 面板分割 | 自定义 SplitPane 拖拽组件 |

## 目录结构

```
qml-viewer/
├── electron/
│   ├── main.ts          # Electron 主进程入口
│   ├── preload.cjs      # 预加载脚本（文件操作 IPC）
│   └── fileOps.ts       # 文件读写 IPC
├── src/
│   ├── index.html
│   ├── main.ts          # Vue 入口
│   ├── App.vue          # 根组件（布局 + 工具栏）
│   ├── components/
│   │   ├── EditorPanel.vue    # Monaco 编辑器
│   │   ├── PreviewPanel.vue   # 预览面板（渲染 QML → HTML）
│   │   ├── SplitPane.vue      # 可拖拽分割面板
│   │   └── Toolbar.vue        # 工具栏（打开/保存/刷新/语言切换）
│   ├── renderer/               # QML 渲染引擎
│   │   ├── parser.ts           # QML 语法解析器
│   │   ├── renderer.ts         # QML 节点 → HTML 渲染器
│   │   ├── elements.ts         # QML 元素映射定义
│   │   └── layouts.ts          # 布局引擎（anchors, Row, Column）
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── zh-CN.ts
│   │   └── en-US.ts
│   ├── utils/
│   │   └── qmlLang.ts   # Monaco QML 语言注册
│   └── styles/
│       └── main.css
```

## 核心功能（Phase 1）

### 1. QML 解析器（parser.ts）

解析 QML 语法结构，提取元素树：

- 支持的元素：`Rectangle`, `Text`, `Image`, `Item`, `Row`, `Column`, `BorderImage`
- 支持属性解析：
  - 通用：`id`, `width`, `height`, `visible`, `opacity`, `anchors.*`
  - Rectangle：`color`, `border.color`, `border.width`, `radius`
  - Text：`text`, `font.pixelSize`, `font.bold`, `font.family`, `color`, `horizontalAlignment`, `verticalAlignment`
  - Image：`source`, `fillMode`
  - Row/Column：`spacing`, `padding`
- 不支持：JavaScript 绑定表达式（`property: value + 1`）、信号处理器（`onClicked`）

### 2. 渲染引擎（renderer.ts + elements.ts）

将解析后的 QML 元素树渲染为 HTML/CSS：

| QML 元素 | HTML 映射 |
|-----------|-----------|
| Item | `<div style="position:relative">` |
| Rectangle | `<div>` + CSS background/border/radius |
| Text | `<span>` 或 `<div>` + CSS font/color |
| Image | `<img>` |
| Row | `<div style="display:flex">` |
| Column | `<div style="display:flex;flex-direction:column">` |

### 3. 布局引擎（layouts.ts）

处理 QML 布局系统：

- **绝对定位**：`x`, `y`, `width`, `height` → CSS position + width/height
- **锚点布局**：`anchors.fill`, `anchors.centerIn`, `anchors.left`, `anchors.right`, `anchors.top`, `anchors.bottom`, `anchors.margins` → 用 CSS flex 或 absolute 模拟
- **Row/Column**：flexbox 模拟
- **百分比/像素单位**：统一处理 px/%

### 4. 其他功能

- Monaco Editor + QML 语法高亮（已有）
- 文件打开/保存（已有）
- 可拖拽分割面板（已有）
- 中英文双语切换（已有）
- 刷新预览：重新解析编辑器内容 → 重新生成 HTML

## 不支持的 QML 特性（未来可扩展）

- 属性绑定（`color: parent.active ? "red" : "blue"`）
- 信号处理器（`onClicked`, `onCompleted`）
- Model/View 组件（ListView, GridView, Repeater 等）
- 动画系统（Behavior, PropertyAnimation）
- ShaderEffect、Canvas、WebView
- 外链 import、自定义组件
- JavaScript 函数

## 实现步骤

| 步骤 | 内容 |
|------|------|
| 1 | 清理 qml6 相关代码，移除 electron/fileOps.ts 中的进程管理 |
| 2 | 实现 QML 解析器 parser.ts（Tokenize → 元素树） |
| 3 | 实现元素映射定义 elements.ts（QML 属性 → CSS 规则） |
| 4 | 实现布局引擎 layouts.ts（anchors, Row, Column） |
| 5 | 实现渲染引擎 renderer.ts（元素树 → HTML string + CSS） |
| 6 | 更新 PreviewPanel.vue 集成渲染引擎 |
| 7 | 联调测试：编辑 QML → 刷新 → 预览面板显示渲染结果 |

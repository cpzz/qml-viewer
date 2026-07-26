# QML Viewer

基于 Electron + React + TypeScript 的 QML 编辑器与预览工具。

** 在 Electron 内部通过 HTML/CSS 模拟渲染基础 QML UI 元素，用于 UI 布局验证。

## 功能特性

- **QML 代码编辑**：基于 Monaco Editor，支持 QML 语法高亮
- **自渲染预览**：内置 QML → HTML 渲染引擎，右侧面板直接显示渲染结果
- **可调整面板**：左右面板可拖拽调整大小
- **文件操作**：支持打开、保存 QML 文件
- **多语言支持**：中英文双语界面切换

## 技术栈

- **Electron** - 桌面应用框架
- **React** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Monaco Editor** - 代码编辑器

## 环境要求

- Node.js >= 18

## 安装

```bash
npm install
```

## 使用方法

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览构建结果（Electron 窗口）

构建后启动 Electron 桌面应用窗口，用于验证生产构建：

```bash
npm run preview
```

## 项目结构

```
qml-viewer/
├── electron/                  # Electron 主进程
│   ├── main.ts               # 主进程入口
│   ├── preload.cjs           # 预加载脚本（文件操作 IPC）
│   └── fileOps.ts            # 文件读写 IPC
├── src/                       # React 渲染进程
│   ├── components/           # React 组件
│   │   ├── EditorPanel.tsx       # 编辑器面板
│   │   ├── PreviewPanel.tsx      # 预览面板（iframe 显示渲染结果）
│   │   ├── SplitPane.tsx         # 可拖拽分割面板
│   │   └── Toolbar.tsx           # 工具栏
│   ├── renderer/              # QML 渲染引擎
│   │   ├── parser.ts         # QML 语法解析器
│   │   ├── elements.ts       # QML 元素 → CSS 映射
│   │   ├── layouts.ts        # 布局引擎（anchors, Row, Column）
│   │   ├── renderer.ts       # 渲染器（元素树 → HTML）
│   │   └── index.ts          # 统一导出
│   ├── i18n/                 # 国际化配置
│   │   ├── index.tsx
│   │   ├── zh-CN.ts
│   │   └── en-US.ts
│   ├── utils/
│   │   └── qmlLang.ts        # Monaco QML 语言注册
│   ├── styles/
│   │   └── main.css
│   ├── App.tsx               # 根组件
│   ├── main.tsx              # React 入口
│   └── index.html            # HTML 模板
├── docs/
│   └── plan.md               # 实现计划
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 功能说明

### 编辑器

- 左侧面板为 QML 代码编辑器
- 支持语法高亮：关键字、类型、属性、注释、字符串等
- 支持代码自动补全和括号匹配

### 预览（自渲染引擎）

- 右侧面板为 QML 预览区
- 内置 QML → HTML 渲染引擎，将 QML 代码解析并渲染为 HTML/CSS
- 点击"刷新预览"按钮即可更新预览
- 支持的元素：

| QML 元素 | 渲染效果 |
|-----------|----------|
| Rectangle | `<div>` + CSS background/border/radius |
| Text | `<div>` + CSS font/color/text-align |
| Image | `<div>` + background-image |
| Item | `<div>` 容器 |
| Row | `display: flex; flex-direction: row` |
| Column | `display: flex; flex-direction: column` |

- 支持的布局属性：
  - `width`, `height`, `x`, `y` → CSS 绝对定位
  - `anchors.fill`, `anchors.centerIn` → 锚点布局
  - `anchors.left/right/top/bottom` → 边对齐
  - `anchors.margins` → 边距
  - `opacity`, `visible` → 透明度和可见性

### 文件操作

- **打开**：点击工具栏"打开"按钮，选择 `.qml` 文件
- **保存**：点击工具栏"保存"按钮，保存当前文件

### 语言切换

- 点击工具栏右侧的语言按钮，可切换中英文界面

## 渲染引擎说明

### Phase 1 支持的 QML 子集

渲染引擎目前支持基础的 QML UI 元素，适用于 UI 布局验证：

- **支持**：Rectangle, Text, Image, Item, Row, Column
- **支持**：颜色、边框、圆角、字体、对齐、锚点布局
- **不支持**：属性绑定表达式、信号处理器、ListView/Repeater、动画、ShaderEffect

### 工作原理

1. `parser.ts`：解析 QML 语法，提取元素树（类型 + 属性 + 子元素）
2. `elements.ts`：将 QML 元素类型映射到 CSS 样式
3. `layouts.ts`：处理锚点布局和定位
4. `renderer.ts`：生成完整的 HTML 文档，通过 iframe 展示在预览面板

## 许可证

ISC

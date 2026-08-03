import QtQuick

// ================================================================
// Item 可视属性综合验证
// 验证项：
//   layer.enabled / layer.smooth 离屏层
//   palette.highlight 所属项和继承至子项
//   Keys.priority / Keys.onPressed 键盘事件（计数验证）
//   Drag.keys attached 属性
//   activeFocusOnTab + KeyNavigation 焦点链
//   childrenRect：自动计算子项包围盒
//   transform: rotation / scale + transformOrigin
//   visibleChildren 可视子项计数
//   anchors.fill 充满父项
// ================================================================

Item {
    id: root
    width: 760
    height: 520
    focus: true
    activeFocusOnTab: true
    transformOrigin: Item.TopLeft
    // 验证 layer 追加属性不影响子项渲染
    layer.enabled: true
    layer.smooth: true
    // 验证 palette 自定义并继承至子 Rectangle
    palette.highlight: "#0f766e"
    Keys.priority: Keys.BeforeItem
    Drag.keys: ["item-demo"]

    property int keyPressCount: 0
    // 验证 Keys.onPressed 在 Keys.BeforeItem 优先级下先于控件本身处理
    Keys.onPressed: { keyPressCount += 1 }

    // ---- anchors.fill：背景矩形充满根项 ----
    Rectangle {
        id: background
        anchors.fill: parent
        color: "#f4f1ea"
    }

    // ---- 子 Item：持有两个 Rectangle 验证 childrenRect 计算 ----
    Item {
        id: content
        x: 72
        y: 82
        width: 616
        height: 344

        // rotation + 自定义 transformOrigin（中心旋转）；activeFocusOnTab 进入焦点链
        Rectangle {
            id: leftPanel
            x: -24
            y: 16
            width: 250
            height: 250
            color: root.palette.highlight
            radius: 8
            rotation: -4
            transformOrigin: Item.Center
            activeFocusOnTab: true
        }

        // scale + TopLeft transformOrigin；KeyNavigation 连接到 leftPanel
        Rectangle {
            id: rightPanel
            x: 286
            y: 54
            width: 280
            height: 220
            color: "#d97706"
            radius: 8
            scale: 1.08
            transformOrigin: Item.TopLeft
            activeFocusOnTab: true
            KeyNavigation.left: leftPanel
        }

        // 验证 content.childrenRect 实时计算（含 rotation 未参与包围盒，仅几何位置）
        Text {
            x: 8
            y: 300
            text: "childrenRect: " + content.childrenRect.x + ", " + content.childrenRect.y + " / " + content.childrenRect.width + " x " + content.childrenRect.height
            color: root.palette.text
            font.pixelSize: 16
        }
    }

    Text {
        x: 48
        y: 30
        text: "Qt Quick Item foundation"
        color: root.palette.text
        font.pixelSize: 24
        font.bold: true
    }

    // 验证 activeFocus / keyPressCount 实时绑定 + visibleChildren 计数
    Text {
        x: 48
        y: 472
        text: "Focus: " + root.activeFocus + "  Keys: " + root.keyPressCount + "  Visible children: " + root.visibleChildren.length
        color: "#374151"
        font.pixelSize: 14
    }
}

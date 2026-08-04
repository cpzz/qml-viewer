import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// StackLayout 属性综合验证
// 验证项：
//   currentIndex 切换可见页
//   TabBar.currentIndex 联动
//   Layout.fillWidth / fillHeight 页面填满布局
//   count 只读属性
//   动态 currentIndex 绑定
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- TabBar + StackLayout 联动 ----
    // 期望：TabBar 与 StackLayout currentIndex 双向同步；
    //       切换 Tab 时对应页面立即显示，其余页面不渲染（display:none）
    Text { text: "StackLayout + TabBar binding"; color: "#e8e8e8"; font.pixelSize: 14 }
    ColumnLayout {
        spacing: 0
        TabBar {
            id: tabBar
            Layout.fillWidth: true
            TabButton { text: "Overview" }
            TabButton { text: "Details"  }
            TabButton { text: "Settings" }
        }

        StackLayout {
            id: stack
            Layout.fillWidth: true
            Layout.preferredHeight: 120
            currentIndex: tabBar.currentIndex

            // 期望：每页背景颜色不同，文字居中；切换时无动画（StackLayout 语义）
            Rectangle {
                color: "#1e3a5f"
                Label {
                    anchors.centerIn: parent
                    text: "Page 1 — Overview\ncurrentIndex = " + stack.currentIndex
                    color: "#93c5fd"; font.pixelSize: 14; horizontalAlignment: Label.AlignHCenter
                }
            }
            Rectangle {
                color: "#1a3a2a"
                Label {
                    anchors.centerIn: parent
                    text: "Page 2 — Details\ncount = " + stack.count
                    color: "#86efac"; font.pixelSize: 14; horizontalAlignment: Label.AlignHCenter
                }
            }
            Rectangle {
                color: "#3a1a2a"
                Label {
                    anchors.centerIn: parent
                    text: "Page 3 — Settings"
                    color: "#f9a8d4"; font.pixelSize: 14
                }
            }
        }
    }

    // ---- 按钮手动切换 ----
    // 期望：prev/next 按钮在边界时禁用；"Go to N" 直接跳转
    Text { text: "Manual navigation"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 8
        Button {
            text: "← Prev"
            enabled: stack.currentIndex > 0
            onClicked: stack.currentIndex--
        }
        Label {
            text: (stack.currentIndex + 1) + " / " + stack.count
            color: "#e8e8e8"; font.pixelSize: 13
            Layout.minimumWidth: 48
            horizontalAlignment: Label.AlignHCenter
        }
        Button {
            text: "Next →"
            enabled: stack.currentIndex < stack.count - 1
            onClicked: stack.currentIndex++
        }
        Button { text: "Page 1"; onClicked: { stack.currentIndex = 0; tabBar.currentIndex = 0 } }
        Button { text: "Page 2"; onClicked: { stack.currentIndex = 1; tabBar.currentIndex = 1 } }
        Button { text: "Page 3"; onClicked: { stack.currentIndex = 2; tabBar.currentIndex = 2 } }
    }

    // ---- 单独 StackLayout（无 TabBar）----
    // 期望：仅显示 currentIndex 指向的页；其余页 display:none
    Text { text: "Standalone StackLayout (no TabBar)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 8
        StackLayout {
            id: standalone
            Layout.preferredWidth: 200; Layout.preferredHeight: 60
            currentIndex: 0
            Label { text: "Alpha page"; color: "#fbbf24"; font.pixelSize: 14 }
            Label { text: "Beta page";  color: "#34d399"; font.pixelSize: 14 }
            Label { text: "Gamma page"; color: "#f87171"; font.pixelSize: 14 }
        }
        ColumnLayout {
            spacing: 4
            Repeater {
                model: 3
                Button {
                    text: ["Alpha","Beta","Gamma"][index]
                    highlighted: standalone.currentIndex === index
                    onClicked: standalone.currentIndex = index
                }
            }
        }
    }
}

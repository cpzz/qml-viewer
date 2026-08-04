import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// ComboBox 属性综合验证
// 验证项：
//   model 数组与 ListModel 数据源
//   currentIndex / currentText 当前选中
//   editable 可输入
//   displayText 自定义显示文本
//   popup 下拉列表展开/收起
//   enabled / disabled 状态渲染
//   activated / highlighted / accepted 信号
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 数组 model + 信号 ----
    // 期望：点击展开下拉列表；选中后更新 currentText；activated 携带 index 触发
    Text { text: "model: array + signals"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        ComboBox {
            id: basicBox
            model: ["Apple", "Banana", "Cherry", "Date", "Elderberry"]
            onActivated: (index) => statusLabel.text = "activated: " + currentText + " (index " + index + ")"
        }
        Text {
            text: "current: " + basicBox.currentText
            color: "#a3e635"; font.pixelSize: 13
        }
    }

    // ---- ListModel ----
    // 期望：显示 textRole 字段；选中项同步到 currentIndex
    Text { text: "model: ListModel with textRole"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        ComboBox {
            id: listModelBox
            textRole: "name"
            model: ListModel {
                ListElement { name: "Red";   hex: "#ef4444" }
                ListElement { name: "Green"; hex: "#22c55e" }
                ListElement { name: "Blue";  hex: "#3b82f6" }
            }
            onActivated: statusLabel.text = "activated: " + currentText
        }
        Rectangle {
            width: 32; height: 32; radius: 4
            color: listModelBox.model.get(listModelBox.currentIndex)?.hex ?? "#888"
        }
    }

    // ---- editable ----
    // 期望：输入框可手动输入；回车触发 accepted 信号；未匹配时 currentIndex = -1
    Text { text: "editable: manual input + accepted signal"; color: "#e8e8e8"; font.pixelSize: 14 }
    ComboBox {
        id: editBox
        editable: true
        model: ["Option A", "Option B", "Option C"]
        onAccepted: statusLabel.text = "accepted: " + editText
        onActivated: statusLabel.text = "activated: " + currentText
    }

    // ---- displayText ----
    // 期望：下拉框始终显示 "Qty: N"；展开列表显示原始 model 值
    Text { text: "displayText: custom label"; color: "#e8e8e8"; font.pixelSize: 14 }
    ComboBox {
        id: displayBox
        model: [1, 2, 5, 10, 20, 50]
        displayText: "Qty: " + currentText
        onActivated: statusLabel.text = "qty selected: " + currentText
    }

    // ---- enabled / disabled ----
    // 期望：disabled 时整体变灰，无法展开下拉列表
    Text { text: "State: enabled / disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        ComboBox { model: ["Enabled", "Option"]; currentIndex: 0 }
        ComboBox { model: ["Disabled"]; enabled: false }
    }

    Label {
        id: statusLabel
        text: "Status: (interact with combo boxes)"
        color: "#60a5fa"; font.pixelSize: 13
    }
}

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// TextField / TextArea 属性综合验证
// 验证项：
//   text / placeholderText 内容与占位符
//   readOnly / enabled 只读与禁用状态
//   echoMode 密码输入
//   maximumLength 长度限制
//   accepted / editingFinished 信号
//   TextArea wrapMode 换行模式
//   color / font 样式
//   palette.base / text / placeholderText 自定义主题色
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 基本输入 + 占位符 ----
    // 期望：输入框有边框圆角；占位符灰色；获焦时边框高亮为 accent 色
    Text { text: "Basic: text / placeholderText"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        TextField {
            id: basicField
            placeholderText: "Type here…"
            width: 220
            onAccepted: statusLabel.text = "accepted: " + text
        }
        TextField {
            placeholderText: "With initial text"
            text: "Hello QML"
            width: 200
        }
    }

    // ---- readOnly / disabled ----
    // 期望：readOnly 不可编辑但可选中；disabled 整体变灰，不可交互
    Text { text: "State: readOnly / disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        TextField {
            text: "Read-only text"
            readOnly: true
            width: 180
        }
        TextField {
            text: "Disabled"
            enabled: false
            width: 160
        }
    }

    // ---- echoMode 密码输入 ----
    // 期望：Password 模式下字符显示为圆点；PasswordEchoOnEdit 输入时明文、失焦后遮罩
    Text { text: "echoMode: Normal / Password"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        TextField {
            placeholderText: "Normal"
            echoMode: TextInput.Normal
            width: 160
        }
        TextField {
            text: "secret123"
            echoMode: TextInput.Password
            width: 160
        }
    }

    // ---- maximumLength + 信号 ----
    // 期望：超出 10 字符后无法继续输入；editingFinished 在回车或失焦时触发
    Text { text: "Constraints: maximumLength + signals"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        TextField {
            id: limitField
            placeholderText: "Max 10 chars"
            maximumLength: 10
            width: 180
            onAccepted:       statusLabel.text = "accepted: " + text
            onEditingFinished: statusLabel.text = "editingFinished: " + text
        }
        Text {
            text: limitField.length + " / 10"
            color: limitField.length >= 10 ? "#f87171" : "#a3e635"
            font.pixelSize: 13
        }
    }

    // ---- font + color ----
    // 期望：字号 18px，粗体，文字为青色；字段宽度跟随内容
    Text { text: "Style: font / color"; color: "#e8e8e8"; font.pixelSize: 14 }
    TextField {
        text: "Styled input"
        font.pixelSize: 18
        font.bold: true
        color: "#22d3ee"
        width: 240
    }

    // ---- TextArea wrapMode ----
    // 期望：WordWrap 时长文本在宽度边界自动换行；高度随行数增长
    Text { text: "TextArea: wrapMode + multiline"; color: "#e8e8e8"; font.pixelSize: 14 }
    TextArea {
        placeholderText: "Multi-line input — wraps at word boundaries (WordWrap)"
        wrapMode: TextEdit.WordWrap
        width: 420
        height: 80
        font.pixelSize: 13
    }

    // ---- palette.base / text / placeholderText ----
    // 期望：输入框背景变为深色 #1e1e2e；文字为浅色；占位符为灰紫色
    Text { text: "Theme: palette.base / text / placeholderText"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        TextField {
            placeholderText: "Custom palette"
            width: 220
            palette.base: "#1e1e2e"
            palette.text: "#cdd6f4"
            palette.placeholderText: "#6c7086"
        }
        TextField {
            text: "Has content"
            width: 180
            palette.base: "#1e1e2e"
            palette.text: "#a6e3a1"
        }
    }

    // ---- 状态反馈 ----
    Label {
        id: statusLabel
        text: "Status: (interact with fields)"
        color: "#60a5fa"
        font.pixelSize: 13
    }
}

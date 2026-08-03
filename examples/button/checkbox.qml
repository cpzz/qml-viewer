import QtQuick
import QtQuick.Controls

// ================================================================
// CheckBox 属性与信号综合验证
// 验证项：
//   checked 双态切换
//   tristate + nextCheckState 自定义三态循环
//   父子 CheckBox 联动：全选 / 部分选中 / 全不选
//   checkState 值：Qt.Unchecked / Qt.PartiallyChecked / Qt.Checked
//   enabled / disabled 状态渲染
//   clicked / pressed / toggled 信号
// ================================================================

ColumnLayout {
    spacing: 10

    function checkStateName(state) {
        if (state === Qt.Checked)          return "Checked"
        if (state === Qt.PartiallyChecked) return "PartiallyChecked"
        return "Unchecked"
    }

    // ---- 双态：clicked / toggled / pressed 信号 ----
    Text { text: "Mode: two-state with signals"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        CheckBox {
            id: firstBox
            text: "First"
            checked: true
            // 两态 CheckBox 用 checked 属性反映状态
            onClicked:  statusText.text = "clicked: " + text + " \u2192 " + (checked ? "Checked" : "Unchecked")
            onToggled:  console.log("toggled:", text, checked ? "Checked" : "Unchecked")
            onPressed:  console.log("pressed:", text)
        }
        CheckBox {
            id: secondBox
            text: "Second"
            onClicked: statusText.text = "clicked: " + text + " \u2192 " + (checked ? "Checked" : "Unchecked")
        }
        Text {
            text: checkStateName(firstBox.checkState) + " / " + checkStateName(secondBox.checkState)
            color: "#a3e635"
            font.pixelSize: 12
        }
    }

    // ---- 父子联动：tristate 父项反映两个子项的选中状态 ----
    // checked: 全选；PartiallyChecked: 部分选；Unchecked: 全不选
    Text { text: "Binding: parent tristate mirrors children state"; color: "#e8e8e8"; font.pixelSize: 14 }
    CheckBox {
        id: parentBox
        text: "Select All"
        tristate: true
        checkState: (firstBox.checked && secondBox.checked) ? Qt.Checked :
                    (firstBox.checked || secondBox.checked) ? Qt.PartiallyChecked : Qt.Unchecked
        nextCheckState: function() {
            if (checkState === Qt.Checked) return Qt.Unchecked
            return Qt.Checked
        }
        onToggled: {
            firstBox.checked  = checkState === Qt.Checked
            secondBox.checked = checkState === Qt.Checked
            statusText.text = "parentBox toggled → " + checkStateName(checkState)
        }
    }

    // ---- 自定义三态循环：Checked → PartiallyChecked → Unchecked → … ----
    Text { text: "Mode: tristate with custom nextCheckState cycle"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        CheckBox {
            id: cycleBox
            text: "Cycle me"
            tristate: true
            checkState: Qt.PartiallyChecked
            nextCheckState: function() {
                if (checkState === Qt.Checked)          return Qt.PartiallyChecked
                if (checkState === Qt.PartiallyChecked) return Qt.Unchecked
                return Qt.Checked
            }
            onClicked:  statusText.text = "tristate: " + checkStateName(checkState)
            onToggled:  console.log("tristate toggled:", checkStateName(checkState))
        }
        Text {
            text: checkStateName(cycleBox.checkState)
            color: "#fb923c"
            font.pixelSize: 12
        }
    }

    // ---- enabled / disabled 状态渲染 ----
    Text { text: "State: enabled / disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        CheckBox {
            text: "Enabled"
            checked: true
            onClicked: statusText.text = "clicked: Enabled"
        }
        CheckBox {
            text: "Disabled (checked)"
            checked: true
            enabled: false
        }
        CheckBox {
            text: "Disabled (unchecked)"
            enabled: false
        }
    }

    // ---- 状态反馈 ----
    Text {
        id: statusText
        text: "Status: (interact with the checkboxes)"
        color: "#60a5fa"
        font.pixelSize: 13
    }
}

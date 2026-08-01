import QtQuick.Controls

// =====================================================================
// DelayButton 格式化 + 动画曲线 + 颜色语法 综合验证用例
// =====================================================================
// 1) 格式化：文件末尾的 `}}}}`（Messy 块）以及其中所有嵌套缩进都是
//    故意写乱的 —— 执行格式化后应逐级拆行、并与对应的 `{` 对齐。
// 2) 动画曲线：九个 DelayButton 的 transition 都声明了 progress 动画，
//    duration 统一 800ms、easing 各不相同 —— 按住按钮即可对比曲线；
//    过冲型（OutBack / OutElastic / OutBounce）可观察填充条先越过
//    100% 再回落的视觉效果（progress 属性保留原始曲线值）。
// 3) 颜色语法：验证 QML color 值类型 —— SVG 命名色（"tomato"）、
//    Qt.rgba()/Qt.hsla() 函数、8 位 ARGB hex（#AARRGGBB 半透明）、
//    Behavior on color + ColorAnimation 插值。
// =====================================================================

ColumnLayout {
    // ---------- 曲线组 1：基础缓动 ----------
    RowLayout {
        ColumnLayout {
            DelayButton {
                text: "Linear"
                delay: 2000
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.Linear
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
        ColumnLayout {
            DelayButton {
                text: "OutQuad"
                delay: 2000
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.OutQuad
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
        ColumnLayout {
            DelayButton {
                text: "InOutCubic"
                delay: 2000
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.InOutCubic
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
    }

    // ---------- 曲线组 2：过冲 / 回弹 / 弹跳 ----------
    RowLayout {
        ColumnLayout {
            DelayButton {
                text: "OutBack"
                delay: 2000
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.OutBack
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
        ColumnLayout {
            DelayButton {
                text: "OutBounce"
                delay: 2000
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.OutBounce
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
        ColumnLayout {
            DelayButton {
                text: "OutElastic"
                delay: 2000
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.OutElastic
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
    }

    // ---------- 颜色语法组：命名色 / Qt.rgba / ARGB hex ----------
    RowLayout {
        ColumnLayout {
            DelayButton {
                text: "Named Colors"
                delay: 1500
                background: Rectangle {
                    color: "#333333"
                    radius: 4
                    Rectangle {
                        width: parent.width * control.progress
                        height: parent.height
                        color: control.progress >= 1.0 ? "tomato" : "steelblue"
                        radius: 4
                        Behavior on color { ColorAnimation { duration: 200 } }
                    }
                }
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.OutCubic
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
        ColumnLayout {
            DelayButton {
                text: "Qt.rgba"
                delay: 1500
                background: Rectangle {
                    color: Qt.rgba(0, 0, 0, 0.25)
                    radius: 4
                    Rectangle {
                        width: parent.width * control.progress
                        height: parent.height
                        color: control.progress >= 1.0 ? Qt.rgba(1, 0.3, 0, 0.9) : Qt.rgba(0, 0.6, 1, 0.5)
                        radius: 4
                        Behavior on color { ColorAnimation { duration: 200 } }
                    }
                }
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.InOutExpo
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
        ColumnLayout {
            DelayButton {
                text: "ARGB Hex"
                delay: 1500
                background: Rectangle {
                    color: "#26000000"
                    radius: 4
                    Rectangle {
                        width: parent.width * control.progress
                        height: parent.height
                        color: control.progress >= 1.0 ? "#E64CAF50" : "#8090CBF9"
                        radius: 4
                        Behavior on color { ColorAnimation { duration: 200 } }
                    }
                }
                transition: Transition {
                    NumberAnimation {
                        property: "progress"
                        duration: 800
                        easing.type: Easing.OutBounce
                    }
                }
                onActivated: console.log("Activated: ", text, progress)
            }
        }
    }

    // ---------- 复杂嵌套 + control / Behavior / Qt 颜色函数 ----------
    // 内容正确、缩进故意错乱；末尾 `}}}}}` 需拆成五行并逐级对齐
    ColumnLayout {
        RowLayout {
        ColumnLayout {
            DelayButton {
                    text: "Messy Nested"
            delay: 800
                onPressed: {
                        console.log("Pressed: ", text)
                }
                onClicked: {
                    console.log("Clicked: ", text)
        }
        background: Rectangle {
                color: "#333333"
            radius: 4
                    Rectangle {
                width: parent.width * control.progress
                        height: parent.height
                color: control.progress >= 1.0 ? Qt.hsla(0.33, 0.9, 0.45, 1) : Qt.hsla(0.58, 0.85, 0.6, 0.55)
                            radius: 4
                Behavior on color { ColorAnimation { duration: 200 } }
            }
        }
            transition: Transition {
            NumberAnimation {
                    property: "progress"
                duration: 800
                        easing.type: Easing.InExpo
            }
        }
            onActivated: console.log("Activated: ", text, progress)
    }
        }
    }
}
}

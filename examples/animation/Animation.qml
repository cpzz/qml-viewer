import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// NumberAnimation / PropertyAnimation / Behavior / States 综合验证
// 验证项：
//   NumberAnimation target / property / from / to / duration / easing
//   PropertyAnimation 颜色 / 位置 / 透明度动画
//   Behavior on property 属性变化自动驱动
//   SequentialAnimation / ParallelAnimation 组合动画
//   States + Transitions 状态机
//   RotationAnimation / ScaleAnimator
// ================================================================

ColumnLayout {
    spacing: 16

    // ---- NumberAnimation 位置 ----
    // 期望：点击后方块在 600ms 内从左滑动到右（EaseInOut）；再次点击反向
    Text { text: "NumberAnimation: x position (EaseInOut, 600ms)"; color: "#e8e8e8"; font.pixelSize: 14 }
    Item {
        width: 360; height: 50
        Rectangle {
            id: mover
            width: 50; height: 50; radius: 6
            color: "#3b82f6"
            x: 0

            NumberAnimation on x {
                id: moveRight
                to: 310; duration: 600
                easing.type: Easing.InOutQuad
                running: false
            }
            NumberAnimation on x {
                id: moveLeft
                to: 0; duration: 600
                easing.type: Easing.InOutQuad
                running: false
            }
        }
        MouseArea {
            anchors.fill: parent
            onClicked: {
                if (mover.x < 155) { moveRight.restart() }
                else               { moveLeft.restart()  }
            }
        }
    }

    // ---- Behavior on property ----
    // 期望：点击后高度平滑变化（300ms EaseOut）；颜色平滑过渡
    Text { text: "Behavior on height + color"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        Rectangle {
            id: behaviorBox
            width: 100; radius: 6
            height: 40
            color: "#6366f1"

            Behavior on height { NumberAnimation { duration: 300; easing.type: Easing.OutCubic } }
            Behavior on color  { ColorAnimation  { duration: 300 } }

            Text { anchors.centerIn: parent; text: "Click"; color: "white"; font.pixelSize: 13 }
            MouseArea {
                anchors.fill: parent
                onClicked: {
                    behaviorBox.height = (behaviorBox.height === 40) ? 110 : 40
                    behaviorBox.color  = (behaviorBox.color === "#6366f1") ? "#ec4899" : "#6366f1"
                }
            }
        }
        Label { text: "h = " + behaviorBox.height.toFixed(0); color: "#a5b4fc"; font.pixelSize: 13; width: 100 }
    }

    // ---- SequentialAnimation ----
    // 期望：依次执行：右移 → 淡出 → 淡入 → 左移；点击触发
    Text { text: "SequentialAnimation: move → fade out → fade in → return"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        Rectangle {
            id: seqBox
            width: 50; height: 50; radius: 6; color: "#f59e0b"
            x: 0; opacity: 1

            SequentialAnimation {
                id: seqAnim
                NumberAnimation  { target: seqBox; property: "x";       to: 200; duration: 350; easing.type: Easing.OutQuad }
                NumberAnimation  { target: seqBox; property: "opacity"; to: 0;   duration: 200 }
                NumberAnimation  { target: seqBox; property: "opacity"; to: 1;   duration: 200 }
                NumberAnimation  { target: seqBox; property: "x";       to: 0;   duration: 350; easing.type: Easing.InQuad  }
            }
        }
        Button {
            text: "Run Sequence"
            onClicked: seqAnim.restart()
        }
    }

    // ---- ParallelAnimation ----
    // 期望：x 和 scale 同时变化（300ms）
    Text { text: "ParallelAnimation: x + scale simultaneously"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        Item {
            width: 180; height: 80
            Rectangle {
                id: parBox
                width: 50; height: 50; radius: 6; color: "#10b981"
                x: 0; y: 15; scale: 1

                ParallelAnimation {
                    id: parAnim
                    NumberAnimation { target: parBox; property: "x";     from: 0; to: 100; duration: 600; easing.type: Easing.InOutBack }
                    NumberAnimation { target: parBox; property: "scale"; from: 1; to: 1.6; duration: 600; easing.type: Easing.InOutBack }
                }
                ParallelAnimation {
                    id: parReturn
                    NumberAnimation { target: parBox; property: "x";     from: 100; to: 0; duration: 600; easing.type: Easing.InOutBack }
                    NumberAnimation { target: parBox; property: "scale"; from: 1.6; to: 1; duration: 600; easing.type: Easing.InOutBack }
                }
            }
        }
        Button {
            text: "Go"
            onClicked: { if (parBox.x < 50) parAnim.restart(); else parReturn.restart() }
        }
    }

    // ---- States + Transitions ----
    // 期望：default → hover → pressed 三个状态；Transition 驱动颜色和大小平滑变化
    Text { text: "States + Transitions"; color: "#e8e8e8"; font.pixelSize: 14 }
    Rectangle {
        id: stateBox
        width: 120; height: 44; radius: 6
        color: "#334155"
        state: "default"

        states: [
            State {
                name: "default"
                PropertyChanges { target: stateBox; color: "#334155"; scale: 1.0 }
            },
            State {
                name: "hovered"
                PropertyChanges { target: stateBox; color: "#3b82f6"; scale: 1.05 }
            },
            State {
                name: "pressed"
                PropertyChanges { target: stateBox; color: "#1d4ed8"; scale: 0.96 }
            }
        ]

        transitions: [
            Transition {
                ColorAnimation  { duration: 150 }
                NumberAnimation { property: "scale"; duration: 100; easing.type: Easing.OutQuad }
            }
        ]

        Text {
            anchors.centerIn: parent
            text: stateBox.state
            color: "white"; font.pixelSize: 12
        }

        MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            onEntered:  stateBox.state = "hovered"
            onExited:   stateBox.state = "default"
            onPressed:  stateBox.state = "pressed"
            onReleased: stateBox.state = containsMouse ? "hovered" : "default"
        }
    }
}

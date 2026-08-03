import QtQuick
import QtQuick.Layouts

// ================================================================
// ColumnLayout / RowLayout 属性综合验证
// 验证项：
//   Layout.minimumWidth/Height / maximumWidth/Height 尺寸约束
//   Layout.fillWidth / fillHeight 拉伸充填
//   Layout.alignment （AlignTop / AlignVCenter / AlignBottom）
//   Layout.alignment （AlignLeft / AlignHCenter / AlignRight）
//   Layout.margins / leftMargin / rightMargin / topMargin / bottomMargin
//   Layout.horizontalStretchFactor / verticalStretchFactor 拉伸比例
//   ColumnLayout.layoutDirection: Qt.RightToLeft（RTL 居中反转）
//   ColumnLayout.uniformCellSizes（统一单元格大小）
// ================================================================

ColumnLayout {
    spacing: 12

    Text { text: "Size constraints"; color: "#e8e8e8"; font.pixelSize: 16 }
    RowLayout {
        Layout.preferredWidth: 560
        Layout.preferredHeight: 70
        spacing: 8

        Rectangle {
            id: minimumBox
            Layout.minimumWidth: 100
            Layout.minimumHeight: 52
            Layout.preferredWidth: 40
            Layout.preferredHeight: 30
            color: "#d1495b"
            Text { id: minimumText; anchors.centerIn: parent; text: "minimum\n100 x 52"; color: "white" }
        }
        Rectangle {
            id: maximumBox
            Layout.preferredWidth: 180
            Layout.preferredHeight: 70
            Layout.maximumWidth: 120
            Layout.maximumHeight: 48
            color: "#00798c"
            Text { anchors.centerIn: parent; text: "maximum\n120 x 48"; color: "white" }
        }
    }

    Text { text: "Fill width and height"; color: "#e8e8e8"; font.pixelSize: 16 }
    RowLayout {
        Layout.preferredWidth: 560
        Layout.preferredHeight: 76
        spacing: 8

        Rectangle {
            Layout.preferredWidth: 100
            Layout.preferredHeight: 42
            color: "#edae49"
            Text { anchors.centerIn: parent; text: "fixed"; color: "#202020" }
        }
        Rectangle {
            id: fillBox
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumWidth: 120
            Layout.maximumWidth: 440
            Layout.preferredWidth: 180
            Layout.preferredHeight: 42
            color: "#30638e"
            Text { anchors.centerIn: parent; text: "Layout.fillWidth + fillHeight"; color: "white" }
        }
    }

    Text { text: "Alignment"; color: "#e8e8e8"; font.pixelSize: 16 }
    RowLayout {
        Layout.preferredWidth: 560
        Layout.preferredHeight: 92
        spacing: 8

        Rectangle {
            id: alignTopBox
            Layout.preferredWidth: 90
            Layout.preferredHeight: 34
            Layout.alignment: Qt.AlignTop
            color: "#7a5195"
            Text { anchors.centerIn: parent; text: "top"; color: "white" }
        }
        Rectangle {
            Layout.preferredWidth: 90
            Layout.preferredHeight: 34
            Layout.alignment: Qt.AlignVCenter
            color: "#ef5675"
            Text { anchors.centerIn: parent; text: "center"; color: "white" }
        }
        Rectangle {
            Layout.preferredWidth: 90
            Layout.preferredHeight: 34
            Layout.alignment: Qt.AlignBottom
            color: "#ffa600"
            Text { anchors.centerIn: parent; text: "bottom"; color: "#202020" }
        }
    }
    ColumnLayout {
        Layout.preferredWidth: 560
        spacing: 4

        Rectangle { Layout.preferredWidth: 110; Layout.preferredHeight: 24; Layout.alignment: Qt.AlignLeft; color: "#4c78a8" }
        Rectangle { Layout.preferredWidth: 110; Layout.preferredHeight: 24; Layout.alignment: Qt.AlignHCenter; color: "#72b7b2" }
        Rectangle { Layout.preferredWidth: 110; Layout.preferredHeight: 24; Layout.alignment: Qt.AlignRight; color: "#f58518" }
    }

    Text { text: "Margins"; color: "#e8e8e8"; font.pixelSize: 16 }
    RowLayout {
        Layout.preferredWidth: 560
        Layout.preferredHeight: 90
        spacing: 0

        Rectangle {
            id: marginBox
            Layout.preferredWidth: 120
            Layout.preferredHeight: 48
            Layout.margins: 12
            color: "#54a24b"
            Text { anchors.centerIn: parent; text: "margins: 12"; color: "white" }
        }
        Rectangle {
            id: individualMarginBox
            Layout.preferredWidth: 150
            Layout.preferredHeight: 48
            Layout.leftMargin: 24
            Layout.rightMargin: 8
            Layout.topMargin: 4
            Layout.bottomMargin: 18
            color: "#e45756"
            Text { anchors.centerIn: parent; text: "L24 R8 T4 B18"; color: "white" }
        }
    }

    Text { text: "Horizontal stretch 1 : 2"; color: "#e8e8e8"; font.pixelSize: 16 }
    RowLayout {
        Layout.preferredWidth: 560
        Layout.preferredHeight: 56
        spacing: 8

        Rectangle {
            id: horizontalOne
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.horizontalStretchFactor: 1
            Layout.preferredWidth: 60
            Layout.preferredHeight: 40
            color: "#4c78a8"
            Text { anchors.centerIn: parent; text: "1"; color: "white" }
        }
        Rectangle {
            id: horizontalTwo
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.horizontalStretchFactor: 2
            Layout.preferredWidth: 60
            Layout.preferredHeight: 40
            color: "#f58518"
            Text { anchors.centerIn: parent; text: "2"; color: "white" }
        }
    }

    Text { text: "Vertical stretch 1 : 2"; color: "#e8e8e8"; font.pixelSize: 16 }
    ColumnLayout {
        Layout.preferredWidth: 560
        Layout.preferredHeight: 150
        spacing: 6

        Rectangle {
            id: verticalOne
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.verticalStretchFactor: 1
            Layout.preferredWidth: 100
            Layout.preferredHeight: 30
            color: "#72b7b2"
            Text { anchors.centerIn: parent; text: "1"; color: "#202020" }
        }
        Rectangle {
            id: verticalTwo
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.verticalStretchFactor: 2
            Layout.preferredWidth: 100
            Layout.preferredHeight: 30
            color: "#b279a2"
            Text { anchors.centerIn: parent; text: "2"; color: "white" }
        }
    }

    Text { text: "Layout direction: RightToLeft"; color: "#e8e8e8"; font.pixelSize: 16 }
    ColumnLayout {
        Layout.preferredWidth: 560
        layoutDirection: Qt.RightToLeft
        spacing: 6

        Rectangle {
            id: directionLeft
            Layout.preferredWidth: 150
            Layout.preferredHeight: 34
            Layout.alignment: Qt.AlignLeft
            color: "#2a9d8f"
            Text { anchors.centerIn: parent; text: "AlignLeft -> right"; color: "white" }
        }
        Rectangle {
            id: directionRight
            Layout.preferredWidth: 150
            Layout.preferredHeight: 34
            Layout.alignment: Qt.AlignRight
            color: "#e76f51"
            Text { anchors.centerIn: parent; text: "AlignRight -> left"; color: "white" }
        }
    }

    Text { text: "Uniform cells with spacing: 6"; color: "#e8e8e8"; font.pixelSize: 16 }
    ColumnLayout {
        Layout.preferredWidth: 560
        uniformCellSizes: true
        spacing: 6

        Rectangle {
            id: uniformShort
            Layout.preferredWidth: 180
            Layout.preferredHeight: 24
            color: "#577590"
            Text { anchors.centerIn: parent; text: "preferredHeight: 24"; color: "white" }
        }
        Rectangle {
            id: uniformTall
            Layout.preferredWidth: 180
            // 是否被展寄到大单元格大小（uniformCellSizes = true）
            Layout.preferredHeight: 50
            color: "#f3722c"
            Text { anchors.centerIn: parent; text: "preferredHeight: 50 (all cells match)"; color: "white" }
        }
    }
}

import QtQuick.Controls

ToolBar {
    RowLayout {
        anchors.fill: parent
        ToolButton {
            text: qsTr("‹")
            onClicked: stack.pop()
        }
        Label {
            text: "Title"
            elide: Label.ElideRight
            horizontalAlignment: Qt.AlignHCenter
            verticalAlignment: Qt.AlignVCenter
            Layout.fillWidth: true
        }
        ToolButton {
            text: qsTr("⋮")
            onClicked: menu.open()
        }
    }
}

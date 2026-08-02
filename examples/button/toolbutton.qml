import QtQuick.Controls

ApplicationWindow {
    visible: true
    width: 400
    height: 300

    header: ToolBar {
        RowLayout {
            anchors.fill: parent
            ToolButton {
                text: qsTr("‹")
                onClicked: console.log("< Pressed")
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
                onClicked: console.log("⋮ Pressed")
            }
            ToolButton {
                text: qsTr("Help")
                onClicked: console.log("Help Pressed")
            }
        }
    }
}

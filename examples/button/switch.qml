import QtQuick.Controls

ColumnLayout {
    Switch {
        text: qsTr("Wi-Fi")
        onToggled: {
            console.log("Toggled: ", text)
        }
        onClicked: {
            console.log("Clicked: ", text)
        }
    }
    Switch {
        text: qsTr("Bluetooth")
    }
}

import QtQuick.Controls

ColumnLayout {
    RadioButton {
        checked: true
        text: qsTr("First")
    }
    RadioButton {
        text: qsTr("Second")
    }
    RadioButton {
        text: qsTr("Third")
    }
}

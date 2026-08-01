import QtQuick.Controls

ColumnLayout {
    RowLayout {
        Button {
            text: "Ok"
            highlighted: true
            onClicked: console.log("Clicked OK.")
            onPressed: console.log("Press OK.")
            onReleased: console.log("Released OK.")
        }

        Button {
            text: "Cancel"
            onClicked: console.log("Press Cancel.")
            flat: true
        }

    }
}

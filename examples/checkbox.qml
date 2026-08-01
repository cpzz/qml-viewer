import QtQuick.Controls

ColumnLayout {
    property bool allChildrenChecked: false
    property bool anyChildChecked: true

    function getCheckState(state) {
        if (state == Qt.Checked) {
            return "Checked"
        }
        else if (state == Qt.PartiallyChecked) {
            return "PartiallyChecked"
        }
        else {
            return "Unchecked"
        }
    }

    CheckBox {
        text: "First"
        checked: true
        onClicked: {
            console.log("Pressed: ", text, getCheckState(checkState))
        }

    }
    CheckBox {
        text: "Second"
        onClicked: {
            console.log("Pressed: ", text)
        }
    }

    CheckBox {
        text: "Third"
        tristate: true
        checkState: allChildrenChecked ? Qt.Checked :
        anyChildChecked ? Qt.PartiallyChecked : Qt.Unchecked

        nextCheckState: function() {
            console.log("hahaha")
            console.log("nextCheckState: ", checkState)
            if (checkState === Qt.Checked)
                return Qt.PartiallyChecked
            else if (checkState === Qt.PartiallyChecked)
                return Qt.Unchecked
            else
                return Qt.Checked
        }
        
        onClicked: {
            console.log("Pressed: ", text)
        }
        onPressed: {
            console.log("Pressed: ", text)
        }
        onToggled: {
            console.log("toggled: ", text)    
        }
    }
}

function checkPrivateKeys() {
    var jsonInput = document.getElementById("jsonInput").value;
    var parsedJSON;
    try {
        parsedJSON = JSON.parse(jsonInput);
    } catch (error) {
        document.getElementById("result").innerText = "Invalid JSON!";
        return;
    }

    var suspectKeys = findSuspectKeys(parsedJSON);

    if (suspectKeys.length > 0) {
        var resultText = "Suspect Keys Found: <br>";
        suspectKeys.forEach(function (key) {
            resultText += key + "<br>";
        });
        document.getElementById("result").innerHTML = resultText;
    } else {
        document.getElementById("result").innerText = "No suspect private keys found.";
    }
}

function findSuspectKeys(json) {
    var suspectKeys = [];

    traverse(json, function (key, value) {
        if (typeof value === "string" && value.length === 64) {
            suspectKeys.push(value);
        }
    });

    return suspectKeys;
}

function traverse(obj, callback) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            callback.apply(this, [key, obj[key]]);
            if (typeof obj[key] === "object" && obj[key] !== null) {
                traverse(obj[key], callback);
            }
        }
    }
}


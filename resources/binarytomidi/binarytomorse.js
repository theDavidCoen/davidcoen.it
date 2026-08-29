function hexToBinAndMorse() {
	// Get the input element and result elements
	var input = document.getElementById("hexInput");
	var binOutput = document.getElementById("binOutput");
	var morseOutput = document.getElementById("morseOutput");

	// Split the input into separate lines and process each line
	var lines = input.value.split("\n");
	var binString = "";
	var morseString = "";
	for (var i = 0; i < lines.length; i++) {
		// Trim whitespace and remove any leading "0x" or "0X"
		var hexString = lines[i].trim().replace(/^0x/i, "");

		// Convert the hex string to a binary string
		var binaryString = parseInt(hexString, 16).toString(2);

		// Add leading zeros to pad to 8 bits
		while (binaryString.length < 8) {
			binaryString = "0" + binaryString;
		}

		// Add the binary string to the output with a newline
		binString += binaryString + "\n";

		// Convert the binary string to Morse code
		var morseCode = "";
		for (var j = 0; j < binaryString.length; j++) {
			if (binaryString.charAt(j) == "1") {
				morseCode += "-";
			} else {
				morseCode += ".";
			}
		}
		morseString += morseCode + "\n";
	}

	// Set the output elements to the generated strings, separated by a newline character
	binOutput.value = binString.trim() + "\n";
	morseOutput.value = morseString.trim() + "\n";
}

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let possibleCombinations = [];
let currentPage = 0;
let pageSize = 21;

function generateCombinations() {
  let privateKey = document.getElementById("privateKey").value;
  let resultDiv = document.getElementById("result");
  let nextButton = document.getElementById("next-button");
  let previousButton = document.getElementById("previous-button");
  let copyButton = document.getElementById("copy-button");
  if (!privateKey.match(/^[A-Za-z0-9#]{52}$/)) {
    resultDiv.innerHTML = "Invalid private key format";
    return;
  }
  let missingIndexes = [];
  for (let i = 0; i < privateKey.length; i++) {
    if (privateKey[i] === "#") {
      missingIndexes.push(i);
    }
  }
  if (missingIndexes.length === 0) {
    resultDiv.innerHTML = "Private key is complete. No missing characters.";
    return;
  }

  possibleCombinations = [privateKey];
  for (let i = 0; i < missingIndexes.length; i++) {
    let currentMissingIndex = missingIndexes[i];
    let newCombinations = [];
    for (let j = 0; j < possibleCombinations.length; j++) {
      let currentCombination = possibleCombinations[j];
      for (let k = 0; k < characters.length; k++) {
        let currentChar = characters[k];
        newCombinations.push(
          currentCombination.substr(0, currentMissingIndex) +
            currentChar +
            currentCombination.substr(currentMissingIndex + 1)
        );
      }
    }
    possibleCombinations = newCombinations;
  }
  currentPage = 0;
  showCombinations();
}

function showCombinations() {
    let resultDiv = document.getElementById("result");
    let startIndex = currentPage * pageSize;
    let endIndex = startIndex + pageSize;
    resultDiv.innerHTML = "Possible combinations:<br>" + possibleCombinations.slice(startIndex, endIndex).join("<br>");
    document.getElementById("next-button").disabled = endIndex >= possibleCombinations.length;
    document.getElementById("previous-button").disabled = startIndex <= 0;
    document.getElementById("copy-button").disabled = possibleCombinations.length == 0;
}

function nextCombinations() {
    currentPage++;
    showCombinations();
}

function previousCombinations() {
    currentPage--;
    showCombinations();
}

function copyCombinations() {
    navigator.clipboard.writeText(possibleCombinations.join("\n")).then(function() {
        alert("Combinations have been copied to the clipboard.");
    });
}

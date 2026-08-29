// Get the HTML elements we need to interact with
const wordInput = document.getElementById('wordInput');
const checkBtn = document.getElementById('checkBtn');
const resultText = document.getElementById('resultText');
const wordTable = document.getElementById('wordTable');

// Add event listener to the button click event
checkBtn.addEventListener('click', function() {
  // Get the value of the input field
  const inputWord = wordInput.value.trim().toLowerCase();

  // Loop through each row of the table body
  for (let i = 0; i < wordTable.tBodies[0].rows.length; i++) {
    // Get the text content of the second cell (word) of the current row
    const rowText = wordTable.tBodies[0].rows[i].cells[1].textContent.trim().toLowerCase();
    
    // Check if the input word matches the current row text
    if (inputWord === rowText) {
      resultText.textContent = 'PASS';
      return;
    }
  }

  // If no matches found, display the fail message
  resultText.textContent = 'FAIL: incorrect word';
});

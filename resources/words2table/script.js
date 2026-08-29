function generateTable() {
  // Get the word list from the input field
  const wordList = document.getElementById("wordList").value.trim();

  // Split the word list into an array of individual words
  const words = wordList.split(/\s+/);

  // Get the table body where we'll insert our rows
  const tableBody = document.querySelector("#wordTable tbody");

  // Clear any existing rows from the table body
  tableBody.innerHTML = "";

  // Loop over the words and create a new table row for each one
  for (let i = 0; i < words.length; i++) {
    const row = document.createElement("tr");
    const numberCell = document.createElement("td");
    const wordCell = document.createElement("td");

    // Set the text content of the number and word cells
    numberCell.textContent = i + 1;
    wordCell.textContent = words[i];

    // Add the cells to the row
    row.appendChild(numberCell);
    row.appendChild(wordCell);

    // Add the row to the table body
    tableBody.appendChild(row);
  }
}

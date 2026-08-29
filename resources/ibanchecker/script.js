document.addEventListener("DOMContentLoaded", function() {
  var table = document.getElementById("country-table");
  var rows = table.getElementsByTagName("tr");
  
  for (var i = 0; i < rows.length; i++) {
    if (i % 2 === 0) {
      rows[i].classList.add("even-row");
    } else {
      rows[i].classList.add("odd-row");
    }
  }
});

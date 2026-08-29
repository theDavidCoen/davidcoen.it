document.getElementById("offerForm").addEventListener("submit", function(event) {
    event.preventDefault();
    
    const offer = document.getElementById("offer").value;
    const username = document.getElementById("username").value;
    const errorElement = document.getElementById("error");

    if (!offer.startsWith("lno1")) {
        errorElement.innerText = "Error: this is not a valid Lightning offer.";
        return;
    } else {
        errorElement.innerText = "";
    }

    const nameField = `${username}.user._bitcoin-payment`;
    const valueField = `bitcoin:?lno=${offer}`;

    document.getElementById("nameField").innerText = nameField;
    document.getElementById("valueField").innerText = valueField;
});

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(function() {
        alert('Copied to clipboard!');
    }, function(err) {
        alert('Failed to copy: ', err);
    });
}


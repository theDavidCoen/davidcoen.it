// Function to fetch data from the provided URL
async function fetchData() {
  try {
    const response = await fetch('https://data.bity.com/countries/compendium');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Function to check the risk level based on IBAN
async function checkCountry() {
  const ibanInput = document.getElementById('iban-input').value;
  const ibanCountryCode = ibanInput.substring(0, 2).toUpperCase();
  const data = await fetchData();
  const selectedCountry = data.find(country => country.iso_3166_alpha2 === ibanCountryCode);

  if (selectedCountry) {
    if (selectedCountry.sepa_member) {
      if (selectedCountry.risk_level === 'low') {
        document.getElementById('result').innerText = 'Low Risk country, use SEPA Bank Transfer to buy or sell crypto.';
      } else if (selectedCountry.risk_level === 'high') {
        document.getElementById('result').innerText = 'High Risk country. You cannot use SEPA Bank Transfer to buy or sell crypto, unfortunately.';
      }
    } else {
      document.getElementById('result').innerText = 'You cannot use SEPA Bank Transfer to buy or sell crypto, unfortunately.';
    }
  } else {
    document.getElementById('result').innerText = 'Country not found in SEPA Area.';
  }
}


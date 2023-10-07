const peopleElement = document.getElementById('people');
const peopleData = peopleElement.getAttribute('data-points');
const people = JSON.parse(peopleData);

// Function to populate the dropdown with personId options
function populateDropdown() {
    const dropdown = document.getElementById('personIdDropdown');
    people.forEach(personId => {
        const option = document.createElement('option');
        option.value = personId;
        option.textContent = personId;
        dropdown.appendChild(option);
    });
}

// Event listener for form submission
document.getElementById('personIdForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent the form from submitting traditionally
    const selectedPersonId = document.getElementById('personIdDropdown').value;
    // Redirect to the selected personId's map page
    window.location.href = `/map/${selectedPersonId}`;
});

// Populate the dropdown when the page loads
window.onload = populateDropdown;
const peopleElement = document.getElementById('people');
const peopleData = peopleElement.getAttribute('data-points');
const people = JSON.parse(peopleData);

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
    event.preventDefault(); 
    const selectedPersonId = document.getElementById('personIdDropdown').value;
    window.location.href = `/map/${selectedPersonId}`;
});
window.onload = populateDropdown;
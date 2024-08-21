const peopleElement = document.getElementById('people');
const peopleData = peopleElement.getAttribute('data-points');
const people = JSON.parse(peopleData);

const isAuthenticated = document.body.getAttribute('data-is-authenticated') === 'true';

window.onload = function() {
    populateDropdown();
};

function populateDropdown() {
    const dropdown = document.getElementById('personIdDropdown');
    people.forEach(personId => {
        const option = document.createElement('option');
        option.value = personId;
        option.textContent = personId;
        dropdown.appendChild(option);
    });
}


if (isAuthenticated) { //if user is logged in
    document.getElementById('logoutForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const response = await fetch('/logout', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    
        if (response.ok) {
            alert('Logout successful!');
            window.location.href = '/';
        } else {
            alert('Logout failed. Please try again.');
        }
    });
}

//Event listener for form submission
document.getElementById('personIdForm').addEventListener('submit', function (event) {
    event.preventDefault(); 
    const selectedPersonId = document.getElementById('personIdDropdown').value;
    window.location.href = `/map/${selectedPersonId}`;
});
const peopleElement = document.getElementById('people');
const peopleData = peopleElement.getAttribute('data-points');
const people = JSON.parse(peopleData);

const isAuthenticated = document.body.getAttribute('data-is-authenticated') === 'true';

document.addEventListener('DOMContentLoaded', function() {
    populateDropdown();
});

function populateDropdown() {
    const dropdown = document.getElementById('personIdDropdown');
    people.forEach(personId => {
        const option = document.createElement('option');
        option.value = personId;
        option.textContent = personId;
        dropdown.appendChild(option);
    });
}

if (isAuthenticated) {
    const logoutForm = document.getElementById('logoutForm');
    if (logoutForm) {
        logoutForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            try {
                const response = await fetch('/logout', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    window.location.replace('/'); //refresh 
                } else {
                    alert(data.message || 'Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('Network error during logout. Please try again.');
            }
        });
    } else {
        console.error('Logout form not found in DOM');
    }
}
//Event listener for form submission
document.getElementById('personIdForm').addEventListener('submit', function (event) {
    event.preventDefault(); 
    const selectedPersonId = document.getElementById('personIdDropdown').value;
    window.location.href = `/map/${selectedPersonId}`;
});
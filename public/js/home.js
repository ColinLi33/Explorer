const peopleElement = document.getElementById('people');
const peopleData = peopleElement.getAttribute('data-points');
const people = JSON.parse(peopleData);

const isAuthenticated = document.body.getAttribute('data-is-authenticated') === 'true';

console.log(isAuthenticated);
window.onload = function() {
    clearFormFields();
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

function clearFormFields() {
    const registrationForm = document.getElementById('registrationForm');
    const loginForm = document.getElementById('loginForm');

    if (registrationForm) {
        document.querySelector('#registrationForm input[name="username"]').value = '';
        document.querySelector('#registrationForm input[name="password"]').value = '';
    }

    if (loginForm) {
        document.querySelector('#loginForm input[name="username"]').value = '';
        document.querySelector('#loginForm input[name="password"]').value = '';
    }
}

if (isAuthenticated) { //if user is logged in
    const registrationForm = document.getElementById('registrationForm');
    const loginForm = document.getElementById('loginForm');

    if (registrationForm) {
        registrationForm.style.display = 'none';
    }

    if (loginForm) {
        loginForm.style.display = 'none';
    }

    document.getElementById('logoutForm').addEventListener('submit', async (event) => {
        event.preventDefault();
    
        const response = await fetch('/logout', {
            method: 'POST',
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
} else { //if user not logged in
    document.getElementById('registrationForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = {
            username: document.querySelector('#registrationForm input[name="username"]').value,
            password: document.querySelector('#registrationForm input[name="password"]').value
        };
        const response = await fetch('/register', {
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(formData)
        });
    
        const data = await response.json();
        if (data.success) {
            alert('Registration successful!');
            document.querySelector('#registrationForm input[name="username"]').value = '';
            document.querySelector('#registrationForm input[name="password"]').value = '';
            //might want to redirect or something
        } else {
            alert('Registration failed: ' + data.message);
        }
    });
    
    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = {
            username: document.querySelector('#loginForm input[name="username"]').value,
            password: document.querySelector('#loginForm input[name="password"]').value
        };
        const response = await fetch('/login', {
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(formData)
        });
    
        const data = await response.json();
        if (data.success) {
            alert('Login successful!');
            window.location.href = `/map/${formData.username}`; //redirect to their map page
        } else {
            alert('Login failed: ' + data.message);
        }
    });

}


//Event listener for form submission
document.getElementById('personIdForm').addEventListener('submit', function (event) {
    console.log("TEST")
    event.preventDefault(); 
    const selectedPersonId = document.getElementById('personIdDropdown').value;
    window.location.href = `/map/${selectedPersonId}`;
});
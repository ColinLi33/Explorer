window.onload = function() {
    clearFormFields();
};

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
        window.location.href = `/map/${formData.username}`;
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
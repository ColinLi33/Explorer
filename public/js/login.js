window.onload = function() {
    // clearFormFields();
};

function clearFormFields() {
    const registrationForm = document.getElementById('registrationForm');
    const loginForm = document.getElementById('loginForm');
    if (registrationForm) {
        registrationForm.reset();
    }
    if (loginForm) {
        loginForm.reset();
    }
}

function hashPassword(password) {
    const salt = 'imsupersalty123'; 
    try {
        const passwordWithSalt = password + salt;
        const hash = CryptoJS.SHA256(passwordWithSalt).toString();
        return hash;
    } catch (error) {
        console.error('Hashing failed:', error);
        throw new Error('Password hashing failed');
    }
}

document.getElementById('registrationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.querySelector('#registrationForm input[name="username"]').value;
    const password = document.querySelector('#registrationForm input[name="password"]').value;
    
    try {
        const hashedPassword = hashPassword(password);
        
        const formData = {
            username: username,
            password: hashedPassword
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
            window.location.href = `/map/${username}`;
        } else {
            alert('Registration failed: ' + data.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed: ' + error.message);
    }
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.querySelector('#loginForm input[name="username"]').value;
    const password = document.querySelector('#loginForm input[name="password"]').value;
    
    try {
        const hashedPassword = hashPassword(password);
        
        const formData = {
            username: username,
            password: hashedPassword
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
            window.location.href = `/map/${username}`; //redirect to their map page
        } else {
            alert('Login failed: ' + data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: ' + error.message);
    }
});
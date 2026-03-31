document.addEventListener('DOMContentLoaded', () => {
    console.log('Auth Script Loaded');

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const showForgotPasswordLink = document.getElementById('show-forgot-password');
    const backToLoginLink = document.getElementById('back-to-login');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    const resetError = document.getElementById('reset-error');
    const resetSuccess = document.getElementById('reset-success');

    // === Helper Functions ===
    function showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
        element.classList.remove('text-green-500');
        element.classList.add('text-red-500');
        setTimeout(() => {
            element.classList.add('hidden');
        }, 3000);
    }

    function showSuccess(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
        element.classList.remove('text-red-500');
        element.classList.add('text-green-500');
        setTimeout(() => {
            element.classList.add('hidden');
        }, 3000);
    }

    function toggleForms(formType) {
        // Clear errors when switching
        loginError.classList.add('hidden');
        signupError.classList.add('hidden');
        if (resetError) resetError.classList.add('hidden');
        if (resetSuccess) resetSuccess.classList.add('hidden');

        // Hide all
        loginForm.classList.add('hidden');
        signupForm.classList.add('hidden');
        if (forgotPasswordForm) forgotPasswordForm.classList.add('hidden');

        // Show requested
        if (formType === 'signup') {
            signupForm.classList.remove('hidden');
            signupForm.classList.add('fade-in');
        } else if (formType === 'forgot' && forgotPasswordForm) {
            forgotPasswordForm.classList.remove('hidden');
            forgotPasswordForm.classList.add('fade-in');
        } else {
            loginForm.classList.remove('hidden');
            loginForm.classList.add('fade-in');
        }
    }

    // === Event Listeners for Toggling ===
    if (showSignupLink) showSignupLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms('signup'); });
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms('login'); });
    if (showForgotPasswordLink) showForgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms('forgot'); });
    if (backToLoginLink) backToLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms('login'); });


    // === AUTHENTICATION LOGIC ===

    // 1. SIGN UP
    const signupFormElement = document.getElementById('signup');
    if (signupFormElement) {
        signupFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();

            if (!name || !email || !password) {
                showError(signupError, 'All fields are required.');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                if (response.ok) {
                    const newUser = await response.json();
                    // Auto-login (save session)
                    localStorage.setItem('currentUser', JSON.stringify(newUser));
                    console.log('User registered:', newUser);
                    window.location.href = 'feed.html';
                } else {
                    const errData = await response.json();
                    showError(signupError, errData.error || 'Registration failed.');
                }
            } catch (err) {
                console.error('Backend offline, using localStorage for Signup:', err);
                const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
                if (localUsers.find(u => u.email === email)) {
                    showError(signupError, 'Email already registered.');
                    return;
                }
                const newUser = { name, email, password };
                localUsers.push(newUser);
                localStorage.setItem('users', JSON.stringify(localUsers));
                localStorage.setItem('currentUser', JSON.stringify(newUser));
                console.log('User registered locally:', newUser);
                window.location.href = 'feed.html';
            }
        });
    }

    // 2. LOGIN
    const loginFormElement = document.getElementById('login');
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();

            if (!email || !password) {
                showError(loginError, 'Please enter email and password.');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (response.ok) {
                    const user = await response.json();
                    // Save session
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    console.log('Login successful:', user);
                    window.location.href = 'feed.html';
                } else {
                    const errData = await response.json();
                    showError(loginError, errData.error || 'Invalid email or password.');
                }
            } catch (err) {
                console.error('Backend offline, using localStorage for Login:', err);
                const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
                const user = localUsers.find(u => u.email === email && u.password === password);
                if (user) {
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    console.log('Login successful locally:', user);
                    window.location.href = 'feed.html';
                } else {
                    showError(loginError, 'Invalid email or password.');
                }
            }
        });
    }

    // 3. FORGOT PASSWORD (OTP FLOW)
    const forgotPasswordFormEl = document.getElementById('forgot-password');
    const fpStep1 = document.getElementById('fp-step-1');
    const fpStep2 = document.getElementById('fp-step-2');
    const fpStep3 = document.getElementById('fp-step-3');
    const fpBtn1 = document.getElementById('fp-btn-1');
    const fpBtn2 = document.getElementById('fp-btn-2');

    let currentResetToken = null;

    if (forgotPasswordFormEl) {
        // Step 1: Send OTP
        fpBtn1.addEventListener('click', async () => {
            const email = document.getElementById('reset-email').value.trim();
            if (!email) { showError(resetError, 'Please enter email.'); return; }

            resetError.classList.add('hidden');
            resetSuccess.classList.add('hidden');
            fpBtn1.textContent = 'Sending...';
            fpBtn1.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                if (response.ok) {
                    showSuccess(resetSuccess, 'OTP sent to ' + email);
                    fpStep1.classList.add('hidden');
                    fpStep2.classList.remove('hidden');
                } else {
                    const errData = await response.json();
                    showError(resetError, errData.error || 'Failed to send OTP.');
                }
            } catch (err) {
                console.error('Backend offline, mock OTP sending:', err);
                const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
                if (localUsers.findIndex(u => u.email === email) !== -1) {
                    alert('Backend offline. Mock OTP is 123456. Use this to proceed.');
                    fpStep1.classList.add('hidden');
                    fpStep2.classList.remove('hidden');
                } else {
                    showError(resetError, 'User with this email not found.');
                }
            } finally {
                fpBtn1.textContent = 'Send OTP';
                fpBtn1.disabled = false;
            }
        });

        // Step 2: Verify OTP
        fpBtn2.addEventListener('click', async () => {
            const email = document.getElementById('reset-email').value.trim();
            const otp = document.getElementById('reset-otp').value.trim();
            if (!otp) { showError(resetError, 'Please enter OTP.'); return; }

            resetError.classList.add('hidden');
            fpBtn2.textContent = 'Verifying...';
            fpBtn2.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                if (response.ok) {
                    const data = await response.json();
                    currentResetToken = data.resetToken;
                    showSuccess(resetSuccess, 'OTP verified. Enter new password.');
                    fpStep2.classList.add('hidden');
                    fpStep3.classList.remove('hidden');
                } else {
                    const errData = await response.json();
                    showError(resetError, errData.error || 'Invalid OTP.');
                }
            } catch (err) {
                console.error('Backend offline, mock OTP verify:', err);
                if (otp === '123456') {
                    currentResetToken = 'mock-token';
                    showSuccess(resetSuccess, 'OTP verified. Enter new password.');
                    fpStep2.classList.add('hidden');
                    fpStep3.classList.remove('hidden');
                } else {
                    showError(resetError, 'Invalid mock OTP.');
                }
            } finally {
                fpBtn2.textContent = 'Verify OTP';
                fpBtn2.disabled = false;
            }
        });

        // Step 3: Reset Password
        forgotPasswordFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value.trim();
            const password = document.getElementById('new-password').value.trim();
            if (!password || !currentResetToken) { showError(resetError, 'Invalid session or missing password.'); return; }

            try {
                const response = await fetch('http://localhost:3000/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, resetToken: currentResetToken })
                });

                if (response.ok) {
                    showSuccess(resetSuccess, 'Password reset successfully.');
                    // Reset UI
                    setTimeout(() => {
                        toggleForms('login');
                        fpStep1.classList.remove('hidden');
                        fpStep2.classList.add('hidden');
                        fpStep3.classList.add('hidden');
                        document.getElementById('reset-email').value = '';
                        document.getElementById('reset-otp').value = '';
                        document.getElementById('new-password').value = '';
                        currentResetToken = null;
                    }, 2000);
                } else {
                    const errData = await response.json();
                    showError(resetError, errData.error || 'Password reset failed.');
                }
            } catch (err) {
                console.error('Backend offline, mock reset:', err);
                const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
                const userIndex = localUsers.findIndex(u => u.email === email);
                if (userIndex !== -1 && currentResetToken === 'mock-token') {
                    localUsers[userIndex].password = password;
                    localStorage.setItem('users', JSON.stringify(localUsers));
                    showSuccess(resetSuccess, 'Password reset locally.');
                    setTimeout(() => {
                        toggleForms('login');
                        fpStep1.classList.remove('hidden');
                        fpStep2.classList.add('hidden');
                        fpStep3.classList.add('hidden');
                    }, 2000);
                } else {
                    showError(resetError, 'Failed to reset password locally.');
                }
            }
        });
    }
});

// ============================================
// AUTH.JS - Authentication Logic
// ============================================

// Load configuration
window.API_URL = window.API_CONFIG ? window.API_CONFIG.API_URL : 'http://localhost:5000/api';

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// Get user from localStorage
function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// Save token and user
function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// Clear auth data
function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Check if user is logged in
function isLoggedIn() {
  return !!getToken();
}

// Show alert message
function showAlert(message, type = 'success') {
  const alertDiv = document.getElementById('alert');
  if (!alertDiv) return;

  alertDiv.className = `alert alert-${type} show`;
  alertDiv.textContent = message;
  
  setTimeout(() => {
    alertDiv.classList.remove('show');
  }, 5000);
}

// Toggle Mobile Menu
function toggleMenu() {
  const navLinks = document.getElementById('navLinks');
  if (navLinks) {
    navLinks.classList.toggle('active');
  }
}

// Make API request with token
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    // Try to parse JSON safely (some endpoints may return HTML on error)
    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Fallback: read as text so we can surface HTML/error pages
      const text = await response.text();
      data = { error: text };
    }

    // If unauthorized, clear auth and redirect to login
    if (response.status === 401 || response.status === 403) {
      // Common API message for expired/invalid token
      clearAuth();
      // Inform user and redirect to login after a short delay
      try { showAlert('Session expired or invalid. Please login again.', 'error'); } catch (e) { /* ignore if no alert element */ }
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      throw new Error(data.error || 'Invalid token');
    }

    if (!response.ok) {
      throw new Error((data && data.error) || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ============================================
// REGISTER
// ============================================
async function handleRegister(event) {
  event.preventDefault();
  
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });

    showAlert(data.message, 'success');
    
    // Redirect to login after 2 seconds
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// ============================================
// LOGIN
// ============================================
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    saveAuth(data.token, data.user);
    showAlert('Login successful! Redirecting...', 'success');

    // Redirect based on role
    setTimeout(() => {
      if (data.user.role === 'employer') {
        window.location.href = 'employer-dashboard.html';
      } else if (data.user.role === 'jobseeker') {
        window.location.href = 'jobseeker-dashboard.html';
      } else if (data.user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'jobs.html';
      }
    }, 1500);
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// ============================================
// LOGOUT
// ============================================
function handleLogout() {
  clearAuth();
  showAlert('Logged out successfully', 'success');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

// ============================================
// UPDATE NAVIGATION
// ============================================
function updateNavigation() {
  const navLinks = document.getElementById('navLinks');
  if (!navLinks) return;

  const user = getUser();
  
  if (user) {
    // Employers should go directly to the post-job interface when they click "Jobs"
    const jobsHref = user.role === 'employer' ? 'post-job.html' : 'jobs.html';
    
    // Hide Jobs link for admin
    const jobsLink = user.role === 'admin' ? '' : `<a href="${jobsHref}">Jobs</a>`;

    navLinks.innerHTML = `
      ${jobsLink}
      ${user.role === 'employer' ? '<a href="employer-dashboard.html">Dashboard</a>' : ''}
      ${user.role === 'employer' ? '<a href="profile.html">Profile</a>' : ''}
      ${user.role === 'jobseeker' ? '<a href="jobseeker-dashboard.html">My Applications</a>' : ''}
      ${user.role === 'jobseeker' ? '<a href="profile.html">Profile</a>' : ''}
      ${user.role === 'admin' ? '<a href="admin-dashboard.html">Admin Dashboard</a>' : ''}
      <div class="user-info">
        <span>👤 ${user.name}</span>
        <button class="btn btn-small btn-danger" onclick="handleLogout()">Logout</button>
      </div>
    `;
  }
}

// ============================================
// PROTECT ROUTES
// ============================================
function protectRoute(allowedRoles = []) {
  const user = getUser();
  
  if (!isLoggedIn() || !user) {
    showAlert('Please login to access this page', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return false;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    showAlert('You do not have permission to access this page', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
    return false;
  }

  return true;
}

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  updateNavigation();
});

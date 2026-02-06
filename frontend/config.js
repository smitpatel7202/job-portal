// CONFIG.JS - Environment Configuration
// ============================================

// Development or Production 
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// API URLs
window.API_URL = isProduction 
  ? 'https://job-portal-backend-byb6.onrender.com/api'  // Your Render URL
  : 'http://localhost:5000/api';
window.BASE_URL = isProduction
  ? 'https://job-portal-backend-byb6.onrender.com'     // Your Render URL
  : 'http://localhost:5000';

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_URL, BASE_URL, isProduction };
} else {
  window.API_CONFIG = { API_URL, BASE_URL, isProduction };
}

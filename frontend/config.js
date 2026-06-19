// CONFIG.JS - Environment Configuration
// ============================================

// Make this file idempotent (safe to include multiple times)
(function(global){
  // Use a sentinel so we don't recalculate or redeclare on multiple loads
  if (global.__JOB_PORTAL_CONFIG__) return;

  // Determine environment in a way that works in browser and other runtimes
  const hostname = (global && global.location && global.location.hostname) || 'localhost';
  const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';

  // API URLs
  const API_URL = isProduction
    ? 'https://job-portal-backend-byb6.onrender.com/api'  // Your Render URL
    : 'http://localhost:5000/api';

  const BASE_URL = isProduction
    ? 'https://job-portal-backend-byb6.onrender.com'     // Your Render URL
    : 'http://localhost:5000';

  // Expose to global/window for browser scripts
  try {
    if (global) {
      global.API_URL = API_URL;
      global.BASE_URL = BASE_URL;
      global.API_CONFIG = { API_URL, BASE_URL, isProduction };
    }
  } catch (e) {
    // ignore if global assign fails
  }

  // Export for CommonJS environments (Node, bundlers)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_URL, BASE_URL, isProduction };
  }

  // Mark configured
  try { if (global) global.__JOB_PORTAL_CONFIG__ = true; } catch (e) {}

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

// In development: points to localhost:5000
// In Docker: Nginx proxies /api/ to the backend container automatically
export const API_BASE = (window.location.hostname === 'localhost' && window.location.port === '4200')
  ? 'http://localhost:5000/api'
  : '/api';

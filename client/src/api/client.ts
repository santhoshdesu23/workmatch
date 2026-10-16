import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected network error occurred.';
    
    if (error.response) {
      const data = error.response.data;
      if (typeof data === 'string' && data.length < 200 && !data.includes('<!DOCTYPE')) {
        message = data;
      } else if (data?.message) {
        message = data.message;
      } else if (data?.error) {
        message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else if (error.response.status === 409) {
        message = 'An account with this email address already exists. Please log in.';
      } else if (error.response.status === 401) {
        message = 'Authentication required or session expired. Please log in.';
      } else if (error.response.status === 403) {
        message = 'You do not have permission to perform this action.';
      } else if (error.response.status === 404) {
        message = 'The requested resource was not found.';
      } else if (error.response.status >= 500) {
        message = 'Server encountered an error. Please try again.';
      } else {
        message = error.message || 'An error occurred with your request.';
      }
    } else if (error.request) {
      message = 'Cannot connect to server. Please ensure the backend is running.';
    } else {
      message = error.message || message;
    }

    const customErr: any = new Error(message);
    customErr.status = error.response?.status;
    customErr.data = error.response?.data;
    return Promise.reject(customErr);
  }
);

export default api;

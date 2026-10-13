import axios from 'axios';

const isLocalhost = 
  typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1');

export const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : (isLocalhost 
      ? 'http://localhost:5000' 
      : 'https://onebridgehr.onrender.com');

export const resolveImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url === '/image.png' || url.startsWith('/image') || url.startsWith('/mascot') || url.startsWith('/icons')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    return `${SOCKET_URL}${url}`;
  }
  if (url.startsWith('uploads/')) {
    return `${SOCKET_URL}/${url}`;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (url.includes('localhost:5000')) {
      const path = url.split('localhost:5000')[1];
      return `${SOCKET_URL}${path}`;
    }
  }
  return url;
};

const API_BASE_URL = `${SOCKET_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept Responses to handle Refresh Tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        const refToken = localStorage.getItem('refreshToken');

        if (refToken) {
          try {
            const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken: refToken,
            });

            const { token, refreshToken: newRefreshToken } = res.data.data;

            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', newRefreshToken);

            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          } catch (refreshError: any) {
            // Refresh failed - clean storage and force log out
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
      }
    }
    }

    return Promise.reject(error);
  }
);

export default api;

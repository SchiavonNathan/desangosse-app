import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const TOKEN_KEY = '@app-cavazin:token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 15_000, // 15 seconds — prevents requests from hanging indefinitely
});

/**
 * Normaliza URLs vindas do banco de dados. 
 * Se o banco tiver gravado `localhost:3000` (ex: desenvolvimento), e o frontend 
 * estiver rodando num IP remoto (ex: produção), ele substitui o host pelo VITE_API_URL correto.
 */
export const resolveApiUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    try {
      const parsed = new URL(url);
      const baseUrl = api.defaults.baseURL?.replace(/\/$/, '') || '';
      return `${baseUrl}${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }
  if (url.startsWith('/')) {
    const baseUrl = api.defaults.baseURL?.replace(/\/$/, '') || '';
    return `${baseUrl}${url}`;
  }
  return url;
};

// Attach JWT token from sessionStorage or localStorage on every request
api.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — force logout
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

import axios from 'axios';

let unauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedCallback = (callback: () => void) => {
  unauthorizedCallback = callback;
};

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://cht-desangosse.com.br/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Avoid triggering global logout on login failure or local offline/network errors
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest && unauthorizedCallback) {
      console.warn('[API] 401 Unauthorized received on protected endpoint.');
      unauthorizedCallback();
    }
    return Promise.reject(error);
  }
);

export default api;

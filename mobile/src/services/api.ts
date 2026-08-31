import axios from 'axios';

let unauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedCallback = (callback: () => void) => {
  unauthorizedCallback = callback;
};

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://cht-desangosse.com.br/api',
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && unauthorizedCallback) {
      unauthorizedCallback();
    }
    return Promise.reject(error);
  }
);

export default api;

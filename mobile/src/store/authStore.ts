import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api, { setUnauthorizedCallback } from '../services/api';

export interface User {
  id: string;
  username: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  lastUsername: string;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  restoreToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  lastUsername: '',
  isLoading: true,
  login: async (token, user) => {
    try {
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
      if (user?.username) {
        await SecureStore.setItemAsync('lastUsername', user.username);
      }
    } catch (e) {
      console.warn('[AuthStore] Error persisting session in SecureStore:', e);
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    set({ token, user, lastUsername: user?.username || '' });
  },
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userData');
    } catch (e) {
      console.warn('[AuthStore] Error clearing session in SecureStore:', e);
    }
    delete api.defaults.headers.common['Authorization'];
    set({ token: null, user: null });
  },
  restoreToken: async () => {
    try {
      const [token, userData, lastUsername] = await Promise.all([
        SecureStore.getItemAsync('userToken').catch(() => null),
        SecureStore.getItemAsync('userData').catch(() => null),
        SecureStore.getItemAsync('lastUsername').catch(() => null),
      ]);

      if (token && userData) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({
          token,
          user: JSON.parse(userData),
          lastUsername: lastUsername || '',
          isLoading: false,
        });
      } else {
        set({
          token: null,
          user: null,
          lastUsername: lastUsername || '',
          isLoading: false,
        });
      }
    } catch (e) {
      console.error('[AuthStore] Failed to restore session:', e);
      set({ isLoading: false });
    }
  },
}));

// Register automatic logout on 401 without circular import
setUnauthorizedCallback(() => {
  useAuthStore.getState().logout();
});

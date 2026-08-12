import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  role: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, remember: boolean) => void;
  logout: () => void;
}

const TOKEN_KEY = '@app-cavazin:token';
const USER_KEY  = '@app-cavazin:user';

function loadToken(): string | null {
  return (
    sessionStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(TOKEN_KEY)
  );
}

function loadUser<T>(key: string): T | null {
  try {
    const raw =
      sessionStorage.getItem(key) || localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: loadToken(),
  user: loadUser<User>(USER_KEY),

  login: (token, user, remember) => {
    if (remember) {
      // Persist across browser sessions
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } else {
      // Only for the current tab session (cleared on close)
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    set({ token, user });
  },

  logout: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
}));

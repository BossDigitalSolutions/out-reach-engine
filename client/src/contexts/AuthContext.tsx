import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { authApi } from '../lib/api';

export type UserRole = 'ADMIN' | 'MEMBER';

interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ requiresTwoFactor?: boolean }>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.logout().catch(() => {});
    }
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      doLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [doLogout]);

  // Track user activity to reset the inactivity timer
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handler = () => {
      if (user) resetInactivityTimer();
    };
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [user, resetInactivityTimer]);

  const refreshUser = useCallback(async () => {
    const res = await authApi.me();
    setUser(res.data);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi
        .me()
        .then((res) => {
          setUser(res.data);
          resetInactivityTimer();
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [resetInactivityTimer]);

  const login = async (email: string, password: string, totpCode?: string) => {
    const res = await authApi.login(email, password, totpCode);
    if (res.data.requiresTwoFactor) {
      return { requiresTwoFactor: true };
    }
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    resetInactivityTimer();
    return {};
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await authApi.register(email, password, name);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    resetInactivityTimer();
  };

  const logout = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    doLogout();
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

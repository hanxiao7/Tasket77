import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Logging in user:', { email });
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      console.log('Login response status:', res.status);
      if (!res.ok) {
        const err = await res.json();
        console.log('Login error:', err);
        setError(err.error || 'Login failed');
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      console.log('Login success:', data);
      setUser(data.user);
      // Redirect to main app after successful login
      window.location.href = '/';
    } catch (e) {
      console.log('Login network error:', e);
      setError('Network error');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Registering user:', { name, email });
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      console.log('Register response status:', res.status);
      if (!res.ok) {
        const err = await res.json();
        console.log('Register error:', err);
        setError(err.error || 'Registration failed');
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      console.log('Register success:', data);
      setUser(data.user);
      // Redirect to main app after successful registration
      window.location.href = '/';
    } catch (e) {
      console.log('Register network error:', e);
      setError('Network error');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}; 
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
    console.log('🔍 Starting session check...');
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/me`;
      console.log('🌐 Making request to:', apiUrl);
      
      const startTime = Date.now();
      const res = await fetch(apiUrl, {
        credentials: 'include',
      });
      const endTime = Date.now();
      console.log(`⏱️ Request took ${endTime - startTime}ms, status: ${res.status}`);
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Session check successful:', data.user);
        setUser(data.user);
      } else {
        console.log('❌ Session check failed with status:', res.status);
        setUser(null);
      }
    } catch (e) {
      console.error('💥 Session check error:', e);
      setUser(null);
    } finally {
      console.log('🏁 Session check completed');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only check session if we're not on login/register pages
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      checkSession();
    } else {
      console.log('🚫 Skipping session check on login/register page');
      setLoading(false);
    }
    // eslint-disable-next-line
  }, []);

  const login = async (email: string, password: string) => {
    console.log('🔐 Starting login process for:', email);
    console.log('📱 Tab info:', {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
    const startTime = Date.now();
    setLoading(true);
    setError(null);
    
    // Add timeout to detect hanging requests
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Login request taking longer than 10 seconds - possible hang detected');
    }, 10000);
    
    try {
      const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/login`;
      console.log('🌐 Making login request to:', apiUrl);
      
      const requestStartTime = Date.now();
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const requestEndTime = Date.now();
      console.log(`⏱️ Login request took ${requestEndTime - requestStartTime}ms, status: ${res.status}`);
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const err = await res.json();
        console.log('❌ Login failed:', err);
        setError(err.error || 'Login failed');
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const totalTime = Date.now() - startTime;
      console.log(`✅ Login successful in ${totalTime}ms:`, data.user);
      setUser(data.user);
      // Redirect to main app after successful login
      console.log('🔄 Redirecting to main app...');
      window.location.href = '/';
    } catch (e) {
      clearTimeout(timeoutId);
      const totalTime = Date.now() - startTime;
      console.error(`💥 Login network error after ${totalTime}ms:`, e);
      setError('Network error');
      setUser(null);
    } finally {
      console.log('🏁 Login process completed');
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
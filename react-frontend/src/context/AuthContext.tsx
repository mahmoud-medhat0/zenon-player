import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  tenant: {
    id: string;
    name: string;
    plan_tier: string;
    is_active: boolean;
    plan?: {
      id: string;
      name: string;
      slug: string;
      max_users: number;
      max_storage_gb: number;
      features: string[];
      is_active: boolean;
    };
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasFeature: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const res = await api.get('/me');
          setUser(res.data.user);
        } catch (error) {
          localStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const login = async (credentials: any) => {
    const res = await api.post('/login', credentials);
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
  };

  const register = async (data: any) => {
    const res = await api.post('/register', data);
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  const hasFeature = (key: string) => {
    if (!user || !user.tenant || !user.tenant.plan) return false;
    if (!user.tenant.plan.is_active || !user.tenant.is_active) return false;
    return user.tenant.plan.features?.includes(key) || false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin, isSuperAdmin, hasFeature }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

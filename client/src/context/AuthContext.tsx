import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'HR' | 'TEAM_LEAD' | 'EMPLOYEE';
  employeeId: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  department?: string;
  designation?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, refreshToken: string, userData: User) => void;
  logout: () => Promise<void>;
  updateUserCache: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        
        try {
          // Verify against backend health
          const res = await api.get('/auth/me');
          if (res.data.status === 'success') {
            const savedUserParsed = JSON.parse(savedUser);
            const freshUser = {
              ...savedUserParsed,
              firstName: res.data.data.employee?.firstName || savedUserParsed.firstName || 'User',
              lastName: res.data.data.employee?.lastName || savedUserParsed.lastName || '',
              profileImageUrl: res.data.data.employee?.profileImageUrl || savedUserParsed.profileImageUrl,
              department: res.data.data.employee?.department || savedUserParsed.department,
              designation: res.data.data.employee?.designation || savedUserParsed.designation,
            };
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          }
        } catch (err) {
          console.warn('Session verification failed, using local cache:', err);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (accessToken: string, refreshToken: string, userData: User) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  const updateUserCache = (updatedUser: Partial<User>) => {
    if (user) {
      const mergedUser = { ...user, ...updatedUser };
      setUser(mergedUser);
      localStorage.setItem('user', JSON.stringify(mergedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUserCache }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

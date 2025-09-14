import React, { createContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  token: string | null;
  login: (newToken: string, user: any) => void; // Include user info
  logout: () => void;
  user: any; // Add user state
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('erpnext_token');
    const storedUser = localStorage.getItem('erpnext_user');
    if (storedToken) {
      setToken(storedToken);
      setUser(storedUser ? JSON.parse(storedUser) : null);
    }
  }, []);

  const login = (newToken: string, userData: any) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('erpnext_token', newToken);
    localStorage.setItem('erpnext_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('erpnext_token');
    localStorage.removeItem('erpnext_user');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

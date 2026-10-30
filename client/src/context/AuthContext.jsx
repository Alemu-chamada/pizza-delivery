import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.getMe();
      if (response?.success && response?.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    const resolvedUser = res?.data?.user || res?.data?.data?.user || res?.user;
    if (resolvedUser) {
      setUser(resolvedUser);
    }
    try {
      const meRes = await authApi.getMe();
      const meUser = meRes?.data?.user || meRes?.data?.data?.user || meRes?.user;
      if (meUser) {
        setUser(meUser);
      }
    } catch (e) {
      // Keep resolvedUser if me call fails
    }
    return res;
  };

  const adminLogin = async (credentials) => {
    const res = await authApi.adminLogin(credentials);
    const resolvedUser = res?.data?.user || res?.data?.data?.user || res?.data?.admin || res?.admin || res?.user;
    if (resolvedUser) {
      setUser(resolvedUser);
    }
    try {
      const meRes = await authApi.getMe();
      const meUser = meRes?.data?.user || meRes?.data?.data?.user || meRes?.user;
      if (meUser) {
        setUser(meUser);
      }
    } catch (e) {
      // Keep resolvedUser
    }
    return res;
  };

  const logout = async () => {
    try {
      if (user?.role === 'admin') {
        await authApi.adminLogout();
      } else {
        await authApi.logout();
      }
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    refreshUser,
    login,
    adminLogin,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isCustomer: user?.role === 'customer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

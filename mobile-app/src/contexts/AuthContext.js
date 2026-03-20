import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

const AuthContext = createContext(null);

// Token expiry margin: refresh if less than 5 minutes remain
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

const parseJwtExpiry = (token) => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.exp ? decoded.exp * 1000 : null; // Convert to ms
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => {
  const expiry = parseJwtExpiry(token);
  if (!expiry) return false; // If we can't determine expiry, assume valid
  return Date.now() >= expiry - TOKEN_EXPIRY_MARGIN_MS;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');

      if (token && userData) {
        // Check if token is expired
        if (isTokenExpired(token)) {
          // Token expired, clear auth
          await clearAuth();
          return;
        }

        await api.setToken(token);

        let parsedUser = null;
        try {
          parsedUser = JSON.parse(userData);
        } catch (parseError) {
          // Corrupted user data in storage, clear it
          await clearAuth();
          return;
        }

        setUser(parsedUser);
      }
    } catch (error) {
      // Storage access failed, start with clean state
      await clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = useCallback(async () => {
    setUser(null);
    await api.setToken(null);
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    } catch {
      // Ignore cleanup errors
    }
  }, []);

  const login = async (email, password) => {
    setLoginLoading(true);
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (error) {
      throw error;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    await clearAuth();
  };

  // Handle 401 responses globally: clear auth so user is redirected to login
  const handleUnauthorized = useCallback(async () => {
    await clearAuth();
  }, [clearAuth]);

  // Check token expiry periodically (every 60 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token && isTokenExpired(token)) {
          await clearAuth();
        }
      } catch {
        // Ignore check errors
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, loginLoading, login, logout, handleUnauthorized }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

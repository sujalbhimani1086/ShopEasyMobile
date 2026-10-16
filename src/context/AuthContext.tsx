import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthResult,
  AuthContextType,
} from '../types/auth';
import {
  saveAuthSession,
  getAuthSession,
  clearAuthSession,
} from '../services/authStorage';
import {
  loginApi,
  registerApi,
  getRegistrationStatusApi,
  getProfileApi,
} from '../services/authApi';

import { clearUserQueryCache } from '../config/queryClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const stored = await getAuthSession();
        if (isMounted && stored.user) {
          // Set initial stored user and token immediately
          setUser(stored.user);
          setToken(stored.token);

          // Verify with backend database asynchronously if token is present
          if (stored.token) {
            getProfileApi(stored.token)
              .then(async (verified) => {
                if (!isMounted) return;
                if (verified.success && verified.user) {
                  setUser(verified.user);
                  await saveAuthSession(stored.token, verified.user);
                } else if (verified.expired) {
                  await clearAuthSession();
                  setUser(null);
                  setToken(null);
                }
              })
              .catch(() => {
                // Ignore background network check error
              });
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth state:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResult> => {
      const { result, token: newToken } = await loginApi(credentials);

      if (result.success && result.user) {
        clearUserQueryCache();
        // Persist session securely
        await saveAuthSession(newToken, result.user);
        setUser(result.user);
        setToken(newToken);
      }

      return result;
    },
    []
  );

  const register = useCallback(
    async (data: RegisterData): Promise<AuthResult> => {
      const result = await registerApi(data);
      return result;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    clearUserQueryCache();
    await clearAuthSession();
    setUser(null);
    setToken(null);
  }, []);

  const checkSession = useCallback(async (): Promise<void> => {
    if (!token && !user?.email) return;

    try {
      if (token) {
        const verified = await getProfileApi(token);
        if (verified.success && verified.user) {
          setUser(verified.user);
          await saveAuthSession(token, verified.user);
          return;
        } else if (verified.expired) {
          await logout();
          return;
        }
      }

      if (user?.email) {
        const statusRes = await getRegistrationStatusApi(user.email);
        if (statusRes.success && statusRes.status) {
          if (statusRes.status !== 'APPROVED') {
            // Status revoked or declined, log out
            await logout();
          } else {
            // Update status if changed
            setUser((prev) => (prev ? { ...prev, status: statusRes.status! } : null));
          }
        }
      }
    } catch {
      // Ignore background network check error
    }
  }, [token, user?.email, logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      register,
      logout,
      checkSession,
    }),
    [user, token, isLoading, login, register, logout, checkSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

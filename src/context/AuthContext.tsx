'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  // Sync NextAuth session with our auth state
  useEffect(() => {
    if (status === 'loading') {
      setIsLoading(true);
      return;
    }

    if (session?.user) {
      setUser({
        id: session.user.id as string,
        email: session.user.email as string,
        name: session.user.name as string,
      });
      setIsLoading(false);
    } else {
      // Check for existing token on mount (for non-OAuth users)
      if (typeof window !== 'undefined' && !isInitialized) {
        setIsInitialized(true);
        const token = localStorage.getItem('accessToken');
        if (token) {
          // Verify token and get user info
          verifyToken(token);
        } else {
          setIsLoading(false);
        }
      } else {
        setUser(null);
        setIsLoading(false);
      }
    }
  }, [session, status, isInitialized]);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      } else {
        // Token is invalid, try to refresh
        await refreshToken();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }
      
      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        
        // Get user info with new token
        const userResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${data.accessToken}`,
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
        }
      } else {
        // Refresh failed, clear tokens
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
        setUser(null);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Add timeout to prevent long waits
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        setUser(data.user);
        // Use window.location for navigation to avoid hydration issues
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error.name === 'AbortError') {
        throw new Error('Login request timed out. Please try again.');
      }
      throw error;
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    try {
      // Add timeout to prevent long waits
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        setUser(data.user);
        // Use window.location for navigation to avoid hydration issues
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      if (error.name === 'AbortError') {
        throw new Error('Registration request timed out. Please try again.');
      }
      throw error;
    }
  };

  const logout = async () => {
    // If user is logged in via OAuth, use NextAuth signOut
    if (session?.user) {
      await signOut({ callbackUrl: '/login' });
    } else {
      // For JWT users, clear tokens
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
      setUser(null);
      // Use window.location for navigation to avoid hydration issues
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      register,
      logout,
      refreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// For backward compatibility with existing code
export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isUserLoading: isLoading };
}

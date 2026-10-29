import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../services/storage';
import {
  isSupabaseConfigured,
  supabase,
  supabaseSignIn,
  supabaseSignOut,
  supabaseGetUserProfile,
} from '../services/supabase';

export interface AuthContextType {
  currentUser: User;
  isAuthenticated: boolean;
  users: User[];
  sessionExpiresAt: number | null;
  sessionExpiredMessage: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string) => Promise<boolean>;
  logout: (reason?: string) => void;
  switchUser: (user: User) => void;
  isAdmin: boolean;
  isEmployee: boolean;
  refreshUsers: () => void;
}

const DUMMY_GUEST_USER: User = {
  id: 'guest',
  email: '',
  displayName: 'Not Signed In',
  role: 'employee',
  isActive: false,
  createdAt: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialUser }) => {
  // Determine initial authentication state
  const [activeSession, setActiveSession] = useState(() => {
    if (initialUser !== undefined) return initialUser ? { userId: initialUser.id, role: initialUser.role } : null;
    return db.getAuthSession();
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (initialUser !== undefined) {
      return initialUser || DUMMY_GUEST_USER;
    }
    const session = db.getAuthSession();
    if (session) {
      const user = db.getUsers().find((u) => u.id === session.userId);
      if (user && user.isActive) return user;
    }
    // In Node / Vitest SSR environments without window.localStorage, fallback to demo user
    if (typeof window === 'undefined') {
      return db.getCurrentUser();
    }
    return DUMMY_GUEST_USER;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (initialUser !== undefined) return Boolean(initialUser);
    if (typeof window === 'undefined') return true;
    return Boolean(db.getAuthSession());
  });

  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(() => {
    const session = db.getAuthSession();
    return session ? session.expiresAt : null;
  });

  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>(() => db.getUsers());

  // Keep users in sync
  useEffect(() => {
    setUsers(db.getUsers());
  }, []);

  // Monitor activity & handle automatic expiration
  useEffect(() => {
    if (!isAuthenticated || currentUser.id === 'guest') return;

    const handleUserActivity = () => {
      db.touchSessionActivity();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    // Check expiration and cryptographic integrity
    const interval = setInterval(async () => {
      const session = db.getAuthSession();
      if (!session) {
        // Expired
        setIsAuthenticated(false);
        setCurrentUser(DUMMY_GUEST_USER);
        setSessionExpiresAt(null);
        setSessionExpiredMessage('Your session has expired. Please sign in again.');
      } else {
        // Verify cryptographic signature against localStorage manipulation
        const isAuthentic = await db.verifySessionIntegrity(session);
        if (!isAuthentic) {
          logout('Session tampering detected. Cryptographic signature invalid.');
          return;
        }
        setSessionExpiresAt(session.expiresAt);
      }
    }, 15000);

    // Immediate integrity check on boot
    const checkTamperOnBoot = async () => {
      const session = db.getAuthSession();
      if (session) {
        const isAuthentic = await db.verifySessionIntegrity(session);
        if (!isAuthentic) {
          logout('Session tampering detected. Cryptographic signature invalid.');
        }
      }
    };
    checkTamperOnBoot();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated, currentUser.id]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setSessionExpiredMessage(null);
      let authenticatedUser: User;

      if (isSupabaseConfigured && supabase) {
        const { user: authUser } = await supabaseSignIn(email, password);
        if (!authUser) throw new Error('Authentication failed.');
        const profile = await supabaseGetUserProfile(authUser.id);
        const mappedUser: User = {
          id: authUser.id,
          email: authUser.email || email,
          displayName: profile?.display_name || authUser.email?.split('@')[0] || 'Staff',
          role: profile?.role || 'employee',
          isActive: profile?.is_active ?? true,
          createdAt: authUser.created_at || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        db.setCurrentUser(mappedUser);
        authenticatedUser = mappedUser;
      } else {
        authenticatedUser = await db.authenticateUser(email, password);
      }

      setCurrentUser(authenticatedUser);
      setIsAuthenticated(true);
      const session = db.getAuthSession();
      setSessionExpiresAt(session ? session.expiresAt : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    }
  };

  const loginWithEmail = async (_email: string): Promise<boolean> => {
    // Deprecated for security: Passwords must be verified explicitly via login(email, password)
    return false;
  };

  const logout = (reason?: string) => {
    if (currentUser.id !== 'guest') {
      db.clearAuthSession(reason);
    }
    if (isSupabaseConfigured) {
      supabaseSignOut();
    }
    setIsAuthenticated(false);
    setCurrentUser(DUMMY_GUEST_USER);
    setSessionExpiresAt(null);
    if (reason) {
      setSessionExpiredMessage(reason);
    }
  };

  const switchUser = (user: User) => {
    if (!user.isActive) {
      alert(`Account ${user.displayName} is deactivated. Contact Admin.`);
      return;
    }
    db.setCurrentUser(user);
    setCurrentUser(user);
  };

  const refreshUsers = () => {
    const updated = db.getUsers();
    setUsers(updated);
    const refreshedCurrent = updated.find((u) => u.id === currentUser.id);
    if (refreshedCurrent) {
      setCurrentUser(refreshedCurrent);
    }
  };

  const isAdmin = isAuthenticated && currentUser.role === 'admin';
  const isEmployee = isAuthenticated && currentUser.role === 'employee';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        users,
        sessionExpiresAt,
        sessionExpiredMessage,
        login,
        loginWithEmail,
        logout,
        switchUser,
        isAdmin,
        isEmployee,
        refreshUsers,
      }}
    >
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

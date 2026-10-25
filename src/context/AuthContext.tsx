import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../services/storage';

interface AuthContextType {
  currentUser: User;
  users: User[];
  switchUser: (user: User) => void;
  loginWithEmail: (email: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isEmployee: boolean;
  refreshUsers: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => db.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => db.getUsers());

  useEffect(() => {
    // Keep users in sync
    setUsers(db.getUsers());
  }, []);

  const switchUser = (user: User) => {
    if (!user.isActive) {
      alert(`Account ${user.displayName} is deactivated. Contact Admin.`);
      return;
    }
    db.setCurrentUser(user);
    setCurrentUser(user);
  };

  const loginWithEmail = async (email: string): Promise<boolean> => {
    const allUsers = db.getUsers();
    const user = allUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (user && user.isActive) {
      db.setCurrentUser(user);
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const logout = () => {
    // In POS environments, default to an employee or show lock screen
    const firstActive = users.find((u) => u.isActive && u.role === 'employee') || users[0];
    switchUser(firstActive);
  };

  const refreshUsers = () => {
    const updated = db.getUsers();
    setUsers(updated);
    const refreshedCurrent = updated.find((u) => u.id === currentUser.id);
    if (refreshedCurrent) {
      setCurrentUser(refreshedCurrent);
    }
  };

  const isAdmin = currentUser.role === 'admin';
  const isEmployee = currentUser.role === 'employee';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        switchUser,
        loginWithEmail,
        logout,
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

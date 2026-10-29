import React, { useState } from 'react';
import {
  Gamepad2,
  ChevronDown,
  Shield,
  Menu,
  X,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  onOpenNewEntry?: () => void;
  stations?: any[];
  mobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  mobileMenuOpen,
  onToggleMobileMenu,
}) => {
  const { currentUser, users, switchUser, isAdmin, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-[#0a0a0d] border-b border-[#22222a] select-none text-zinc-200">
      {/* Vault Logo */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-red-500" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-red-600 text-white font-black shadow-sm">
            <Gamepad2 className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-black tracking-tight text-white font-mono">VAULT 147</span>
            <span className="text-2xs text-red-500 font-mono font-bold tracking-wider">POS</span>
          </div>
        </div>
      </div>

      {/* Profile Switch (Top Right) */}
      <div className="relative">
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs transition-colors"
          title="Switch Staff Member"
        >
          <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-300">
            {isAdmin ? (
              <Shield className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </div>
          <span className="font-medium text-white text-xs">
            {currentUser.displayName.split(' ')[0]}
          </span>
          <span className="text-3xs text-zinc-400 uppercase font-mono hidden sm:inline font-semibold">
            ({currentUser.role})
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        </button>

        {/* User Switch Dropdown */}
        {showUserDropdown && (
          <div className="absolute right-0 mt-2 w-64 rounded-lg bg-[#0e0e14] border border-zinc-800 shadow-2xl py-1 z-50">
            <div className="px-3 py-2 border-b border-zinc-800">
              <p className="text-3xs font-semibold text-zinc-400 uppercase tracking-wider">
                Switch Staff Profile
              </p>
            </div>

            <div className="py-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    switchUser(u);
                    setShowUserDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-zinc-850 transition-colors ${
                    u.id === currentUser.id
                      ? 'bg-red-950/30 text-red-400 font-semibold border-l-2 border-red-500'
                      : 'text-zinc-300'
                  }`}
                >
                  <div>
                    <p className="leading-tight text-white">{u.displayName}</p>
                    <p className="text-3xs text-zinc-400 font-mono">{u.email}</p>
                  </div>
                  <span className="text-3xs font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-1 mt-1 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowUserDropdown(false);
                  logout('User signed out.');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out (Lock POS)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

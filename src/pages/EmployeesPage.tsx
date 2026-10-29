import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/storage';
import { formatDateTime } from '../utils/formatters';

export const EmployeesPage: React.FC = () => {
  const { currentUser, isAdmin, refreshUsers } = useAuth();
  const [users, setUsers] = useState<User[]>(() => db.getUsers());

  // Create User Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('employee');
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setUsers(db.getUsers());
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-12 text-center rounded-xl border border-red-900/40 bg-red-950/20 max-w-lg mx-auto mt-10">
        <Lock className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white">Access Denied: Administrator Only</h2>
        <p className="text-xs text-slate-400 mt-2">
          Staff management, role allocation, and account deactivation are restricted to Admin accounts.
          Switch to an Admin profile in the top-right menu to manage employees.
        </p>
      </div>
    );
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nameInput.trim()) {
      setError('Staff display name is required.');
      return;
    }
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setError('A valid staff email address is required.');
      return;
    }

    try {
      db.createUser(
        {
          displayName: nameInput.trim(),
          email: emailInput.trim(),
          role: roleInput,
          isActive: true,
        },
        currentUser
      );

      loadData();
      refreshUsers();
      setModalOpen(false);
      setNameInput('');
      setEmailInput('');
      setRoleInput('employee');
    } catch (err: any) {
      setError(err.message || 'Failed to create user.');
    }
  };

  const handleToggleStatus = (u: User) => {
    try {
      db.toggleUserStatus(u.id, currentUser);
      loadData();
      refreshUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleChangeRole = (u: User, newRole: UserRole) => {
    try {
      db.updateUserRole(u.id, newRole, currentUser);
      loadData();
      refreshUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-red-500" />
            <span>Staff & Employee Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Administer counter personnel, assign cashier roles, and control register access.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setNameInput('');
            setEmailInput('');
            setRoleInput('employee');
            setError(null);
            setModalOpen(true);
          }}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="font-semibold"
        >
          Add Staff Member
        </Button>
      </div>

      {/* Staff Table / Mobile Cards */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        {/* Mobile Cards (md:hidden) */}
        <div className="md:hidden divide-y divide-slate-800/60 font-sans">
          {users.map((u) => {
            const isSelf = u.id === currentUser.id;
            return (
              <div key={u.id} className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{u.displayName}</span>
                      {isSelf && (
                        <span className="text-3xs px-1.5 py-0.2 rounded bg-red-950/80 text-red-400 border border-red-800/60 font-mono">
                          (You)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono block mt-0.5">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={u.role === 'admin' ? 'danger' : 'info'} size="sm">
                      {u.role.toUpperCase()}
                    </Badge>
                    <Badge variant={u.isActive ? 'success' : 'neutral'} size="sm">
                      {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/40">
                    <div className="flex items-center gap-2">
                      <span className="text-3xs text-slate-500 uppercase font-mono">Role:</span>
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-300 font-sans focus:border-red-500 outline-none"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <Button
                      variant={u.isActive ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleStatus(u)}
                      leftIcon={
                        u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5 text-zinc-300" />
                      }
                      className="text-2xs h-7 px-2.5"
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-3xs">
              <tr>
                <th className="px-4 py-3">Staff Name</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Account Role</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-850/50">
                    <td className="px-4 py-3.5 font-medium text-slate-100 flex items-center gap-2">
                      <span>{u.displayName}</span>
                      {isSelf && (
                        <span className="text-3xs px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/60 font-mono">
                          (You)
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-300">{u.email}</td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={u.role === 'admin' ? 'danger' : 'info'} size="sm">
                          {u.role.toUpperCase()}
                        </Badge>

                        {!isSelf && (
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                            className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-3xs text-slate-300 font-sans focus:border-red-500 outline-none"
                          >
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-400 text-3xs">
                      {formatDateTime(u.createdAt)}
                    </td>

                    <td className="px-4 py-3.5">
                      <Badge variant={u.isActive ? 'success' : 'danger'} size="sm">
                        {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </Badge>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      {!isSelf && (
                        <Button
                          variant={u.isActive ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => handleToggleStatus(u)}
                          leftIcon={
                            u.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3 text-zinc-300" />
                          }
                          className="text-2xs"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Invite New Staff Member"
          description="Create credentials and grant counter permissions to a staff member."
          maxWidth="md"
        >
          <form onSubmit={handleCreateUser} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Karan Varma"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Work Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="e.g. karan@vaultgaming.in"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Account Role
              </label>
              <select
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-red-500 outline-none"
              >
                <option value="employee">
                  Employee (Counter Entry, Billing, Concessions, Daily Reports)
                </option>
                <option value="admin">
                  Administrator (Full System, Pricing, Voids, Staff & Audit)
                </option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button variant="secondary" size="md" type="button" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit">
                Create Account
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

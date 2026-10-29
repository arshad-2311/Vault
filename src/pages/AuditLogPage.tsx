import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  Shield,
  FileCode,
  Lock,
} from 'lucide-react';
import { AuditLog } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/storage';
import { formatDateTime } from '../utils/formatters';

export const AuditLogPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>(() => db.getAuditLogs());
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    setLogs(db.getAuditLogs());
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-12 text-center rounded-xl border border-red-900/40 bg-red-950/20 max-w-lg mx-auto mt-10">
        <Lock className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white">Access Denied: Administrator Only</h2>
        <p className="text-xs text-slate-400 mt-2">
          The forensic audit trail is strictly confidential and accessible only to system administrators.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchSearch =
      log.actorName.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q);

    const matchEntity = entityFilter === 'all' || log.entityType === entityFilter;

    return matchSearch && matchEntity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-brand-400" />
            <span>Forensic Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable, append-only log of all financial modifications, rate changes, daily closings, and voids.
          </p>
        </div>

        <Badge variant="warning" size="md">
          IMMUTABLE REGISTER
        </Badge>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search audit trail by actor, action, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-brand-500"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-brand-500"
        >
          <option value="all">All Entity Types</option>
          <option value="session">Session</option>
          <option value="payment">Payment</option>
          <option value="pricing">Pricing Config</option>
          <option value="snack">Snack Catalogue</option>
          <option value="closing">Daily Cash Closing</option>
          <option value="user">User Account</option>
        </select>
      </div>

      {/* Logs Timeline Table / Mobile Cards */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        {/* Mobile Cards (md:hidden) */}
        <div className="md:hidden divide-y divide-slate-800/60 font-sans">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No audit logs match the current filter criteria.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-200 text-xs block">{log.actorName}</span>
                    <span className="text-3xs text-slate-500 font-mono">{formatDateTime(log.timestamp)}</span>
                  </div>
                  <span
                    className={`text-3xs font-bold px-2 py-0.5 rounded font-mono ${
                      log.action.includes('VOID')
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : log.action.includes('CLOSING')
                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        : log.action.includes('PRICING')
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {log.action}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{log.details}</p>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/40 text-3xs font-mono text-slate-500">
                  <span>{log.entityType}: {log.entityId}</span>
                  {(log.previousState || log.newState) && (
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-red-400 hover:text-red-300 underline font-mono font-semibold"
                    >
                      Inspect Diff
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-3xs">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Audit Details</th>
                <th className="px-4 py-3 text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No audit logs match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50">
                    <td className="px-4 py-3 text-3xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>

                    <td className="px-4 py-3 font-sans">
                      <span className="font-medium text-slate-200 block">{log.actorName}</span>
                      <Badge variant={log.actorRole === 'admin' ? 'danger' : 'info'} size="sm">
                        {log.actorRole.toUpperCase()}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-2xs font-bold px-2 py-0.5 rounded ${
                          log.action.includes('VOID')
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : log.action.includes('CLOSING')
                            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                            : log.action.includes('PRICING')
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3 uppercase text-3xs text-slate-400">
                      <span className="block font-semibold text-slate-300">{log.entityType}</span>
                      <span className="text-slate-500">{log.entityId}</span>
                    </td>

                    <td className="px-4 py-3 font-sans text-xs text-slate-300 max-w-md">
                      {log.details}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {(log.previousState || log.newState) && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-2xs text-red-400 hover:text-red-300 font-mono underline"
                        >
                          Inspect Diff
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* State Inspector Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit State Inspector: ${selectedLog.action}`}
          description={`Logged by ${selectedLog.actorName} at ${formatDateTime(selectedLog.timestamp)}`}
          maxWidth="lg"
        >
          <div className="space-y-4 font-mono text-xs">
            <p className="text-slate-300 font-sans">{selectedLog.details}</p>

            {selectedLog.previousState && (
              <div>
                <span className="text-3xs uppercase tracking-wider text-red-400 font-bold block mb-1">
                  Previous State
                </span>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-red-300 text-2xs overflow-x-auto">
                  {JSON.stringify(selectedLog.previousState, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newState && (
              <div>
                <span className="text-3xs uppercase tracking-wider text-zinc-300 font-bold block mb-1">
                  New State
                </span>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-2xs overflow-x-auto">
                  {JSON.stringify(selectedLog.newState, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

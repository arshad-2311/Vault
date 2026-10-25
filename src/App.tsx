import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { NewEntryModal } from './components/pos/NewEntryModal';
import { CheckoutModal } from './components/pos/CheckoutModal';
import { AddSnackModal } from './components/pos/AddSnackModal';

import { DashboardPage } from './pages/DashboardPage';
import { ActiveSessionsPage } from './pages/ActiveSessionsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SnacksPage } from './pages/SnacksPage';
import { ReportsPage } from './pages/ReportsPage';
import { CashClosingPage } from './pages/CashClosingPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogPage } from './pages/AuditLogPage';

import { Station, Session } from './types';
import { db } from './services/storage';

const AppContent: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Stations & Active sessions state
  const [stations, setStations] = useState<Station[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Modals state
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [preselectedStationId, setPreselectedStationId] = useState<string | null>(null);

  const [checkoutSession, setCheckoutSession] = useState<Session | null>(null);
  const [addSnackSession, setAddSnackSession] = useState<Session | null>(null);

  // Sync state from database
  const refreshData = () => {
    setStations(db.getStations());
    setSessions(db.getSessions());
  };

  useEffect(() => {
    refreshData();
    // Auto sync periodically
    const timer = setInterval(refreshData, 15000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard Shortcuts (Alt+N for new entry)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setPreselectedStationId(null);
        setNewEntryOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actions
  const handleStartSession = (stationId: string) => {
    setPreselectedStationId(stationId);
    setNewEntryOpen(true);
  };

  const handleOpenAddSnack = (sessionId: string) => {
    const session = db.getSessionById(sessionId);
    if (session) {
      setAddSnackSession(session);
    }
  };

  const handleOpenCheckout = (sessionId: string) => {
    const session = db.getSessionById(sessionId);
    if (session) {
      setCheckoutSession(session);
    }
  };

  const activeCount = sessions.filter((s) => s.status === 'active').length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Fixed Navbar */}
      <Navbar
        onOpenNewEntry={() => {
          setPreselectedStationId(null);
          setNewEntryOpen(true);
        }}
        stations={stations}
      />

      {/* Main Workspace with Compact Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeCount={activeCount}
        />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950/90">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardPage
                onStartSession={handleStartSession}
                onAddSnack={handleOpenAddSnack}
                onEndSession={handleOpenCheckout}
                onViewAllTransactions={() => setActiveTab('transactions')}
                onOpenNewEntry={() => {
                  setPreselectedStationId(null);
                  setNewEntryOpen(true);
                }}
              />
            )}

            {activeTab === 'active-sessions' && (
              <ActiveSessionsPage
                onAddSnack={handleOpenAddSnack}
                onEndSession={handleOpenCheckout}
                onOpenNewEntry={() => {
                  setPreselectedStationId(null);
                  setNewEntryOpen(true);
                }}
              />
            )}

            {activeTab === 'transactions' && <TransactionsPage />}

            {activeTab === 'snacks' && <SnacksPage />}

            {activeTab === 'reports' && <ReportsPage />}

            {activeTab === 'closing' && <CashClosingPage />}

            {activeTab === 'employees' && <EmployeesPage />}

            {activeTab === 'settings' && <SettingsPage />}

            {activeTab === 'audit-log' && <AuditLogPage />}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <NewEntryModal
        isOpen={newEntryOpen}
        onClose={() => setNewEntryOpen(false)}
        preselectedStationId={preselectedStationId}
        onSessionCreated={() => {
          refreshData();
        }}
      />

      <CheckoutModal
        isOpen={Boolean(checkoutSession)}
        onClose={() => setCheckoutSession(null)}
        session={checkoutSession}
        onSessionCompleted={() => {
          refreshData();
        }}
      />

      <AddSnackModal
        isOpen={Boolean(addSnackSession)}
        onClose={() => setAddSnackSession(null)}
        session={addSnackSession}
        onSnackAdded={() => {
          refreshData();
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

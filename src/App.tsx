import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { NewEntryModal } from './components/pos/NewEntryModal';
import { CheckoutModal } from './components/pos/CheckoutModal';
import { AddSnackModal } from './components/pos/AddSnackModal';
import { ReceiptModal } from './components/pos/ReceiptModal';

import { DashboardPage } from './pages/DashboardPage';
import { ActiveSessionsPage } from './pages/ActiveSessionsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SnacksPage } from './pages/SnacksPage';
import { WalkInSnackPosPage } from './pages/WalkInSnackPosPage';
import { ReportsPage } from './pages/ReportsPage';
import { CashClosingPage } from './pages/CashClosingPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogPage } from './pages/AuditLogPage';

import { Station, Session } from './types';
import { db, VAULT_DATA_CHANGED_EVENT } from './services/storage';
import { CheckCircle, Printer, X, ShieldAlert } from 'lucide-react';
import { formatRupees } from './utils/formatters';
import { LoginPage } from './pages/LoginPage';

export const AppContent: React.FC = () => {
  const { currentUser, isAdmin, isAuthenticated, sessionExpiredMessage } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Stations & Active sessions state - synchronously loaded from storage
  const [stations, setStations] = useState<Station[]>(() => db.getStations());
  const [sessions, setSessions] = useState<Session[]>(() => db.getSessions());

  // Modals state
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [preselectedStationId, setPreselectedStationId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [checkoutSession, setCheckoutSession] = useState<Session | null>(null);
  const [addSnackSession, setAddSnackSession] = useState<Session | null>(null);

  // Settlement feedback & Receipt modals
  const [completedToastSession, setCompletedToastSession] = useState<Session | null>(null);
  const [receiptModalSession, setReceiptModalSession] = useState<Session | null>(null);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

  // Sync state from database
  const refreshData = () => {
    setStations(db.getStations());
    setSessions(db.getSessions());
  };

  useEffect(() => {
    refreshData();
    const handleDataChanged = () => {
      refreshData();
    };
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
    // Auto sync periodically
    const timer = setInterval(refreshData, 15000);
    return () => {
      window.removeEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
      clearInterval(timer);
    };
  }, []);

  // Auto-dismiss toast after 7 seconds
  useEffect(() => {
    if (!completedToastSession) return;
    const timer = setTimeout(() => {
      setCompletedToastSession(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [completedToastSession]);

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

  const handleSessionCompleted = (completed?: Session) => {
    refreshData();
    if (completed) {
      setCompletedToastSession(completed);
    }
  };

  const handlePrintReceipt = (session: Session) => {
    setReceiptModalSession(session);
    setAutoPrintReceipt(true);
  };

  const activeCount = sessions.filter((s) => s.status === 'active').length;

  if (!isAuthenticated) {
    return <LoginPage sessionExpiredMessage={sessionExpiredMessage} />;
  }

  const isRestrictedTab =
    (activeTab === 'employees' || activeTab === 'settings' || activeTab === 'audit-log') && !isAdmin;

  return (
    <div className="flex flex-col min-h-screen bg-[#060608] text-slate-100 font-sans antialiased">
      {/* Top Fixed Navbar */}
      <Navbar
        onOpenNewEntry={() => {
          setPreselectedStationId(null);
          setNewEntryOpen(true);
        }}
        onOpenWalkInPos={() => setActiveTab('walk-in-pos')}
        stations={stations}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Workspace with Compact Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeCount={activeCount}
          isOpenOnMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Content Viewport with comfortable mobile spacing */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#060608] pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {isRestrictedTab ? (
              <div className="p-8 max-w-lg mx-auto my-12 text-center rounded-2xl bg-[#0c0c12] border border-red-950/60 shadow-2xl space-y-4 animate-in fade-in">
                <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-800/80 text-red-500 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider font-mono">Access Denied</h2>
                <p className="text-sm text-zinc-400">
                  Administrator credentials are required to view or modify this section.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-semibold transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
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
                    onPrintReceipt={handlePrintReceipt}
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

                {activeTab === 'walk-in-pos' && (
                  <WalkInSnackPosPage onPrintReceipt={handlePrintReceipt} />
                )}

                {activeTab === 'transactions' && <TransactionsPage />}

                {activeTab === 'snacks' && (
                  <SnacksPage onOpenWalkInPos={() => setActiveTab('walk-in-pos')} />
                )}

                {activeTab === 'reports' && <ReportsPage />}

                {activeTab === 'closing' && <CashClosingPage />}

                {activeTab === 'employees' && <EmployeesPage />}

                {activeTab === 'settings' && <SettingsPage />}

                {activeTab === 'audit-log' && <AuditLogPage />}
              </>
            )}
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
        key={checkoutSession?.id || 'none'}
        isOpen={Boolean(checkoutSession)}
        onClose={() => setCheckoutSession(null)}
        session={checkoutSession}
        onSessionCompleted={handleSessionCompleted}
        onPrintReceipt={handlePrintReceipt}
      />

      <AddSnackModal
        isOpen={Boolean(addSnackSession)}
        onClose={() => setAddSnackSession(null)}
        session={addSnackSession}
        onSnackAdded={() => {
          refreshData();
        }}
      />

      <ReceiptModal
        isOpen={Boolean(receiptModalSession)}
        onClose={() => {
          setReceiptModalSession(null);
          setAutoPrintReceipt(false);
        }}
        session={receiptModalSession}
        autoPrint={autoPrintReceipt}
      />

      {/* Instant Settlement Success Toast (Non-blocking) */}
      {completedToastSession && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full bg-zinc-900/95 backdrop-blur-md border border-zinc-700 shadow-2xl rounded-xl p-4 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-500 shrink-0 mt-0.5">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Payment Settled</h4>
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-white font-mono font-bold">
                    {formatRupees(completedToastSession.finalBillPaise)}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1">
                  <strong>{completedToastSession.customerName}</strong> • {completedToastSession.stationName} is now <span className="text-white font-semibold">Available</span>
                </p>
                {completedToastSession.payment?.changeDuePaise! > 0 && (
                  <p className="text-2xs text-zinc-400 font-mono mt-0.5">
                    Returned {formatRupees(completedToastSession.payment?.changeDuePaise)} cash change
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={() => {
                      setReceiptModalSession(completedToastSession);
                      setAutoPrintReceipt(false);
                    }}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 text-red-400" />
                    <span>Print Receipt</span>
                  </button>
                  <span className="text-3xs text-slate-500 uppercase font-mono">
                    {completedToastSession.payment?.method}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setCompletedToastSession(null)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
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

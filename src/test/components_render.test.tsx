import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthProvider } from '../context/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { DashboardPage } from '../pages/DashboardPage';
import { ActiveSessionsPage } from '../pages/ActiveSessionsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { SnacksPage } from '../pages/SnacksPage';
import { ReportsPage } from '../pages/ReportsPage';
import { CashClosingPage } from '../pages/CashClosingPage';
import { EmployeesPage } from '../pages/EmployeesPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AuditLogPage } from '../pages/AuditLogPage';
import { StationCard } from '../components/pos/StationCard';
import { NewEntryModal } from '../components/pos/NewEntryModal';
import { CheckoutModal } from '../components/pos/CheckoutModal';
import { AddSnackModal } from '../components/pos/AddSnackModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { db } from '../services/storage';

describe('UI Pages & Modals Rendering Integrity Test Suite', () => {
  it('renders Navbar cleanly with only Vault Logo and Profile switcher', () => {
    const html = renderToString(
      <AuthProvider>
        <Navbar />
      </AuthProvider>
    );

    expect(html).toContain('VAULT 147');
    expect(html).toContain('POS');
    // Ensure stripped elements are NOT present
    expect(html).not.toContain('Architecture');
    expect(html).not.toContain('Asia/Kolkata');
    expect(html).not.toContain('Station Ready');
  });

  it('renders Sidebar with operations, management, and reporting tabs', () => {
    const html = renderToString(
      <AuthProvider>
        <Sidebar activeTab="dashboard" onSelectTab={() => {}} activeCount={2} />
      </AuthProvider>
    );

    expect(html).toContain('OPERATIONS');
    expect(html).toContain('MANAGEMENT');
    expect(html).toContain('REPORTING');
    expect(html).toContain('Dashboard');
    expect(html).toContain('Active Sessions');
    expect(html).toContain('Transactions');
  });

  it('renders DashboardPage without Recent Settlements section', () => {
    const html = renderToString(
      <AuthProvider>
        <DashboardPage
          onStartSession={() => {}}
          onAddSnack={() => {}}
          onEndSession={() => {}}
        />
      </AuthProvider>
    );

    expect(html).toContain('Operations Dashboard');
    expect(html).toContain('Total Sales');
    expect(html).toContain('GPay / UPI');
    expect(html).toContain('Cash Drawer');
    expect(html).toContain('Pending Dues');
    expect(html).toContain('Gaming Stations');
    // Recent Settlements must be removed
    expect(html).not.toContain('Recent Settlements');
  });

  it('renders ActiveSessionsPage with live monitoring cards', () => {
    const html = renderToString(
      <AuthProvider>
        <ActiveSessionsPage
          onAddSnack={() => {}}
          onEndSession={() => {}}
          onOpenNewEntry={() => {}}
        />
      </AuthProvider>
    );

    expect(html).toContain('Active Gaming Sessions');
    expect(html).toContain('New Entry');
  });

  it('renders TransactionsPage without start date or end date inputs', () => {
    const html = renderToString(
      <AuthProvider>
        <TransactionsPage />
      </AuthProvider>
    );

    expect(html).toContain('All Entries &amp; Transaction History');
    expect(html).toContain('Search customer, ID, phone...');
    expect(html).toContain('All Gaming Categories');
    expect(html).toContain('All Payment Methods');
    expect(html).toContain('All Statuses');
    expect(html).toContain('All Staff Members');
    // Start Date & End Date must be removed
    expect(html).not.toContain('Start Date');
    expect(html).not.toContain('End Date');
  });

  it('renders SnacksPage catalogue', () => {
    const html = renderToString(
      <AuthProvider>
        <SnacksPage />
      </AuthProvider>
    );

    expect(html).toContain('Snacks &amp; Concessions Catalogue');
    expect(html).toContain('Selling Price');
  });

  it('renders ReportsPage financial analytics and breakdowns', () => {
    const html = renderToString(
      <AuthProvider>
        <ReportsPage />
      </AuthProvider>
    );

    expect(html).toContain('Financial Accounting &amp; Settlement Reports');
    expect(html).toContain('Daily Report');
    expect(html).toContain('Weekly Report');
    expect(html).toContain('Monthly Report');
  });

  it('renders CashClosingPage reconciliation view', () => {
    const html = renderToString(
      <AuthProvider>
        <CashClosingPage />
      </AuthProvider>
    );

    expect(html).toContain('Cash Drawer Reconciliation');
    expect(html).toContain('System Expected Cash');
    expect(html).toContain('Physical Cash Breakdown');
  });

  it('renders EmployeesPage staff management table', () => {
    const html = renderToString(
      <AuthProvider>
        <EmployeesPage />
      </AuthProvider>
    );

    expect(html).toContain('Staff &amp; Employee Management');
    expect(html).toContain('Vikram Sethi');
  });

  it('renders SettingsPage pricing and policies form', () => {
    const html = renderToString(
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    );

    expect(html).toContain('Centre Profile');
    expect(html).toContain('PlayStation 5 Rates');
    expect(html).toContain('8-Ball Pool Rates');
  });

  it('renders AuditLogPage forensics viewer', () => {
    const html = renderToString(
      <AuthProvider>
        <AuditLogPage />
      </AuthProvider>
    );

    expect(html).toContain('Forensic Audit Trail');
    expect(html).toContain('IMMUTABLE REGISTER');
  });

  it('renders StationCard in available and occupied states', () => {
    const stations = db.getStations();
    const available = stations.find((s) => s.status === 'available')!;
    const occupied = stations.find((s) => s.status === 'occupied')!;
    const activeSession = db.getSessions().find((s) => s.status === 'active');

    const htmlAvailable = renderToString(
      <StationCard
        station={available}
        onStartSession={() => {}}
        onAddSnack={() => {}}
        onEndSession={() => {}}
      />
    );
    expect(htmlAvailable).toContain('Ready');
    expect(htmlAvailable).toContain('Start Session');

    const htmlOccupied = renderToString(
      <StationCard
        station={occupied}
        activeSession={activeSession}
        onStartSession={() => {}}
        onAddSnack={() => {}}
        onEndSession={() => {}}
      />
    );
    expect(htmlOccupied).toContain('Running Bill');
    expect(htmlOccupied).toContain('End &amp; Pay');
    expect(htmlOccupied).toContain('+ Snack');
  });

  it('renders NewEntryModal, CheckoutModal, AddSnackModal, and ReceiptModal without errors', () => {
    const session = db.getSessions()[0];

    const htmlNewEntry = renderToString(
      <AuthProvider>
        <NewEntryModal isOpen={true} onClose={() => {}} onSessionCreated={() => {}} />
      </AuthProvider>
    );
    expect(htmlNewEntry).toContain('Start a session');

    const htmlCheckout = renderToString(
      <AuthProvider>
        <CheckoutModal
          isOpen={true}
          onClose={() => {}}
          session={session}
          onSessionCompleted={() => {}}
        />
      </AuthProvider>
    );
    expect(htmlCheckout).toContain('End Payment &amp; Settle Session');

    const htmlAddSnack = renderToString(
      <AuthProvider>
        <AddSnackModal
          isOpen={true}
          onClose={() => {}}
          session={session}
          onSnackAdded={() => {}}
        />
      </AuthProvider>
    );
    expect(htmlAddSnack).toContain('Add Snacks &amp; Drinks');

    const htmlReceipt = renderToString(
      <ReceiptModal
        isOpen={true}
        onClose={() => {}}
        session={session}
      />
    );
    expect(htmlReceipt).toContain('VAULT 147');
    expect(htmlReceipt).toContain('Customer Receipt');
  });
});

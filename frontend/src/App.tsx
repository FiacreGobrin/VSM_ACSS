import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Shell Pages
import { SecurityConsolePage } from './pages/SecurityConsolePage';
import { VisitorsPage } from './pages/VisitorsPage';
import { KioskPage } from './pages/KioskPage';
import { GateAnprPage } from './pages/GateAnprPage';
import { AccessControlPage } from './pages/AccessControlPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { CompliancePage } from './pages/CompliancePage';
import { AdminPage } from './pages/AdminPage';
import { ClientPortalPage } from './pages/ClientPortalPage';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Standalone Fullscreen Kiosk Mode (can run inside layout or borderless) */}
      <Route
        path="/kiosk-standalone"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-background p-4">
              <KioskPage />
            </div>
          </ProtectedRoute>
        }
      />

      {/* Authenticated Air-Gapped Console Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/console" replace />} />

        {/* 1. Security Operations Console */}
        <Route
          path="console"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'security_officer', 'auditor']}>
              <SecurityConsolePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="console/cameras"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'security_officer', 'auditor']}>
              <SecurityConsolePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="console/floorplan"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'security_officer', 'auditor']}>
              <SecurityConsolePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="console/alerts"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'security_officer', 'auditor']}>
              <SecurityConsolePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="console/watchlists"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'security_officer', 'auditor']}>
              <SecurityConsolePage />
            </ProtectedRoute>
          }
        />

        {/* 2. Visitor Management */}
        <Route
          path="visitors"
          element={
            <ProtectedRoute
              allowedRoles={[
                'super_admin',
                'security_officer',
                'receptionist',
                'host_employee',
                'client_admin',
                'auditor',
              ]}
            >
              <VisitorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="visitors/pre-register"
          element={
            <ProtectedRoute
              allowedRoles={[
                'super_admin',
                'security_officer',
                'receptionist',
                'host_employee',
                'client_admin',
              ]}
            >
              <VisitorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="visitors/roll-call"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'security_officer', 'receptionist']}>
              <VisitorsPage />
            </ProtectedRoute>
          }
        />

        {/* 3. Kiosk Route within Shell */}
        <Route path="kiosk" element={<KioskPage />} />

        {/* 4. Gate & ANPR */}
        <Route
          path="gate"
          element={
            <ProtectedRoute
              allowedRoles={['super_admin', 'security_officer', 'receptionist', 'auditor']}
            >
              <GateAnprPage />
            </ProtectedRoute>
          }
        />

        {/* 5. Access Control & Otis Elevators */}
        <Route
          path="access/doors"
          element={
            <ProtectedRoute
              allowedRoles={['super_admin', 'security_officer', 'receptionist', 'auditor']}
            >
              <AccessControlPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="access/elevators"
          element={
            <ProtectedRoute
              allowedRoles={['super_admin', 'security_officer', 'receptionist', 'auditor']}
            >
              <AccessControlPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="access/logs"
          element={
            <ProtectedRoute
              allowedRoles={['super_admin', 'security_officer', 'receptionist', 'auditor']}
            >
              <AccessControlPage />
            </ProtectedRoute>
          }
        />

        {/* 6. System Health & VLANs */}
        <Route
          path="health"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'security_officer', 'auditor']}>
              <SystemHealthPage />
            </ProtectedRoute>
          }
        />

        {/* 7. Reports & Compliance */}
        <Route
          path="compliance"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'client_admin', 'auditor']}>
              <CompliancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="compliance/audit"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'client_admin', 'auditor']}>
              <CompliancePage />
            </ProtectedRoute>
          }
        />

        {/* 8. Client Tenant Portal */}
        <Route path="portal" element={<ClientPortalPage />} />

        {/* 9. Administration */}
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'client_admin']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/console" replace />} />
      </Route>
    </Routes>
  );
};

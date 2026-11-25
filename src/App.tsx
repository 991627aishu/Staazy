import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AdminLayout } from './layouts/AdminLayout';
import { OwnerLayout } from './layouts/OwnerLayout';
import { TenantLayout } from './layouts/TenantLayout';
import { AuthPage } from './pages/AuthPage';
import { RoleSelectionPage } from './pages/RoleSelectionPage';
import { SetupGuidePage } from './pages/SetupGuidePage';
import { WelcomePage } from './pages/WelcomePage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { AdminComplaintsPage } from './pages/admin/AdminComplaintsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminMarketplacePage } from './pages/admin/AdminMarketplacePage';
import { AdminPropertiesPage } from './pages/admin/AdminPropertiesPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminSubscriptionsPage } from './pages/admin/AdminSubscriptionsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { OwnerApplicationsPage } from './pages/owner/OwnerApplicationsPage';
import { OwnerComplaintsPage } from './pages/owner/OwnerComplaintsPage';
import { OwnerDailyStaysPage } from './pages/owner/OwnerDailyStaysPage';
import { OwnerDashboardPage } from './pages/owner/OwnerDashboardPage';
import { OwnerExpensesPage } from './pages/owner/OwnerExpensesPage';
import { OwnerFinancePage } from './pages/owner/OwnerFinancePage';
import { OwnerInventoryPage } from './pages/owner/OwnerInventoryPage';
import { OwnerOnboardingPage } from './pages/owner/OwnerOnboardingPage';
import { OwnerPropertiesPage } from './pages/owner/OwnerPropertiesPage';
import { OwnerReportsPage } from './pages/owner/OwnerReportsPage';
import { OwnerSettingsPage } from './pages/owner/OwnerSettingsPage';
import { OwnerSubscriptionPage } from './pages/owner/OwnerSubscriptionPage';
import { OwnerTeamPage } from './pages/owner/OwnerTeamPage';
import { OwnerTenantsPage } from './pages/owner/OwnerTenantsPage';
import { OwnerWhatsAppPage } from './pages/owner/OwnerWhatsAppPage';
import { TenantBookingsPage } from './pages/tenant/TenantBookingsPage';
import { TenantChatPage } from './pages/tenant/TenantChatPage';
import { TenantComplaintsPage } from './pages/tenant/TenantComplaintsPage';
import { TenantDiscoverPage } from './pages/tenant/TenantDiscoverPage';
import { TenantExplorePage } from './pages/tenant/TenantExplorePage';
import { TenantHomePage } from './pages/tenant/TenantHomePage';
import { TenantMyPgPage } from './pages/tenant/TenantMyPgPage';
import { TenantNotificationsPage } from './pages/tenant/TenantNotificationsPage';
import { TenantOnboardingProfilePage } from './pages/tenant/TenantOnboardingProfilePage';
import { TenantPgDetailPage } from './pages/tenant/TenantPgDetailPage';
import { TenantPgMatesPage } from './pages/tenant/TenantPgMatesPage';
import { TenantProfileSettingsPage } from './pages/tenant/TenantProfileSettingsPage';
import { TenantRentPage } from './pages/tenant/TenantRentPage';
import { TenantRoomDetailPage } from './pages/tenant/TenantRoomDetailPage';
import { TenantRoomiesPage } from './pages/tenant/TenantRoomiesPage';
import { VibeCalibrationPage } from './pages/tenant/VibeCalibrationPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Entry & Auth */}
            <Route path="/" element={<WelcomePage />} />
            <Route path="/role-selection" element={<RoleSelectionPage />} />
            <Route path="/auth/login" element={<AuthPage />} />
            <Route path="/auth/otp" element={<AuthPage />} />
            <Route path="/setup-guide" element={<SetupGuidePage />} />

            {/* Portal A: Staazy Tenant Application */}
            <Route
              path="/tenant"
              element={
                <ProtectedRoute allowedRoles={['tenant', 'admin', 'super_admin']}>
                  <TenantLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/tenant/home" replace />} />
              <Route path="home" element={<TenantHomePage />} />
              <Route path="onboarding/profile" element={<TenantOnboardingProfilePage />} />
              <Route path="onboarding/vibe" element={<VibeCalibrationPage />} />
              <Route path="discover" element={<TenantDiscoverPage />} />
              <Route path="pg/:propertyId" element={<TenantPgDetailPage />} />
              <Route path="pg/:propertyId/room/:roomId" element={<TenantRoomDetailPage />} />
              <Route path="roomies" element={<TenantRoomiesPage />} />
              <Route path="mypg" element={<TenantMyPgPage />} />
              <Route path="pg-mates" element={<TenantPgMatesPage />} />
              <Route path="chat" element={<TenantChatPage />} />
              <Route path="bookings" element={<TenantBookingsPage />} />
              <Route path="rent" element={<TenantRentPage />} />
              <Route path="complaints" element={<TenantComplaintsPage />} />
              <Route path="explore" element={<TenantExplorePage />} />
              <Route path="notifications" element={<TenantNotificationsPage />} />
              <Route path="profile" element={<TenantProfileSettingsPage />} />
            </Route>

            {/* Portal B: PG OS Owner Dashboard */}
            <Route
              path="/owner"
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'super_admin']}>
                  <OwnerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/owner/dashboard" replace />} />
              <Route path="onboarding" element={<OwnerOnboardingPage />} />
              <Route path="dashboard" element={<OwnerDashboardPage />} />
              <Route path="properties" element={<OwnerPropertiesPage />} />
              <Route path="properties/:propertyId/inventory" element={<OwnerInventoryPage />} />
              <Route path="applications" element={<OwnerApplicationsPage />} />
              <Route path="tenants" element={<OwnerTenantsPage />} />
              <Route path="daily-stays" element={<OwnerDailyStaysPage />} />
              <Route path="finance" element={<OwnerFinancePage />} />
              <Route path="expenses" element={<OwnerExpensesPage />} />
              <Route path="complaints" element={<OwnerComplaintsPage />} />
              <Route path="whatsapp" element={<OwnerWhatsAppPage />} />
              <Route path="team" element={<OwnerTeamPage />} />
              <Route path="reports" element={<OwnerReportsPage />} />
              <Route path="subscription" element={<OwnerSubscriptionPage />} />
              <Route path="settings" element={<OwnerSettingsPage />} />
            </Route>

            {/* Portal C: Staazy Super Admin Console */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="properties" element={<AdminPropertiesPage />} />
              <Route path="owners" element={<AdminUsersPage role="owner" />} />
              <Route path="tenants" element={<AdminUsersPage role="tenant" />} />
              <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
              <Route path="complaints" element={<AdminComplaintsPage />} />
              <Route path="marketplace" element={<AdminMarketplacePage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminFeedbackPage } from './pages/AdminFeedbackPage';
import { AdminSubscribersPage } from './pages/AdminSubscribersPage';
import { AdminSubscriberDetailPage } from './pages/AdminSubscriberDetailPage';
import { RequireAdminAuth } from './auth/RequireAdminAuth';

export function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLoginPage />} />

      <Route
        path=""
        element={
          <RequireAdminAuth>
            <AdminLayout />
          </RequireAdminAuth>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="feedback" element={<AdminFeedbackPage />} />
        <Route path="subscribers" element={<AdminSubscribersPage />} />
        <Route path="subscribers/:id" element={<AdminSubscriberDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}


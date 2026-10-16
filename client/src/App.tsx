import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Layouts
import { PublicLayout } from './components/layouts/PublicLayout';
import { WorkerLayout } from './components/layouts/WorkerLayout';
import { EmployerLayout } from './components/layouts/EmployerLayout';
import { AdminLayout } from './components/layouts/AdminLayout';
import { ProtectedRoute } from './components/layouts/ProtectedRoute';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { JobDiscoveryPage } from './pages/public/JobDiscoveryPage';
import { JobDetailPage } from './pages/public/JobDetailPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { SafetyPage } from './pages/public/SafetyPage';
import { AboutPage } from './pages/public/AboutPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/public/ResetPasswordPage';
import { VerifyEmailPage } from './pages/public/VerifyEmailPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { TermsPage } from './pages/public/TermsPage';

// Worker Pages
import { WorkerDashboardPage } from './pages/worker/WorkerDashboardPage';
import { WorkerProfilePage } from './pages/worker/WorkerProfilePage';
import { WorkerRecommendationsPage } from './pages/worker/WorkerRecommendationsPage';
import { WorkerSavedJobsPage } from './pages/worker/WorkerSavedJobsPage';
import { WorkerApplicationsPage } from './pages/worker/WorkerApplicationsPage';
import { WorkerAssignmentsPage } from './pages/worker/WorkerAssignmentsPage';
import { WorkerPaymentsPage } from './pages/worker/WorkerPaymentsPage';
import { WorkerReviewsPage } from './pages/worker/WorkerReviewsPage';
import { WorkerNotificationsPage } from './pages/worker/WorkerNotificationsPage';
import { WorkerSettingsPage } from './pages/worker/WorkerSettingsPage';

// Employer Pages
import { EmployerDashboardPage } from './pages/employer/EmployerDashboardPage';
import { EmployerProfilePage } from './pages/employer/EmployerProfilePage';
import { EmployerJobsPage } from './pages/employer/EmployerJobsPage';
import { CreateJobPage } from './pages/employer/CreateJobPage';
import { JobApplicantsPage } from './pages/employer/JobApplicantsPage';
import { EmployerAssignmentsPage } from './pages/employer/EmployerAssignmentsPage';
import { EmployerPaymentsPage } from './pages/employer/EmployerPaymentsPage';
import { EmployerReviewsPage } from './pages/employer/EmployerReviewsPage';
import { EmployerNotificationsPage } from './pages/employer/EmployerNotificationsPage';
import { EmployerSettingsPage } from './pages/employer/EmployerSettingsPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminJobsPage } from './pages/admin/AdminJobsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminVerificationsPage } from './pages/admin/AdminVerificationsPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/jobs" element={<JobDiscoveryPage />} />
              <Route path="/jobs/:jobId" element={<JobDetailPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/safety" element={<SafetyPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
            </Route>

            {/* Worker Routes */}
            <Route
              path="/worker"
              element={
                <ProtectedRoute allowedRoles={['worker']}>
                  <WorkerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/worker/dashboard" replace />} />
              <Route path="dashboard" element={<WorkerDashboardPage />} />
              <Route path="profile" element={<WorkerProfilePage />} />
              <Route path="discover" element={<JobDiscoveryPage />} />
              <Route path="recommendations" element={<WorkerRecommendationsPage />} />
              <Route path="saved-jobs" element={<WorkerSavedJobsPage />} />
              <Route path="applications" element={<WorkerApplicationsPage />} />
              <Route path="assignments" element={<WorkerAssignmentsPage />} />
              <Route path="payments" element={<WorkerPaymentsPage />} />
              <Route path="reviews" element={<WorkerReviewsPage />} />
              <Route path="notifications" element={<WorkerNotificationsPage />} />
              <Route path="settings" element={<WorkerSettingsPage />} />
            </Route>

            {/* Employer Routes */}
            <Route
              path="/employer"
              element={
                <ProtectedRoute allowedRoles={['employer']}>
                  <EmployerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/employer/dashboard" replace />} />
              <Route path="dashboard" element={<EmployerDashboardPage />} />
              <Route path="profile" element={<EmployerProfilePage />} />
              <Route path="jobs" element={<EmployerJobsPage />} />
              <Route path="jobs/create" element={<CreateJobPage />} />
              <Route path="jobs/:jobId/applicants" element={<JobApplicantsPage />} />
              <Route path="assignments" element={<EmployerAssignmentsPage />} />
              <Route path="payments" element={<EmployerPaymentsPage />} />
              <Route path="reviews" element={<EmployerReviewsPage />} />
              <Route path="notifications" element={<EmployerNotificationsPage />} />
              <Route path="settings" element={<EmployerSettingsPage />} />
            </Route>

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="jobs" element={<AdminJobsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="verifications" element={<AdminVerificationsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  const hasAccess = !allowedRoles || allowedRoles.some((role) => userRoles.includes(role));

  if (!hasAccess) {
    if (user.activeRole === 'worker' || user.role === 'worker') return <Navigate to="/worker/dashboard" replace />;
    if (user.activeRole === 'employer' || user.role === 'employer') return <Navigate to="/employer/dashboard" replace />;
    if (user.activeRole === 'admin' || user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

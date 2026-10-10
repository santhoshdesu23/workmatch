import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ShieldAlert,
  Users,
  Briefcase,
  AlertTriangle,
  BadgeCheck,
  Activity
} from 'lucide-react';
import { Navbar } from '../common/Navbar';

export const AdminLayout: React.FC = () => {
  const navItems = [
    { label: 'Platform Metrics', to: '/admin/dashboard', icon: Activity },
    { label: 'Users & Moderation', to: '/admin/users', icon: Users },
    { label: 'Job Moderation', to: '/admin/jobs', icon: Briefcase },
    { label: 'Incident Reports', to: '/admin/reports', icon: AlertTriangle },
    { label: 'Verification Queue', to: '/admin/verifications', icon: BadgeCheck }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        {/* Admin Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs sticky top-24">
            <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-semibold text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Administration Portal</span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin/dashboard'}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-amber-50 text-amber-900 font-semibold border border-amber-200/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

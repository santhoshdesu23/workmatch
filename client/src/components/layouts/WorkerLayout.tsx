import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  Compass,
  Bookmark,
  Layers,
  CalendarCheck2,
  DollarSign,
  UserCheck,
  Star,
  Bell,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { Navbar } from '../common/Navbar';
import { EmailVerificationBanner } from '../common/EmailVerificationBanner';

export const WorkerLayout: React.FC = () => {
  const navItems = [
    { label: 'Overview', to: '/worker/dashboard', icon: LayoutDashboard },
    { label: 'AI Matches', to: '/worker/recommendations', icon: Sparkles, badge: 'Smart' },
    { label: 'Discover Jobs', to: '/worker/discover', icon: Compass },
    { label: 'Saved Jobs', to: '/worker/saved-jobs', icon: Bookmark },
    { label: 'Applications', to: '/worker/applications', icon: Layers },
    { label: 'Confirmed Shifts', to: '/worker/assignments', icon: CalendarCheck2 },
    { label: 'Payment History', to: '/worker/payments', icon: DollarSign },
    { label: 'Worker Profile', to: '/worker/profile', icon: UserCheck },
    { label: 'Reviews', to: '/worker/reviews', icon: Star },
    { label: 'Notifications', to: '/worker/notifications', icon: Bell },
    { label: 'Settings', to: '/worker/settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        {/* Worker Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs sticky top-24">
            <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Worker Workspace</span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/worker/dashboard'}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 min-w-0">
          <EmailVerificationBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

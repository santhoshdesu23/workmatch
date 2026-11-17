import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarCheck,
  FileCheck2,
  AlertTriangle,
  BarChart3,
  ScrollText,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  UserCheck,
  Building2,
  UserX,
  FileSearch,
  Clock,
  Sparkles
} from 'lucide-react';
import { Navbar } from '../common/Navbar';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Collapsible groups
  const [usersOpen, setUsersOpen] = useState(true);
  const [jobsOpen, setJobsOpen] = useState(true);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname, location.search]);

  const navItems = [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
    {
      label: 'User Management',
      icon: Users,
      isGroup: true,
      isOpen: usersOpen,
      setIsOpen: setUsersOpen,
      subItems: [
        { label: 'All Users', to: '/admin/users', icon: Users },
        { label: 'Workers', to: '/admin/workers', icon: UserCheck },
        { label: 'Employers', to: '/admin/employers', icon: Building2 },
        { label: 'Suspended Accounts', to: '/admin/users?status=suspended', icon: UserX }
      ]
    },
    {
      label: 'Job Management',
      icon: Briefcase,
      isGroup: true,
      isOpen: jobsOpen,
      setIsOpen: setJobsOpen,
      subItems: [
        { label: 'All Jobs', to: '/admin/jobs', icon: Briefcase },
        { label: 'Active Jobs', to: '/admin/jobs?status=OPEN', icon: Sparkles },
        { label: 'Pending Review', to: '/admin/jobs?status=DRAFT', icon: FileSearch },
        { label: 'Expired Jobs', to: '/admin/jobs?status=EXPIRED', icon: Clock }
      ]
    },
    { label: 'Applications & Recruitment', to: '/admin/applications', icon: FileCheck2 },
    { label: 'Attendance Monitoring', to: '/admin/attendance', icon: CalendarCheck },
    { label: 'Verification Management', to: '/admin/verifications', icon: ShieldCheck },
    { label: 'Reports & Complaints', to: '/admin/reports', icon: AlertTriangle },
    { label: 'Analytics & Reports', to: '/admin/analytics', icon: BarChart3 },
    { label: 'Admin Activity Logs', to: '/admin/audit-logs', icon: ScrollText },
    { label: 'Settings', to: '/admin/settings', icon: Settings }
  ];

  const renderNavLinks = () => (
    <div className="space-y-1">
      {navItems.map((item) => {
        if (item.isGroup) {
          const GroupIcon = item.icon;
          const isGroupActive = item.subItems?.some((sub) => {
            const current = location.pathname + location.search;
            return current === sub.to || location.pathname === sub.to;
          });

          return (
            <div key={item.label} className="pt-2">
              <button
                type="button"
                onClick={() => item.setIsOpen?.(!item.isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                  isGroupActive ? 'text-primary-700 bg-primary-50/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <GroupIcon className={`w-4 h-4 ${isGroupActive ? 'text-primary-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {item.isOpen && item.subItems && (
                <div className="ml-4 pl-3 mt-1 border-l border-slate-200 space-y-1">
                  {item.subItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isActive = (location.pathname + location.search) === sub.to;

                    return (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-primary-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{sub.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const Icon = item.icon;
        const isActive = location.pathname === item.to;

        return (
          <NavLink
            key={item.to}
            to={item.to!}
            end={item.to === '/admin/dashboard'}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      {/* Admin Subheader Bar on Mobile */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
            Admin Portal
          </span>
          <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">
            {user?.name || 'Administrator'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-[270px] xl:w-[280px] shrink-0">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs sticky top-24">
            {/* Header branding */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  WM
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    WorkMatch Admin
                  </h2>
                  <p className="text-[10px] text-slate-500">Governance & Ops</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium">
                Live
              </span>
            </div>

            {/* Navigation links */}
            <nav className="max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
              {renderNavLinks()}
            </nav>

            {/* Admin identity badge */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'Administrator'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email || 'admin@workmatch.demo'}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold text-xs">
                    WM
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      WorkMatch Admin
                    </h2>
                    <p className="text-[10px] text-slate-500">Administration Portal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {renderNavLinks()}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content Outlet */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

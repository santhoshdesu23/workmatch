import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Briefcase,
  Bell,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Sparkles,
  Shield,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';

export const Navbar: React.FC = () => {
  const { user, logout, demoLogin } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      api.get('/notifications')
        .then((res) => {
          if (res.data?.success) {
            setUnreadCount(res.data.unreadCount || 0);
          }
        })
        .catch(() => {});
    }
  }, [user, location.pathname]);

  const handleLogout = () => {
    logout();
    info('You have been logged out.');
    navigate('/');
  };

  const handleDemoSwitch = async (role: 'worker' | 'worker2' | 'employer' | 'admin') => {
    await demoLogin(role);
    info(`Switched to demo ${role} account!`);
    if (role === 'worker' || role === 'worker2') navigate('/worker/dashboard');
    else if (role === 'employer') navigate('/employer/dashboard');
    else if (role === 'admin') navigate('/admin/dashboard');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      {/* Top Demo Bar for Reviewers & Evaluators (Available in development & preview) */}
      {(!import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEMO_SHORTCUTS === 'true') && (
        <div className="bg-slate-900 text-slate-200 text-xs py-1.5 px-4 hidden sm:flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-slate-300">Evaluation Sandbox Mode</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Instant Role Switcher:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDemoSwitch('worker')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Worker (Alex)
            </button>
            <button
              onClick={() => handleDemoSwitch('worker2')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Worker (Jordan)
            </button>
            <button
              onClick={() => handleDemoSwitch('employer')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Employer (Apex Staffing)
            </button>
            <button
              onClick={() => handleDemoSwitch('admin')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Administrator
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/20">
              <Briefcase className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">WorkMatch</span>
              <span className="hidden sm:inline-block text-[11px] font-medium text-emerald-600 ml-1.5 px-1.5 py-0.5 bg-emerald-50 rounded-md border border-emerald-200/60">
                Temporary Work
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/jobs"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/jobs' ? 'text-emerald-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Find Work
            </Link>
            <Link
              to="/how-it-works"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/how-it-works' ? 'text-emerald-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              How It Works
            </Link>
            <Link
              to="/safety"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/safety' ? 'text-emerald-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trust & Safety
            </Link>
            <Link
              to="/about"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/about' ? 'text-emerald-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              About
            </Link>
          </nav>

          {/* Right Action Menu */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Role Specific Shortcuts */}
                {user.role === 'worker' && (
                  <>
                    <Link
                      to="/worker/recommendations"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Matches
                    </Link>
                    <Link
                      to="/worker/dashboard"
                      className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                      Worker Hub
                    </Link>
                  </>
                )}

                {user.role === 'employer' && (
                  <>
                    <Link
                      to="/employer/jobs/create"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                    >
                      Post Shift
                    </Link>
                    <Link
                      to="/employer/dashboard"
                      className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                      Employer Hub
                    </Link>
                  </>
                )}

                {user.role === 'admin' && (
                  <Link
                    to="/admin/dashboard"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin Control
                  </Link>
                )}

                {/* Notifications Bell */}
                <Link
                  to={user.role === 'worker' ? '/worker/notifications' : user.role === 'employer' ? '/employer/notifications' : '/admin/dashboard'}
                  className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Link>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-xs">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-slate-800 max-w-[100px] truncate">{user.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-fade-in"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <div className="px-3 py-1.5 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{user.role}</p>
                      </div>

                      {user.role === 'worker' && (
                        <>
                          <Link to="/worker/profile" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                            <UserIcon className="w-4 h-4 text-slate-400" /> Worker Profile
                          </Link>
                          <Link to="/worker/applications" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                            <Layers className="w-4 h-4 text-slate-400" /> My Applications
                          </Link>
                        </>
                      )}

                      {user.role === 'employer' && (
                        <>
                          <Link to="/employer/profile" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                            <UserIcon className="w-4 h-4 text-slate-400" /> Business Profile
                          </Link>
                          <Link to="/employer/jobs" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                            <Briefcase className="w-4 h-4 text-slate-400" /> My Postings
                          </Link>
                        </>
                      )}

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 text-left cursor-pointer border-t border-slate-100 mt-1"
                      >
                        <LogOut className="w-4 h-4" /> Log Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl shadow-xs transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Toggle Navigation"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 animate-fade-in">
          <Link
            to="/jobs"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            Find Work
          </Link>
          <Link
            to="/how-it-works"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            How It Works
          </Link>
          <Link
            to="/safety"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            Trust & Safety
          </Link>
          <Link
            to="/about"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            About WorkMatch
          </Link>

          <div className="pt-3 border-t border-slate-100">
            {user ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Logged in as {user.name} ({user.role})
                </div>
                {user.role === 'worker' && (
                  <Link
                    to="/worker/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-sm font-medium text-emerald-600 py-1"
                  >
                    Worker Dashboard
                  </Link>
                )}
                {user.role === 'employer' && (
                  <Link
                    to="/employer/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-sm font-medium text-emerald-600 py-1"
                  >
                    Employer Dashboard
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-sm font-medium text-amber-600 py-1"
                  >
                    Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block text-sm font-medium text-rose-600 py-1 text-left w-full cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-center text-sm font-medium text-slate-700 border border-slate-200 py-2 rounded-xl"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-center text-sm font-medium text-white bg-emerald-600 py-2 rounded-xl"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Building2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

export const LoginPage: React.FC = () => {
  const { login, demoLogin } = useAuth();
  const { success, error: toastError, info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = await login(email, password);
      success(`Welcome back, ${user.name}!`);
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'worker') {
        navigate('/worker/dashboard');
      } else if (user.role === 'employer') {
        navigate('/employer/dashboard');
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      toastError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (role: 'worker' | 'worker2' | 'employer' | 'admin') => {
    setIsLoading(true);
    try {
      const user = await demoLogin(role);
      success(`Logged in as ${user.name} (${user.role})!`);
      if (user.role === 'worker') navigate('/worker/dashboard');
      else if (user.role === 'employer') navigate('/employer/dashboard');
      else if (user.role === 'admin') navigate('/admin/dashboard');
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm shadow-emerald-600/20">
          <Briefcase className="w-6 h-6 stroke-[2]" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Log in to WorkMatch</h1>
        <p className="text-xs text-slate-500">Access your worker or employer workspace</p>
      </div>

      {/* Demo Account Quick-Access Cards */}
      <Card className="p-4 bg-emerald-50/50 border-emerald-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> 1-Click Demo Logins
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Instant Evaluation</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleQuickDemo('worker')}
            className="p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 text-left transition-all hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Worker 1
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Alex (Hospitality)</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDemo('worker2')}
            className="p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 text-left transition-all hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Worker 2
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Jordan (Warehouse)</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDemo('employer')}
            className="p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 text-left transition-all hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Employer
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Apex Event Staffing</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDemo('admin')}
            className="p-2.5 rounded-xl bg-white border border-amber-300 hover:border-amber-500 text-left transition-all hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Administrator
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Full Platform Access</div>
          </button>
        </div>
      </Card>

      {/* Manual Login Card */}
      <Card className="p-6 sm:p-8 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-[11px] text-emerald-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full h-11" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Sign In
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Don't have an account yet?{' '}
          <Link to="/register" className="font-semibold text-emerald-600 hover:underline">
            Register for free
          </Link>
        </div>
      </Card>
    </div>
  );
};

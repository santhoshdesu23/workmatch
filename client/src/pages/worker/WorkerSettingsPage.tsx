import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, CheckCircle2, User } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

export const WorkerSettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleVerifyEmail = async () => {
    setVerifyingEmail(true);
    try {
      const res = await api.post('/auth/verify-email');
      if (res.data?.success) {
        success('Email verified successfully!');
        refreshUser();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toastError('Password must be at least 8 characters.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.post('/auth/reset-password', {
        email: user?.email,
        newPassword
      });
      if (res.data?.success) {
        success('Password updated successfully.');
        setNewPassword('');
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & Security Settings</h1>
        <p className="text-xs text-slate-500">
          Manage your security credentials, email verification, and privacy settings.
        </p>
      </div>

      {/* Account Info & Email Verification */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
          Identity & Contact Verification
        </h2>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">{user?.email}</span>
              <span className="text-[11px] text-slate-500">
                {user?.emailVerified ? 'Verified Email Address' : 'Pending Email Verification'}
              </span>
            </div>
          </div>

          {user?.emailVerified ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verified
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              isLoading={verifyingEmail}
              onClick={handleVerifyEmail}
            >
              Verify Email Now
            </Button>
          )}
        </div>
      </Card>

      {/* Password Reset */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
          Update Security Password
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <Button type="submit" size="sm" isLoading={isChangingPassword}>
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
};

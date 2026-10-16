import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, CheckCircle2, Building2, Clock } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

export const EmployerSettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Business verification state
  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [verificationType, setVerificationType] = useState('business_license');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

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
    if (!currentPassword) {
      toastError('Current password is required.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toastError('New password must be at least 8 characters long.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      if (res.data?.success) {
        success('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
        }
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationNumber.trim()) {
      toastError('Please provide a business registration or tax ID number.');
      return;
    }

    setIsSubmittingVerification(true);
    try {
      const res = await api.post('/auth/verification-request', {
        verificationType,
        submittedData: {
          businessName: businessName.trim() || user?.name,
          registrationNumber: registrationNumber.trim(),
          documentType: verificationType
        }
      });
      if (res.data?.success) {
        success('Organization verification submitted for moderation!');
        setRegistrationNumber('');
        refreshUser();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employer Account & Verification Settings</h1>
        <p className="text-xs text-slate-500">
          Manage your organization credentials, security access, and verification credentials.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
          Entity Verification Status
        </h2>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">{user?.email}</span>
              <span className="text-[11px] text-slate-500 capitalize">
                Verification: {user?.verificationStatus || 'unverified'}
              </span>
            </div>
          </div>

          {user?.emailVerified ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verified Email
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

        {/* Business License / Entity Verification Request */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Organization Trust & Safety Verification</span>
              <span className="text-[11px] text-slate-500">
                Status: {user?.verificationStatus?.toUpperCase() || 'UNVERIFIED'}
              </span>
            </div>
          </div>

          {user?.verificationStatus === 'verified' ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verified Business Entity
            </span>
          ) : user?.verificationStatus === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
              <Clock className="w-4 h-4 text-amber-600" /> Under Administrative Review
            </span>
          ) : (
            <form onSubmit={handleSubmitVerification} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <select
                aria-label="Verification Type"
                value={verificationType}
                onChange={(e) => setVerificationType(e.target.value)}
                className="text-xs p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="business_license">Business License</option>
                <option value="tax_id">Tax ID / EIN</option>
              </select>
              <input
                type="text"
                placeholder="Registration / Tax ID #"
                aria-label="Registration or Tax ID Number"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                className="text-xs p-2 border border-slate-200 rounded-lg bg-white"
                required
              />
              <Button type="submit" size="sm" variant="outline" isLoading={isSubmittingVerification}>
                Submit
              </Button>
            </form>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-600" /> Update Security Password
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
          <div>
            <label htmlFor="employer-current-password" className="block text-xs font-medium text-slate-700 mb-1">Current Password</label>
            <input
              id="employer-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Your current password..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="employer-new-password" className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
            <input
              id="employer-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters with number/symbol..."
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

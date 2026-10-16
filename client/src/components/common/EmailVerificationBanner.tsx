import React, { useState } from 'react';
import { Mail, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';
import { Button } from './Button';

interface EmailVerificationBannerProps {
  customMessage?: string;
  className?: string;
}

export const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({
  customMessage,
  className = ''
}) => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // If user is verified or not logged in, do not render banner
  if (!user || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      const res = await api.post('/auth/resend-verification');
      if (res.data?.success) {
        setResendSent(true);
        success('Verification email sent! Please check your inbox and spam folder.');
      } else {
        toastError(res.data?.message || 'Could not dispatch verification email.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      className={`bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 text-amber-900 shadow-xs mb-6 ${className}`}
      role="alert"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <Mail className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-amber-950">
                Action Required: Verify Your Email Address
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                Unverified
              </span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed max-w-2xl">
              {customMessage ||
                (user.role === 'worker'
                  ? 'Your email address must be verified before you can submit applications to temporary shifts. Please check your inbox for the verification link.'
                  : 'Your email address must be verified before you can post or publish job shifts. Please check your inbox for the verification link.')}
            </p>
            <div className="text-[11px] text-amber-700 flex items-center gap-1.5 pt-0.5">
              <span>Account email:</span>
              <span className="font-semibold underline">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="sm:shrink-0 flex items-center gap-2 w-full sm:w-auto">
          {resendSent ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Email Dispatched! Check Inbox</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              isLoading={isResending}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              Resend Verification Link
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

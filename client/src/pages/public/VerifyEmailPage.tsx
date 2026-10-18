import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  // Capture token on initial mount and immediately scrub the token parameter from the address bar & history
  const [tokenToVerify] = useState<string>(() => {
    const raw = searchParams.get('token') || '';
    if (raw && typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('token');
        const remainingQuery = currentUrl.searchParams.toString();
        const cleanUrl = currentUrl.pathname + (remainingQuery ? `?${remainingQuery}` : '') + currentUrl.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (err) {
        // Fallback: preserve path without query
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    return raw;
  });

  const [verifying, setVerifying] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Resend state
  const [resendEmail, setResendEmail] = useState<string>(user?.email || '');
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);

  // Enforce no-referrer policy while on the verification page
  useEffect(() => {
    let meta = document.querySelector('meta[name="referrer"]') as HTMLMetaElement | null;
    const previousPolicy = meta ? meta.content : null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'referrer';
      document.head.appendChild(meta);
    }
    meta.content = 'no-referrer';

    return () => {
      if (meta) {
        if (previousPolicy) {
          meta.content = previousPolicy;
        } else {
          meta.remove();
        }
      }
    };
  }, []);

  useEffect(() => {
    if (user?.email && !resendEmail) {
      setResendEmail(user.email);
    }
  }, [user]);

  // If token was present in the URL, verify automatically on load via POST
  useEffect(() => {
    if (!tokenToVerify) return;

    let isMounted = true;
    const executeVerification = async () => {
      setVerifying(true);
      setErrorMessage('');
      try {
        const res = await api.post('/auth/verify-email', { token: tokenToVerify });
        if (!isMounted) return;

        if (res.data?.success) {
          setIsVerified(true);
          toastSuccess('Email verified successfully!');
          if (refreshUser) {
            await refreshUser();
          }
        } else {
          setErrorMessage(res.data?.message || 'Verification token is invalid or has expired.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(
          err.message || 'Verification link is invalid or has expired. Please request a new verification link below.'
        );
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    };

    executeVerification();

    return () => {
      isMounted = false;
    };
  }, [tokenToVerify]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      toastError('Please enter your email address.');
      return;
    }

    setIsResending(true);
    setResendSuccess(false);
    try {
      const res = await api.post('/auth/resend-verification', {
        email: resendEmail.trim().toLowerCase()
      });
      if (res.data?.success) {
        setResendSuccess(true);
        toastSuccess('Verification email sent! Check your inbox.');
      } else {
        toastError(res.data?.message || 'Failed to dispatch verification email.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to dispatch verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const getDestinationUrl = () => {
    if (!user) return '/login';
    if (user.role === 'worker') return '/worker/dashboard';
    if (user.role === 'employer') return '/employer/dashboard';
    if (user.role === 'admin') return '/admin/dashboard';
    return '/';
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <Link
        to={getDestinationUrl()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {user ? 'Dashboard' : 'Log In'}
      </Link>

      <Card className="p-6 sm:p-8 space-y-6 shadow-sm border border-slate-200">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Email Verification</h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            WorkMatch requires a verified email address to safeguard shift applications and employer postings.
          </p>
        </div>

        {/* State 1: Verifying in progress */}
        {verifying && (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">Verifying your email token...</h3>
            <p className="text-xs text-slate-500">Please wait while we confirm your credentials with the server.</p>
          </div>
        )}

        {/* State 2: Verification Success */}
        {isVerified && !verifying && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-emerald-950">Email Successfully Verified!</h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Thank you for confirming your email address. Your WorkMatch account is now fully authorized to submit shift applications and publish job listings.
              </p>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => navigate(getDestinationUrl())}
              >
                Continue to {user ? 'Workspace' : 'Sign In'}
              </Button>
            </div>
          </div>
        )}

        {/* State 3: Token Error or Missing Token */}
        {!isVerified && !verifying && (
          <div className="space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Verification Failed</span>
                  <span className="text-rose-800 leading-relaxed">{errorMessage}</span>
                </div>
              </div>
            )}

            {!tokenToVerify && !errorMessage && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Verification Link Pending</span>
                  <span className="text-blue-800 leading-relaxed">
                    Check your email inbox for your activation link. If you didn't receive it or the link expired (valid for 24 hours), request a fresh link below.
                  </span>
                </div>
              </div>
            )}

            {/* Resend Form */}
            <form onSubmit={handleResend} className="space-y-4 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Request New Verification Link
                </h3>
                <p className="text-[11px] text-slate-500">
                  Enter your email address and we'll dispatch a fresh verification link.
                </p>
              </div>

              <div>
                <label htmlFor="verify-email-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="verify-email-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>

              {resendSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Fresh verification link dispatched! Please check your inbox and spam folder.</span>
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                className="w-full"
                isLoading={isResending}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Send Verification Email
              </Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
};

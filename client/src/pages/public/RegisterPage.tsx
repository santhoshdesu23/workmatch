import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  UserCheck,
  Building2,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Role } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { NameInputField } from '../../components/common/NameInputField';
import { validateName } from '../../utils/nameValidation';
import api from '../../api/client';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRole = (searchParams.get('role') as Role) || 'worker';
  const [role, setRole] = useState<Role>(initialRole);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<{ message: string; isConflict?: boolean } | null>(null);

  // OTP Verification States
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [lastSentEmail, setLastSentEmail] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);

  // Name Field Validation States
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string | null; lastName?: string | null }>({});
  const [touched, setTouched] = useState<{ firstName?: boolean; lastName?: boolean }>({});

  // 60-Second Cooldown Timer Effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleFirstNameChange = (val: string) => {
    setFirstName(val);
    if (touched.firstName) {
      const res = validateName(val, 'First name');
      setFieldErrors((prev) => ({ ...prev, firstName: res.error }));
    }
  };

  const handleFirstNameBlur = () => {
    setTouched((prev) => ({ ...prev, firstName: true }));
    const res = validateName(firstName, 'First name');
    setFieldErrors((prev) => ({ ...prev, firstName: res.error }));
  };

  const handleLastNameChange = (val: string) => {
    setLastName(val);
    if (touched.lastName) {
      const res = validateName(val, 'Last name');
      setFieldErrors((prev) => ({ ...prev, lastName: res.error }));
    }
  };

  const handleLastNameBlur = () => {
    setTouched((prev) => ({ ...prev, lastName: true }));
    const res = validateName(lastName, 'Last name');
    setFieldErrors((prev) => ({ ...prev, lastName: res.error }));
  };

  const validateEmailFormat = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailFieldError('Email address is required.');
      return false;
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(trimmed)) {
      setEmailFieldError('Please enter a valid email address.');
      return false;
    }
    setEmailFieldError(null);
    return true;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setEmailFieldError(null);
    setOtpError(null);

    const normalizedNew = newEmail.toLowerCase().trim();

    // If email changes after verification, reset verified status
    if (isEmailVerified && normalizedNew !== verifiedEmail) {
      setIsEmailVerified(false);
      setVerifiedEmail(null);
      setVerificationToken(null);
      setOtpSent(false);
      setOtp('');
      setOtpSuccessMessage(null);
      setCooldown(0);
    } else if (otpSent && normalizedNew !== lastSentEmail) {
      // If code was pending and email changed, safely abandon previous session
      setOtpSent(false);
      setOtp('');
      setOtpSuccessMessage(null);
      setCooldown(0);
    }
  };

  const handleSendOtp = async () => {
    if (!validateEmailFormat(email)) return;
    if (isSendingOtp) return;

    setIsSendingOtp(true);
    setOtpError(null);
    setOtpSuccessMessage(null);

    try {
      const normalized = email.toLowerCase().trim();
      const res = await api.post('/auth/send-registration-otp', { email: normalized });
      setOtpSent(true);
      setLastSentEmail(normalized);
      setCooldown(60);
      setOtp('');
      const msg = res.data?.message || 'Verification code sent. Check your inbox.';
      setOtpSuccessMessage(msg);
      success(msg);
    } catch (err: any) {
      const isConflict = err.status === 409 || err.message?.toLowerCase().includes('already exists');
      const msg = isConflict
        ? 'An account with this email address already exists. Please log in.'
        : err.message || 'Failed to send verification code. Please try again.';
      setOtpError(msg);
      toastError(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 4) {
      setOtpError('Please enter a 4-digit verification code.');
      return;
    }
    if (isVerifyingOtp) return;

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const normalized = email.toLowerCase().trim();
      const res = await api.post('/auth/verify-registration-otp', {
        email: normalized,
        otp: cleanOtp
      });
      setIsEmailVerified(true);
      setVerifiedEmail(normalized);
      setVerificationToken(res.data?.verificationToken || null);
      setOtpSuccessMessage('Email verified ✓');
      success('Email verified successfully!');
    } catch (err: any) {
      const msg = err.message || 'Incorrect or expired verification code.';
      setOtpError(msg);
      toastError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate both name fields independently before submission
    const firstRes = validateName(firstName, 'First name');
    const lastRes = validateName(lastName, 'Last name');

    setTouched({ firstName: true, lastName: true });
    setFieldErrors({
      firstName: firstRes.error,
      lastName: lastRes.error
    });

    if (!firstRes.isValid || !lastRes.isValid) {
      return;
    }

    if (!validateEmailFormat(email)) {
      return;
    }

    // Strict client-side gate: email MUST be verified on backend before submitting
    const normalizedEmail = email.toLowerCase().trim();
    if (!isEmailVerified || !verifiedEmail || verifiedEmail !== normalizedEmail) {
      const msg = 'Please verify your email address using the 4-digit code above before registering.';
      setFormError({ message: msg });
      toastError(msg);
      return;
    }

    if (!agreedToTerms) {
      toastError('You must agree to the Terms of Service and Voluntary Marketplace Principles.');
      return;
    }

    setIsLoading(true);
    try {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const user = await register({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        name: `${trimmedFirst} ${trimmedLast}`,
        email: normalizedEmail,
        password,
        role,
        businessName: role === 'employer' ? businessName : undefined,
        verificationToken: verificationToken || undefined
      });
      success(`Welcome to WorkMatch, ${user.name}!`);
      if (user.role === 'worker') navigate('/worker/dashboard');
      else if (user.role === 'employer') navigate('/employer/dashboard');
      else navigate('/');
    } catch (err: any) {
      const isConflict = err.status === 409 || err.message?.toLowerCase().includes('already exists');
      const errorMsg = isConflict
        ? 'An account with this email address already exists.'
        : err.message || 'Registration failed. Please check your form details.';
      
      setFormError({ message: errorMsg, isConflict });
      toastError(errorMsg);
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create your WorkMatch Account</h1>
        <p className="text-xs text-slate-500">Join a verified network of local workers and trusted employers</p>
      </div>

      <Card className="p-6 sm:p-8 space-y-6">
        {/* Role Selector Tabs */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">I am registering as:</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setRole('worker')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                role === 'worker'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Worker (Find Work)</span>
            </button>

            <button
              type="button"
              onClick={() => setRole('employer')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                role === 'employer'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Employer (Hire Staff)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. First Name & 2. Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <NameInputField
              id="register-first-name"
              name="firstName"
              label={role === 'employer' ? 'Representative First Name' : 'First Name'}
              value={firstName}
              onChange={handleFirstNameChange}
              onBlur={handleFirstNameBlur}
              error={fieldErrors.firstName}
              placeholder="e.g. Alex"
              autoComplete="given-name"
              required
              icon={<User className="w-4 h-4 text-slate-400" />}
            />

            <NameInputField
              id="register-last-name"
              name="lastName"
              label={role === 'employer' ? 'Representative Last Name' : 'Last Name'}
              value={lastName}
              onChange={handleLastNameChange}
              onBlur={handleLastNameBlur}
              error={fieldErrors.lastName}
              placeholder="e.g. Rivera"
              autoComplete="family-name"
              required
              icon={<User className="w-4 h-4 text-slate-400" />}
            />
          </div>

          {/* Employer Business Name */}
          {role === 'employer' && (
            <div>
              <label htmlFor="register-business-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Business / Organization Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="register-business-name"
                  name="businessName"
                  type="text"
                  autoComplete="organization"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Hospitality LLC"
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 3. Email Address */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700">
                Email Address
              </label>
              {isEmailVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Verified
                </span>
              )}
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                placeholder="name@example.com"
                className={`w-full text-xs pl-10 pr-10 py-2.5 border rounded-xl focus:outline-none transition-colors ${
                  isEmailVerified
                    ? 'border-emerald-300 bg-emerald-50/20 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    : emailFieldError
                      ? 'border-rose-300 bg-rose-50/10 focus:ring-1 focus:ring-rose-500'
                      : 'border-slate-200 focus:ring-1 focus:ring-emerald-500'
                }`}
              />
              {isEmailVerified && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3" />
              )}
            </div>
            {emailFieldError && (
              <p className="mt-1 text-[11px] text-rose-600 font-medium">{emailFieldError}</p>
            )}
          </div>

          {/* 4. Email Verification OTP Section (Immediately below Email Address) */}
          <div
            id="email-verification-otp-section"
            className={`p-3.5 sm:p-4 rounded-xl border transition-all space-y-3 ${
              isEmailVerified
                ? 'bg-emerald-50/60 border-emerald-200'
                : otpSent
                  ? 'bg-slate-50 border-slate-200 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200'
            }`}
          >
            {/* Header / Instructions */}
            <div className="flex items-start gap-2">
              <ShieldCheck className={`w-4 h-4 mt-0.5 shrink-0 ${isEmailVerified ? 'text-emerald-600' : 'text-slate-500'}`} />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">Email Verification</span>
                {isEmailVerified ? (
                  <p className="text-emerald-700 font-medium mt-0.5">
                    Email verified ✓ Your address has been confirmed.
                  </p>
                ) : otpSent ? (
                  <p className="text-slate-600 mt-0.5">
                    Verification code sent. Check your inbox for the 4-digit code.
                  </p>
                ) : (
                  <p className="text-slate-500 mt-0.5">
                    A four-digit verification code will be sent to the entered email address.
                  </p>
                )}
              </div>
            </div>

            {/* Verification Controls: Initial vs Pending vs Verified */}
            {isEmailVerified ? (
              <div className="flex items-center gap-2 p-2.5 bg-white border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Email verified ✓ ({verifiedEmail})</span>
              </div>
            ) : !otpSent ? (
              /* Initially: 4-digit OTP input + Send Verification Code button */
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative">
                    <input
                      id="initial-otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      disabled
                      placeholder="0000"
                      aria-label="4-digit OTP code"
                      className="w-full sm:w-28 text-center text-xs tracking-widest font-mono py-2.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    isLoading={isSendingOtp}
                    disabled={!email || isSendingOtp}
                    className="w-full sm:flex-1 h-10 text-xs"
                    leftIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    Send Verification Code
                  </Button>
                </div>
              </div>
            ) : (
              /* After requesting code: 4-digit numeric input (0000-9999) + Verify Email + Resend Code */
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="relative w-full sm:w-32">
                    <input
                      id="register-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setOtp(sanitized);
                        if (otpError) setOtpError(null);
                      }}
                      placeholder="0000"
                      className="w-full text-center text-sm tracking-widest font-mono font-bold py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      disabled={isVerifyingOtp}
                      aria-label="Enter 4-digit verification code"
                      autoFocus
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    isLoading={isVerifyingOtp}
                    disabled={otp.length !== 4 || isVerifyingOtp}
                    className="w-full sm:flex-1 h-9 text-xs"
                  >
                    Verify Email
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendOtp}
                    disabled={cooldown > 0 || isSendingOtp}
                    isLoading={isSendingOtp}
                    className="w-full sm:w-auto h-9 text-xs shrink-0"
                    leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin' : ''}`} />}
                  >
                    {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Code'}
                  </Button>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Preserves leading zeros (0000–9999). Code expires in 5 minutes.</span>
                </div>
              </div>
            )}

            {/* OTP Status Messages */}
            {otpSuccessMessage && !isEmailVerified && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{otpSuccessMessage}</span>
              </div>
            )}

            {otpError && (
              <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span>{otpError}</span>
              </div>
            )}
          </div>

          {/* 5. Password */}
          <div>
            <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Terms Agreement */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-slate-500 leading-relaxed cursor-pointer">
              I agree to the{' '}
              <Link to="/terms" className="text-emerald-600 underline">
                Terms of Service
              </Link>
              , the{' '}
              <Link to="/privacy" className="text-emerald-600 underline">
                Privacy Policy
              </Link>
              , and acknowledge WorkMatch operates strictly on voluntary applications and transparent pay.
            </label>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-1.5 animate-fadeIn">
              <p className="font-semibold">{formError.message}</p>
              {formError.isConflict && (
                <p>
                  Would you like to{' '}
                  <Link to="/login" className="font-bold underline text-rose-800 hover:text-rose-900">
                    Log in to your existing account
                  </Link>
                  {' '}instead?
                </p>
              )}
            </div>
          )}

          {/* 7. Register Button */}
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!isEmailVerified || isLoading}
            className="w-full h-11"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Complete Registration
          </Button>

          {!isEmailVerified && (
            <p className="text-center text-[11px] text-slate-500">
              Please verify your email address above to complete registration.
            </p>
          )}
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-emerald-600 hover:underline">
            Log in instead
          </Link>
        </div>
      </Card>
    </div>
  );
};

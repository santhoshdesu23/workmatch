import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, UserCheck, Building2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Role } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { NameInputField } from '../../components/common/NameInputField';
import { validateName } from '../../utils/nameValidation';

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

  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string | null; lastName?: string | null }>({});
  const [touched, setTouched] = useState<{ firstName?: boolean; lastName?: boolean }>({});

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
        email,
        password,
        role,
        businessName: role === 'employer' ? businessName : undefined
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

          {role === 'employer' && (
            <div>
              <label htmlFor="register-business-name" className="block text-xs font-semibold text-slate-700 mb-1.5">Business / Organization Name</label>
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

          <div>
            <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

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

          <Button type="submit" isLoading={isLoading} className="w-full h-11" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Complete Registration
          </Button>
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

import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, Globe, ShieldCheck, Save, Navigation, User } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployerProfile } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { AccountDeletionSection } from '../../components/common/AccountDeletionSection';
import { NameInputField } from '../../components/common/NameInputField';
import { validateName } from '../../utils/nameValidation';

export const EmployerProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameErrors, setNameErrors] = useState<{ firstName?: string | null; lastName?: string | null }>({});
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number]>([0, 0]);
  const [phone, setPhone] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get('/employers/me');
        if (res.data?.success && res.data?.profile) {
          const p: EmployerProfile = res.data.profile;
          const u = res.data.user || user;
          if (u) {
            if (u.firstName && u.lastName) {
              setFirstName(u.firstName);
              setLastName(u.lastName);
            } else if (u.name) {
              const parts = u.name.trim().split(/\s+/);
              setFirstName(parts[0] || '');
              setLastName(parts.slice(1).join(' ') || '');
            }
          }
          setBusinessName(p.businessName || '');
          setDescription(p.description || '');
          setBusinessCategory(p.businessCategory || 'Event and Hospitality Logistics');
          setBusinessAddress(p.businessAddress || '');
          if (p.location?.coordinates) setCoordinates(p.location.coordinates);
          setPhone(p.publicContact?.phone || '');
          setPublicEmail(p.publicContact?.email || '');
          setWebsite(p.publicContact?.website || '');
        }
      } catch (err: any) {
        toastError(err.message || 'Failed to fetch employer profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleUseBrowserGPS = () => {
    if (!navigator.geolocation) {
      toastError('Geolocation not supported in browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates([pos.coords.longitude, pos.coords.latitude]);
        success('Business coordinates fetched.');
      },
      (err) => toastError(err.message)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const firstRes = validateName(firstName, 'Representative first name');
    const lastRes = validateName(lastName, 'Representative last name');

    setNameErrors({
      firstName: firstRes.error,
      lastName: lastRes.error
    });

    if (!firstRes.isValid || !lastRes.isValid) {
      toastError(firstRes.error || lastRes.error || 'Please correct representative name fields before saving.');
      return;
    }

    setSaving(true);
    try {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();

      await api.patch('/employers/me', {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        name: `${trimmedFirst} ${trimmedLast}`,
        businessName,
        description,
        businessCategory,
        businessAddress,
        coordinates,
        publicContact: { phone, email: publicEmail, website }
      });
      await refreshUser();
      success('Employer profile updated successfully!');
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Profile & Verification</h1>
          <p className="text-xs text-slate-500">
            Maintain your official organization presence displayed on job listings.
          </p>
        </div>

        {user?.verificationStatus === 'verified' && (
          <Badge variant="blue" size="md">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            Verified Business Entity
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Company Overview
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NameInputField
              id="employer-first-name"
              name="firstName"
              label="Representative First Name"
              value={firstName}
              onChange={(val) => {
                setFirstName(val);
                if (nameErrors.firstName) {
                  setNameErrors((prev) => ({ ...prev, firstName: validateName(val, 'Representative first name').error }));
                }
              }}
              onBlur={() => {
                setNameErrors((prev) => ({ ...prev, firstName: validateName(firstName, 'Representative first name').error }));
              }}
              error={nameErrors.firstName}
              placeholder="e.g. Marcus"
              autoComplete="given-name"
              required
              icon={<User className="w-4 h-4 text-slate-400" />}
            />

            <NameInputField
              id="employer-last-name"
              name="lastName"
              label="Representative Last Name"
              value={lastName}
              onChange={(val) => {
                setLastName(val);
                if (nameErrors.lastName) {
                  setNameErrors((prev) => ({ ...prev, lastName: validateName(val, 'Representative last name').error }));
                }
              }}
              onBlur={() => {
                setNameErrors((prev) => ({ ...prev, lastName: validateName(lastName, 'Representative last name').error }));
              }}
              error={nameErrors.lastName}
              placeholder="e.g. Vance"
              autoComplete="family-name"
              required
              icon={<User className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Business / Brand Name *</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Industry Category</label>
              <input
                type="text"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                placeholder="e.g. Event Staffing, Warehouse Logistics"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Business Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell workers about your operations, work culture, and event expectations..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Headquarters / Main Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                placeholder="e.g. 450 Lexington Ave, New York, NY"
                className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleUseBrowserGPS} leftIcon={<Navigation className="w-3.5 h-3.5" />}>
                GPS
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Public Contact Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={publicEmail}
                onChange={(e) => setPublicEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Website URL</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end pt-2">
          <Button type="submit" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
            Save Business Profile
          </Button>
        </div>
      </form>
      <AccountDeletionSection />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Tag,
  Sliders,
  MapPin,
  Megaphone
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminSettingsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Form states
  const [maxHourlyRate, setMaxHourlyRate] = useState<number>(5000);
  const [maxShiftRate, setMaxShiftRate] = useState<number>(20000);
  const [bannerEnabled, setBannerEnabled] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<string>('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      if (res.data?.success) {
        const s = res.data.settings;
        setSettings(s);
        setMaxHourlyRate(s.moderationRules?.maxHourlyRateINR || 5000);
        setMaxShiftRate(s.moderationRules?.maxPerShiftRateINR || 20000);
        setBannerEnabled(s.platformBanner?.enabled || false);
        setBannerMessage(s.platformBanner?.message || '');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch platform settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveModeration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey('moderationRules');
    try {
      const res = await api.patch('/admin/settings', {
        key: 'moderationRules',
        value: {
          ...settings.moderationRules,
          maxHourlyRateINR: Number(maxHourlyRate),
          maxPerShiftRateINR: Number(maxShiftRate)
        },
        description: 'Updated rate anomaly thresholds'
      });
      if (res.data?.success) {
        success('Wage moderation settings updated.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update settings.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey('platformBanner');
    try {
      const res = await api.patch('/admin/settings', {
        key: 'platformBanner',
        value: {
          enabled: bannerEnabled,
          message: bannerMessage.trim(),
          type: 'info'
        },
        description: 'Updated platform announcement banner'
      });
      if (res.data?.success) {
        success('Platform announcement banner updated.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update settings.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading && !settings) {
    return <LoadingSkeleton rows={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Platform Configuration & Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure marketplace rules, wage guardrails, and announcements. Sensitive secrets are protected.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wage Moderation Limits */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary-600" />
            <h2 className="text-sm font-bold text-slate-900">Wage Guardrails & Rate Verification</h2>
          </div>
          <p className="text-xs text-slate-500">
            Set anomalous wage thresholds for automated listing flags to prevent fraud.
          </p>

          <form onSubmit={handleSaveModeration} className="space-y-3 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Allowed Hourly Rate (₹ / hr)
              </label>
              <input
                type="number"
                step="100"
                min="100"
                value={maxHourlyRate}
                onChange={(e) => setMaxHourlyRate(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Allowed Shift Rate (₹ / shift)
              </label>
              <input
                type="number"
                step="500"
                min="500"
                value={maxShiftRate}
                onChange={(e) => setMaxShiftRate(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={savingKey === 'moderationRules'}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {savingKey === 'moderationRules' ? 'Saving...' : 'Save Guardrails'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Attendance Integrity Constants */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Attendance Geofence Rules</h2>
          </div>
          <p className="text-xs text-slate-500">
            WorkMatch architecture strictly mandates GPS-verified check-ins within a 200-metre radius.
          </p>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Max Geofence Radius:</span>
              <span className="font-bold text-slate-900">200 metres</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Continuous Tracking:</span>
              <span className="font-semibold text-emerald-600">Disabled (Worker Privacy)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Manual Employer Marking:</span>
              <span className="font-semibold text-slate-900">Enabled with Audit Log</span>
            </div>
          </div>
        </Card>

        {/* Global Announcement Banner */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">Marketplace Announcement Banner</h2>
          </div>
          <p className="text-xs text-slate-500">
            Broadcast platform-wide notifications (e.g. planned maintenance, festive shifts notice) to workers and employers.
          </p>

          <form onSubmit={handleSaveBanner} className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bannerEnabled"
                checked={bannerEnabled}
                onChange={(e) => setBannerEnabled(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <label htmlFor="bannerEnabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Display Announcement Banner across WorkMatch
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Announcement Message
              </label>
              <textarea
                value={bannerMessage}
                onChange={(e) => setBannerMessage(e.target.value)}
                placeholder="Enter announcement text to broadcast..."
                rows={2}
                disabled={!bannerEnabled}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={savingKey === 'platformBanner'}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {savingKey === 'platformBanner' ? 'Publishing...' : 'Publish Banner'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

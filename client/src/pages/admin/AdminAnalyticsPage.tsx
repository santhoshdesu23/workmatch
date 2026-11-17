import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Filter,
  FileSpreadsheet,
  Users,
  Briefcase,
  CalendarCheck,
  FileCheck2,
  AlertTriangle,
  ArrowDownToLine
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminAnalyticsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');
  const [exportingResource, setExportingResource] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/analytics?range=${range}`);
      if (res.data?.success) {
        setAnalytics(res.data.analytics);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const handleExportCSV = async (resource: string) => {
    setExportingResource(resource);
    try {
      const res = await api.get(`/admin/export/${resource}`, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `workmatch-${resource}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      success(`Exported ${resource} CSV successfully.`);
    } catch (err: any) {
      toastError(err.message || `Failed to export ${resource} CSV.`);
    } finally {
      setExportingResource(null);
    }
  };

  if (loading && !analytics) {
    return <LoadingSkeleton rows={5} />;
  }

  const exportOptions = [
    { id: 'users', label: 'Registered Users', icon: Users, desc: 'All worker & employer accounts, verification, and roles' },
    { id: 'jobs', label: 'Job Listings', icon: Briefcase, desc: 'All postings, wage amounts, pay basis, openings, and statuses' },
    { id: 'applications', label: 'Applications', icon: FileCheck2, desc: 'Applicant submissions, job match status, and hiring timestamps' },
    { id: 'attendance', label: 'Attendance Records', icon: CalendarCheck, desc: 'GPS check-ins, manual supervisor entries, and audit trails' },
    { id: 'reports', label: 'Trust & Safety Reports', icon: AlertTriangle, desc: 'Logged dispute tickets, categories, descriptions, and resolutions' },
    { id: 'audit-logs', label: 'Admin Activity Logs', icon: FileSpreadsheet, desc: 'Administrative actions, suspensions, and settings changes' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Marketplace Analytics & Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deep-dive operational metrics, recruitment ratios, and sanitized compliance data exports.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            {['today', '7d', '30d', '90d', 'all'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer capitalize ${
                  range === r
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'all' ? 'All Time' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CSV Export Quick Access Grid */}
      <Card className="p-5 bg-white border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary-600" />
              Compliance & Operational Data Exports (CSV)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely export data filtered by role and time range with OWASP formula injection protection.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {exportOptions.map((opt) => {
            const Icon = opt.icon;
            const isExporting = exportingResource === opt.id;

            return (
              <div
                key={opt.id}
                className="p-3.5 border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors bg-slate-50/50 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-600" />
                    <span className="font-semibold text-xs text-slate-900">{opt.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{opt.desc}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/50 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportCSV(opt.id)}
                    disabled={isExporting}
                    className="text-xs"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
                    {isExporting ? 'Generating...' : 'Export CSV'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Funnel & Ratio Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Funnel Breakdown */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Application Pipeline Funnel</h3>
          <p className="text-xs text-slate-500">Distribution of candidate applications by status</p>

          <div className="space-y-2 pt-2">
            {analytics?.applicationFunnel && Object.keys(analytics.applicationFunnel).length > 0 ? (
              Object.entries(analytics.applicationFunnel).map(([status, count]: [string, any]) => (
                <div key={status} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg text-xs">
                  <span className="font-medium text-slate-700 capitalize">{status.toLowerCase()}</span>
                  <span className="font-bold text-slate-900">{count} applications</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">No applications recorded in this period.</div>
            )}
          </div>
        </Card>

        {/* Attendance Verification Method Ratio */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Attendance Verification Distribution</h3>
          <p className="text-xs text-slate-500">Breakdown of GPS geofence checks vs supervisor manual entries</p>

          <div className="space-y-2 pt-2">
            {analytics?.attendanceOverview && Object.keys(analytics.attendanceOverview).length > 0 ? (
              Object.entries(analytics.attendanceOverview).map(([method, count]: [string, any]) => (
                <div key={method} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg text-xs">
                  <span className="font-medium text-slate-700">
                    {method === 'GPS' ? '📍 GPS Geofenced (200m)' : method === 'MANUAL' ? '✍️ Employer Manual Mark' : method}
                  </span>
                  <span className="font-bold text-slate-900">{count} records</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">No attendance recorded in this period.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

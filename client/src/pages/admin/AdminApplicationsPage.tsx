import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  TrendingUp,
  Percent,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminApplicationsPage: React.FC = () => {
  const { error: toastError } = useToast();
  const [applications, setApplications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, totalCount: 0 });

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');
      if (statusFilter) params.append('status', statusFilter);

      const [appsRes, analyticsRes] = await Promise.all([
        api.get(`/admin/applications?${params.toString()}`),
        api.get('/admin/recruitment/analytics')
      ]);

      if (appsRes.data?.success) {
        setApplications(appsRes.data.applications || []);
        setStats(appsRes.data.stats || null);
        setPagination(appsRes.data.pagination || { totalPages: 1, totalCount: 0 });
      }

      if (analyticsRes.data?.success) {
        setAnalytics(analyticsRes.data.analytics);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [page, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Applications & Recruitment Oversight
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor applicant pipelines, selection velocity, fill-rate metrics, and marketplace match efficiency.
          </p>
        </div>
        <Badge variant="slate">
          Total Applications: {pagination.totalCount}
        </Badge>
      </div>

      {/* Recruitment KPI Funnel Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Applied / In Review</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {stats?.applied || 0}
          </div>
          <span className="text-[11px] text-slate-400">Initial submissions</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Shortlisted</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {stats?.shortlisted || 0}
          </div>
          <span className="text-[11px] text-slate-400">Employer evaluated</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Selected / Hired</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {(stats?.accepted || 0) + (stats?.hired || 0)}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Confirmed candidates</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Marketplace Fill Rate</span>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {analytics?.overallFillRate || 0}%
          </div>
          <span className="text-[11px] text-slate-400">
            {analytics?.totalFilled || 0} / {analytics?.totalOpenings || 0} slots
          </span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-xs flex justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Application Statuses</option>
            <option value="APPLIED">Applied</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="ACCEPTED">Accepted / Hired</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>
      </Card>

      {/* Applications Table */}
      <Card className="bg-white border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileCheck2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No applications match criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Applicant (Worker)</th>
                  <th className="py-3 px-4">Job Title & Category</th>
                  <th className="py-3 px-4">Gross Wage & Shift</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Applied Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {applications.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{app.worker?.name || 'Worker'}</div>
                      <div className="text-[11px] text-slate-400">{app.worker?.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{app.job?.title || 'Job Listing'}</div>
                      <div className="text-[10px] text-slate-400">{app.job?.category}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        ₹{app.job?.grossPay} / {app.job?.payBasis || 'hourly'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Date: {app.job?.workStartDate ? new Date(app.job.workStartDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          app.status === 'ACCEPTED' || app.status === 'HIRED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : app.status === 'SHORTLISTED'
                            ? 'bg-blue-50 text-blue-700'
                            : app.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

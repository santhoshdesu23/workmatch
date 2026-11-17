import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminReportsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, totalCount: 0 });

  // Resolution Modal
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('resolved');
  const [substantiated, setSubstantiated] = useState(true);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const res = await api.get(`/admin/reports?${params.toString()}`);
      if (res.data?.success) {
        setReports(res.data.reports || []);
        setStats(res.data.stats || null);
        setPagination(res.data.pagination || { totalPages: 1, totalCount: 0 });
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch incident reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter, categoryFilter]);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    setIsSubmitting(true);
    try {
      const res = await api.patch(`/admin/reports/${selectedReport._id}`, {
        status: targetStatus,
        substantiated,
        resolutionNotes: resolutionNotes.trim()
      });
      if (res.data?.success) {
        success('Complaint status updated and audit log saved.');
        setSelectedReport(null);
        setResolutionNotes('');
        fetchReports();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Trust & Safety: Incident & Dispute Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Investigate wage mismatches, attendance disputes, fraudulent listings, and marketplace conduct.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="rose">
            Open Queue: {(stats?.pending || 0) + (stats?.investigating || 0)}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Pending Review</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {stats?.pending || 0}
          </div>
          <span className="text-[11px] text-slate-400">Fresh complaints</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Under Investigation</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {stats?.investigating || 0}
          </div>
          <span className="text-[11px] text-slate-400">Admin assigned</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Resolved</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {stats?.resolved || 0}
          </div>
          <span className="text-[11px] text-slate-400">Action taken</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Dismissed</span>
          <div className="text-2xl font-bold text-slate-600 mt-1">
            {stats?.dismissed || 0}
          </div>
          <span className="text-[11px] text-slate-400">Unsubstantiated</span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filters:</span>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="investigating">Investigating</option>
            <option value="action_required">Action Required</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="pay_mismatch">Wage Mismatch</option>
            <option value="scam_or_fraud">Scam or Fraud</option>
            <option value="unsafe_conditions">Unsafe Conditions</option>
            <option value="misleading_job">Misleading Job</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No incident reports found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Reporter</th>
                  <th className="py-3 px-4">Subject (User / Job)</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {reports.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{r.reporter?.name || 'Reporter'}</div>
                      <div className="text-[10px] text-slate-400">{r.reporter?.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      {r.reportedJob ? (
                        <div>
                          <span className="font-medium text-slate-900 block truncate max-w-[160px]">
                            💼 {r.reportedJob.title}
                          </span>
                        </div>
                      ) : r.reportedUser ? (
                        <div>
                          <span className="font-medium text-slate-900 block truncate max-w-[160px]">
                            👤 {r.reportedUser.name}
                          </span>
                          <span className="text-[10px] text-slate-400">{r.reportedUser.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">General platform</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 capitalize">
                        {r.category.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-[220px]">
                      <p className="truncate text-slate-600" title={r.description}>
                        {r.description}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                          r.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : r.status === 'investigating'
                            ? 'bg-blue-50 text-blue-700'
                            : r.status === 'action_required'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedReport(r);
                          setTargetStatus(r.status || 'resolved');
                          setSubstantiated(r.substantiated || false);
                          setResolutionNotes(r.resolutionNotes || '');
                        }}
                        className="text-xs px-2.5 py-1"
                      >
                        Moderate
                      </Button>
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

      {/* Moderation / Resolution Modal */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={() => setSelectedReport(null)}
          title={`Incident Investigation: ${selectedReport.category.replace(/_/g, ' ')}`}
          maxWidth="lg"
        >
          <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
            {/* Context Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reported By</span>
                  <span className="font-semibold text-slate-900">{selectedReport.reporter?.name} ({selectedReport.reporter?.email})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Subject Entity</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReport.reportedJob?.title || selectedReport.reportedUser?.name || 'Platform'}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/50">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Complaint Narrative</span>
                <p className="text-slate-700 mt-1 whitespace-pre-wrap">{selectedReport.description}</p>
              </div>
              {selectedReport.evidence && (
                <div className="pt-2 border-t border-slate-200/50">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Submitted Evidence</span>
                  <p className="text-slate-700 mt-1 font-mono text-[11px] bg-white p-2 rounded border border-slate-200">{selectedReport.evidence}</p>
                </div>
              )}
            </div>

            {/* Workflow Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Investigation Workflow Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
                >
                  <option value="investigating">Under Investigation</option>
                  <option value="action_required">Action Required</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed (No Action)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Substantiated Incident?
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="substantiated"
                    checked={substantiated}
                    onChange={(e) => setSubstantiated(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <label htmlFor="substantiated" className="text-xs text-slate-700 cursor-pointer">
                    Flag as validated violation
                  </label>
                </div>
              </div>
            </div>

            {/* Resolution Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolution Findings & Internal Notes
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Record investigation findings, employer response, wage adjustments made..."
                rows={3}
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Update Investigation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

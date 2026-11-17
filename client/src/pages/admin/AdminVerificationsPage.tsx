import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Eye,
  Mail,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminVerificationsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [verifications, setVerifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, totalCount: 0 });

  // Review Modal state
  const [reviewingItem, setReviewingItem] = useState<any | null>(null);
  const [targetStatus, setTargetStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/admin/verifications?${params.toString()}`);
      if (res.data?.success) {
        setVerifications(res.data.verifications || []);
        setStats(res.data.stats || null);
        setPagination(res.data.pagination || { totalPages: 1, totalCount: 0 });
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch verification requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [page, statusFilter]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;

    if (targetStatus === 'rejected' && !reviewNotes.trim()) {
      toastError('A reason must be stated when rejecting verification.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.patch(`/admin/verifications/${reviewingItem._id}`, {
        status: targetStatus,
        reviewNotes: reviewNotes.trim()
      });
      if (res.data?.success) {
        success(`Verification request marked as ${targetStatus}.`);
        setReviewingItem(null);
        setReviewNotes('');
        fetchVerifications();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to submit verification review.');
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
            Trust & Identity Verification Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit user authenticity requests, approve verified badges, and record rejection rationales.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="amber">
            Pending Queue: {stats?.pending || 0}
          </Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-xs flex items-center justify-between">
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
            <option value="">All Verification Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved / Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : verifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No verification requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Applicant User</th>
                  <th className="py-3 px-4">Verification Type</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Submission Date</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {verifications.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{v.user?.name || 'User'}</div>
                      <div className="text-[11px] text-slate-400">{v.user?.email}</div>
                    </td>

                    <td className="py-3 px-4 capitalize font-medium text-slate-800">
                      {v.type || 'Identity & Profile'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          v.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : v.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}
                    </td>

                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      {v.reviewedBy?.name ? (
                        <div>
                          <span>{v.reviewedBy.name}</span>
                          <span className="block text-[10px] text-slate-400">
                            {v.reviewedAt ? new Date(v.reviewedAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {v.status === 'pending' ? (
                        <div className="space-x-1.5">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setReviewingItem(v);
                              setTargetStatus('approved');
                            }}
                            className="text-xs px-2.5 py-1"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setReviewingItem(v);
                              setTargetStatus('rejected');
                            }}
                            className="text-xs px-2.5 py-1"
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewingItem(v);
                            setTargetStatus(v.status === 'approved' ? 'rejected' : 'approved');
                          }}
                          className="text-xs px-2.5 py-1"
                        >
                          Modify
                        </Button>
                      )}
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

      {/* Review Modal */}
      {reviewingItem && (
        <Modal
          isOpen={Boolean(reviewingItem)}
          onClose={() => setReviewingItem(null)}
          title={`Review Verification: ${reviewingItem.user?.name}`}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Decision Outcome
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as any)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
              >
                <option value="approved">Approve & Grant Verified Badge</option>
                <option value="rejected">Reject Verification Request</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Review Notes / Feedback {targetStatus === 'rejected' && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={targetStatus === 'rejected' ? 'Provide mandatory explanation for rejection...' : 'Optional notes...'}
                rows={3}
                required={targetStatus === 'rejected'}
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setReviewingItem(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={targetStatus === 'approved' ? 'primary' : 'danger'}
                size="sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Recording...' : `Confirm ${targetStatus === 'approved' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

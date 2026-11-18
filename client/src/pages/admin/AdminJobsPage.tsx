import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  MapPin,
  Calendar,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Building2
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatPayWithBasis, formatEstimatedTotal } from '../../utils/currency';

export const AdminJobsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const { success, error: toastError } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentBasisFilter, setPaymentBasisFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, totalCount: 0 });

  // Job Details Modal
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [jobDetails, setJobDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Moderation Modal
  const [moderatingJob, setModeratingJob] = useState<any | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('SUSPENDED');
  const [moderationReason, setModerationReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus && urlStatus !== statusFilter) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (paymentBasisFilter) params.append('paymentBasis', paymentBasisFilter);

      const res = await api.get(`/admin/jobs?${params.toString()}`);
      if (res.data?.success) {
        setJobs(res.data.jobs || []);
        setPagination(res.data.pagination || { totalPages: 1, totalCount: 0 });
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter, categoryFilter, paymentBasisFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const handleOpenDetails = async (job: any) => {
    setSelectedJob(job);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/admin/jobs/${job._id}`);
      if (res.data?.success) {
        setJobDetails(res.data);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch job details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleModerationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moderatingJob) return;
    if (!moderationReason.trim()) {
      toastError('A mandatory moderation reason must be recorded.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.patch(`/admin/jobs/${moderatingJob._id}/status`, {
        status: targetStatus,
        reason: moderationReason.trim()
      });
      if (res.data?.success) {
        success(`Job status updated to ${targetStatus}.`);
        setModeratingJob(null);
        setModerationReason('');
        fetchJobs();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update job status.');
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
            Job Posting & Moderation Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit temporary assignments, verify wage transparency, and moderate flagged shift postings.
          </p>
        </div>
        <Badge variant="slate">
          Total Jobs: {pagination.totalCount}
        </Badge>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search job title, category or employer..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open / Active</option>
              <option value="FILLED">Filled</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="Catering and Events">Catering & Events</option>
              <option value="Hospitality & Waitstaff">Hospitality</option>
              <option value="Retail & Cashier">Retail</option>
              <option value="Warehouse & Packing">Warehouse</option>
              <option value="Delivery & Logistics">Delivery</option>
              <option value="Cleaning & Maintenance">Cleaning</option>
            </select>

            <select
              value={paymentBasisFilter}
              onChange={(e) => {
                setPaymentBasisFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Pay Bases</option>
              <option value="hourly">Hourly</option>
              <option value="shift">Per Shift (Flat)</option>
              <option value="daily">Daily</option>
            </select>

            <Button type="submit" size="sm" className="text-xs">
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Jobs Table */}
      <Card className="bg-white border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No job listings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Job Title & Category</th>
                  <th className="py-3 px-4">Employer</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Rate & Estimate</th>
                  <th className="py-3 px-4">Staffing Ratio</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {jobs.filter((j) => Boolean(j && j._id)).map((j) => {
                  const payText = formatPayWithBasis(j.grossPay, j.payBasis);
                  const totalEst = formatEstimatedTotal(j.grossPay, j.payBasis, j.totalHours || 8);

                  return (
                    <tr key={j._id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Job Title */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{j.title || 'Untitled Shift'}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700">
                            {j.category || 'General'}
                          </span>
                          <span>• {j.workStartDate ? new Date(j.workStartDate).toLocaleDateString() : 'Flexible'}</span>
                        </div>
                      </td>

                      {/* Employer */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium text-slate-900 truncate max-w-[150px]">
                          {j.employer?.name || 'Verified Employer'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {j.employer?.email}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {j.location?.city || j.locationName || 'Local'}
                          </span>
                        </div>
                      </td>

                      {/* Rate and Correct Pricing Math */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{payText}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Est: <span className="font-medium text-slate-700">{totalEst}</span>
                        </div>
                      </td>

                      {/* Staffing Ratio */}
                      <td className="py-3 px-4">
                        <div className="text-xs font-semibold text-slate-800">
                          {j.filledCount || 0} / {j.openings || 1} filled
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {j.totalApplications || 0} applicants
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            j.status === 'OPEN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : j.status === 'FILLED'
                              ? 'bg-blue-50 text-blue-700'
                              : j.status === 'SUSPENDED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetails(j)}
                          className="text-xs px-2.5 py-1"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View
                        </Button>

                        <Button
                          size="sm"
                          variant={j.status === 'SUSPENDED' ? 'outline' : 'danger'}
                          onClick={() => {
                            setModeratingJob(j);
                            setTargetStatus(j.status === 'SUSPENDED' ? 'OPEN' : 'SUSPENDED');
                          }}
                          className="text-xs px-2.5 py-1"
                        >
                          {j.status === 'SUSPENDED' ? 'Restore' : 'Suspend'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} jobs)
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

      {/* Job Details Modal */}
      {selectedJob && (
        <Modal
          isOpen={Boolean(selectedJob)}
          onClose={() => {
            setSelectedJob(null);
            setJobDetails(null);
          }}
          title={`Job Details: ${selectedJob?.title || 'Shift Listing'}`}
          maxWidth="lg"
        >
          {loadingDetails ? (
            <LoadingSkeleton rows={4} />
          ) : jobDetails ? (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Category</span>
                    <span className="font-semibold text-slate-900">{jobDetails.job?.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                    <span className="font-semibold text-slate-900">{jobDetails.job?.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employer</span>
                    <span className="font-semibold text-slate-900">{jobDetails.job?.employer?.name} ({jobDetails.job?.employer?.email})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Venue / Address</span>
                    <span className="font-semibold text-slate-900">{jobDetails.job?.locationName || jobDetails.job?.location?.city || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pay Structure</span>
                    <span className="font-semibold text-slate-900">
                      {formatPayWithBasis(jobDetails.job?.grossPay, jobDetails.job?.payBasis)} • Total: {formatEstimatedTotal(jobDetails.job?.grossPay, jobDetails.job?.payBasis, jobDetails.job?.totalHours || 8)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Headcount & Filled</span>
                    <span className="font-semibold text-slate-900">
                      {jobDetails.job?.filledCount || 0} / {jobDetails.job?.openings || 1} ({jobDetails.applications?.length || 0} total applicants)
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/50">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Description</span>
                  <p className="text-slate-700 mt-1 whitespace-pre-wrap">{jobDetails.job?.description}</p>
                </div>
              </div>

              {/* Reports On Job */}
              {jobDetails.reports && jobDetails.reports.length > 0 && (
                <div className="p-3 border border-rose-200 bg-rose-50/50 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reports Logged Against this Listing ({jobDetails.reports.length})</span>
                  </div>
                  <div className="space-y-1">
                    {jobDetails.reports.map((r: any) => (
                      <div key={r._id} className="text-[11px] text-rose-900 bg-white p-2 rounded border border-rose-100">
                        <span className="font-semibold capitalize">{r.category.replace(/_/g, ' ')}</span>: {r.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Modal>
      )}

      {/* Moderation Modal */}
      {moderatingJob && (
        <Modal
          isOpen={Boolean(moderatingJob)}
          onClose={() => setModeratingJob(null)}
          title={`Job Moderation: ${moderatingJob?.title || 'Shift Listing'}`}
        >
          <form onSubmit={handleModerationSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Listing Moderation Policy</p>
                <p className="mt-0.5">
                  Suspending this job posting hides it from worker recommendations and job discovery immediately. Original records are preserved.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Moderation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                placeholder="State the reason (e.g. misleading wage terms, safety concern, duplicate)..."
                rows={3}
                required
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setModeratingJob(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={targetStatus === 'SUSPENDED' ? 'danger' : 'primary'}
                size="sm"
                disabled={isSubmitting || !moderationReason.trim()}
              >
                {isSubmitting ? 'Recording...' : `Confirm ${targetStatus === 'SUSPENDED' ? 'Suspension' : 'Restoration'}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

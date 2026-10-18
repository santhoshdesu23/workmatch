import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Calendar,
  Clock,
  DollarSign,
  PlusCircle,
  AlertTriangle,
  ArrowRight,
  Edit3,
  History,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Job } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const EmployerJobsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Cancellation Modal state
  const [cancellingJob, setCancellingJob] = useState<Job | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Edit Shift Modal state
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocationName, setEditLocationName] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editGrossPay, setEditGrossPay] = useState<number>(0);
  const [editOpenings, setEditOpenings] = useState<number>(1);
  const [editReason, setEditReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/employers/me/jobs');
      if (res.data?.success) {
        setJobs(res.data.jobs || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setEditTitle(job.title);
    setEditDescription(job.description);
    setEditLocationName(job.locationName);
    setEditStartTime(job.startTime);
    setEditEndTime(job.endTime);
    setEditGrossPay(job.grossPay);
    setEditOpenings(job.openings);
    setEditReason('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    if (editGrossPay <= 0) {
      toastError('Gross pay must be greater than $0.');
      return;
    }

    if (editOpenings < editingJob.filledCount) {
      toastError(`Cannot reduce openings below ${editingJob.filledCount} already hired candidates.`);
      return;
    }

    setIsUpdating(true);
    try {
      const res = await api.patch(`/jobs/${editingJob._id}`, {
        title: editTitle,
        description: editDescription,
        locationName: editLocationName,
        startTime: editStartTime,
        endTime: editEndTime,
        grossPay: editGrossPay,
        openings: editOpenings,
        reason: editReason
      });

      if (res.data?.success) {
        success('Shift details updated. Changes recorded in public history.');
        setEditingJob(null);
        fetchJobs();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update shift.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingJob) return;

    setIsCancelling(true);
    try {
      const res = await api.post(`/jobs/${cancellingJob._id}/cancel`, {
        reason: cancelReason || 'Cancelled by employer'
      });
      if (res.data?.success) {
        success('Job cancelled. Applicants have been notified.');
        setCancellingJob(null);
        setCancelReason('');
        fetchJobs();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Shift Postings</h1>
          <p className="text-xs text-slate-500">
            View applications, candidate match scores, and track changes under TrustTrack.
          </p>
        </div>

        <Link to="/employer/jobs/create">
          <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
            Post New Shift
          </Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No shifts published yet"
          description="Create your first temporary job posting to start receiving worker applications."
          actionText="Create a Shift"
          onAction={() => (window.location.href = '/employer/jobs/create')}
        />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job._id} className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="emerald" size="sm">{job.category}</Badge>
                    <Badge
                      variant={
                        job.status === 'OPEN'
                          ? 'blue'
                          : job.status === 'FILLED'
                          ? 'emerald'
                          : 'slate'
                      }
                      size="sm"
                    >
                      {job.status}
                    </Badge>
                    {job.detailsConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Confirmed Details
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{job.title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(job.workDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.startTime} – {job.endTime} ({job.totalHours} hrs)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Hired: {job.filledCount} of {job.openings} ({job.openings - job.filledCount} slots open)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Pay & Candidate Actions */}
                <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-xl font-black text-slate-900">
                    ${job.grossPay} <span className="text-xs font-normal text-slate-500">/{job.payBasis}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/jobs/${job._id}`} target="_blank">
                      <Button size="sm" variant="outline">
                        View Public Listing
                      </Button>
                    </Link>

                    <Link to={`/employer/jobs/${job._id}/applicants`}>
                      <Button size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Applicants ({job.applicationsCount || 0})
                      </Button>
                    </Link>

                    {job.status === 'OPEN' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(job)}
                          leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                        >
                          Edit Shift
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => setCancellingJob(job)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Shift Modal */}
      <Modal
        isOpen={Boolean(editingJob)}
        onClose={() => setEditingJob(null)}
        title="Edit Shift Details"
        subtitle={editingJob ? `TrustTrack Audited Editing: ${editingJob.title}` : ''}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              TrustTrack Traceability Notice:
            </span>
            <span>
              Material revisions to pay, shift hours, openings, or location are permanently recorded in the public shift history timeline, and current applicants are notified immediately.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Title</label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location Address</label>
            <input
              type="text"
              required
              value={editLocationName}
              onChange={(e) => setEditLocationName(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
              <input
                type="time"
                required
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Offered Pay ($)</label>
              <input
                type="number"
                min="1"
                required
                value={editGrossPay}
                onChange={(e) => setEditGrossPay(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Openings</label>
              <input
                type="number"
                min={editingJob?.filledCount || 1}
                required
                value={editOpenings}
                onChange={(e) => setEditOpenings(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Duties</label>
            <textarea
              rows={3}
              required
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Change (Shared with Applicants)
            </label>
            <textarea
              rows={2}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Shift start delayed by 30 mins to align with banquet prep; hourly pay increased."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditingJob(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isUpdating}>
              Save & Notify Applicants
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Job Modal */}
      <Modal
        isOpen={Boolean(cancellingJob)}
        onClose={() => setCancellingJob(null)}
        title="Cancel Job Posting"
        subtitle={cancellingJob ? cancellingJob.title : ''}
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              Cancelling will close this opening and notify any applicants or confirmed workers immediately.
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Reason for Cancellation</label>
            <textarea
              rows={3}
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Event cancelled by client, venue changes..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setCancellingJob(null)}>
              Dismiss
            </Button>
            <Button variant="danger" size="sm" type="submit" isLoading={isCancelling}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

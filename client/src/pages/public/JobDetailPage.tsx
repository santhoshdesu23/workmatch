import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Users,
  Sparkles,
  ChevronLeft,
  CheckCircle2,
  Flag,
  Send,
  Building2,
  Bookmark,
  Mail,
  RefreshCw,
  History,
  HelpCircle,
  AlertTriangle,
  CheckCheck,
  Info
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Job, JobChangeHistoryItem, EmployerReliability } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { formatPayWithBasis, formatINR } from '../../utils/currency';
import { Modal } from '../../components/common/Modal';
import { ScoreBreakdown } from '../../components/common/ScoreBreakdown';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Application Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Reconfirm interest state
  const [isReconfirming, setIsReconfirming] = useState(false);

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('pay_mismatch');
  const [reportDescription, setReportDescription] = useState('');
  const [reportEvidence, setReportEvidence] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccessFeedback, setReportSuccessFeedback] = useState(false);

  // Reliability Explanations Modal
  const [isReliabilityModalOpen, setIsReliabilityModalOpen] = useState(false);

  // Job Change History state
  const [changeHistory, setChangeHistory] = useState<JobChangeHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Email verification resend state
  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [resendVerifySent, setResendVerifySent] = useState(false);

  const handleResendVerification = async () => {
    setIsResendingVerify(true);
    try {
      const res = await api.post('/auth/resend-verification');
      if (res.data?.success) {
        setResendVerifySent(true);
        success('Verification email dispatched! Please check your inbox.');
      } else {
        toastError(res.data?.message || 'Failed to dispatch verification email.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to dispatch verification email.');
    } finally {
      setIsResendingVerify(false);
    }
  };

  const fetchJob = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/jobs/${jobId}`);
      if (res.data?.success) {
        setJob(res.data.job);
      }
    } catch (err: any) {
      toastError(err.message || 'Job posting not found.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (changeHistory.length > 0) {
      setShowHistory(!showHistory);
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await api.get(`/jobs/${jobId}/history`);
      if (res.data?.success) {
        setChangeHistory(res.data.history || []);
        setShowHistory(true);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to load revision history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (jobId) fetchJob();
  }, [jobId]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      info('Please log in or register as a worker to apply.');
      navigate('/login');
      return;
    }

    if (user.role !== 'worker') {
      toastError('Only worker accounts may apply to jobs.');
      return;
    }

    if (!user.emailVerified) {
      toastError('Email verification is required before you can apply to shifts. Please verify your email address.');
      return;
    }

    setIsApplying(true);
    try {
      const res = await api.post(`/jobs/${jobId}/apply`, { message: applyMessage });
      if (res.data?.success) {
        success('Your application was voluntarily submitted to the employer!');
        setIsApplyModalOpen(false);
        fetchJob();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleReconfirmInterest = async () => {
    if (!job?.userApplication?._id) return;
    setIsReconfirming(true);
    try {
      const res = await api.post(`/applications/${job.userApplication._id}/reconfirm`);
      if (res.data?.success) {
        success('You have successfully reconfirmed your interest in the updated shift terms.');
        fetchJob();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to reconfirm interest.');
    } finally {
      setIsReconfirming(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      info('Please log in to submit an incident report.');
      navigate('/login');
      return;
    }

    setIsReporting(true);
    try {
      const res = await api.post('/reports', {
        reportedJob: jobId,
        category: reportCategory,
        description: reportDescription,
        evidence: reportEvidence
      });
      if (res.data?.success) {
        setReportSuccessFeedback(true);
        success('Discrepancy report recorded and routed to Trust & Safety moderation.');
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsReporting(false);
    }
  };

  const handleToggleSave = async () => {
    if (!user || user.role !== 'worker') {
      info('Please log in as a worker to bookmark jobs.');
      return;
    }

    try {
      const res = await api.post(`/jobs/${jobId}/save`);
      if (res.data?.success) {
        success(res.data.message);
        setJob((prev) => (prev ? { ...prev, isSaved: res.data.isSaved } : prev));
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Job Posting Not Found</h2>
        <p className="text-sm text-slate-500">This temporary shift may have closed or expired.</p>
        <Link to="/jobs">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Job Discovery
          </Button>
        </Link>
      </div>
    );
  }

  const isDeadlinePassed = new Date(job.applicationDeadline) < new Date();
  const isFilled = job.filledCount >= job.openings;

  const reliability: EmployerReliability | undefined = job.employerReliability;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link to="/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ChevronLeft className="w-4 h-4" /> Back to open shifts
        </Link>
      </div>

      {/* Header Banner */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="emerald">{job.category}</Badge>
              <Badge variant={job.status === 'OPEN' ? 'blue' : 'slate'}>{job.status}</Badge>

              {/* TrustTrack Confirmation Badge */}
              {job.detailsConfirmed ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Employer-Confirmed Listing
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                  Standard Listing
                </span>
              )}

              {job.isDemo && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full">
                  DEMO / SAMPLE SHIFT
                </span>
              )}

              {/* Distinction between Identity Verification and Listing Confirmation */}
              {job.employerProfile?.verificationStatus === 'verified' && (
                <Badge variant="blue">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Verified Business Identity
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {job.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800 break-words" title={job.employerProfile?.businessName || job.employer?.name}>
                {job.employerProfile?.businessName || job.employer?.name}
              </span>
              {job.employerProfile?.rating && (
                <span className="text-xs text-amber-600 font-bold ml-1">
                  ★ {job.employerProfile.rating.average} ({job.employerProfile.rating.count} reviews)
                </span>
              )}
            </div>
          </div>

          {/* Pay Display */}
          <div className="sm:text-right bg-slate-50 sm:bg-transparent p-4 sm:p-0 rounded-xl border sm:border-0 border-slate-100 w-full sm:w-auto">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {formatPayWithBasis(job.grossPay, job.payBasis)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Estimated Total: {formatINR(job.grossPay * job.totalHours)} ({job.totalHours} hrs)
            </p>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {job.userApplication ? (
              <div className="p-2.5 px-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-600" />
                <span>You applied for this shift (Status: {job.userApplication.status})</span>
              </div>
            ) : isFilled ? (
              <div className="p-2.5 px-4 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">
                All openings for this shift are filled
              </div>
            ) : isDeadlinePassed ? (
              <div className="p-2.5 px-4 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">
                Application deadline has expired
              </div>
            ) : (
              <Button
                onClick={() => {
                  if (!user) navigate('/login');
                  else setIsApplyModalOpen(true);
                }}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Apply Voluntarily Now
              </Button>
            )}

            {user?.role === 'worker' && (
              <button
                onClick={handleToggleSave}
                className={`p-2.5 rounded-xl border cursor-pointer ${
                  job.isSaved
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
                aria-label="Bookmark"
              >
                <Bookmark className={`w-4 h-4 ${job.isSaved ? 'fill-amber-500' : ''}`} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Revision history button */}
            <button
              onClick={fetchHistory}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Revision History {job.changeHistoryCount ? `(${job.changeHistoryCount})` : ''}</span>
            </button>

            {/* Report mismatch button */}
            <button
              onClick={() => {
                setReportSuccessFeedback(false);
                setIsReportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              Report Discrepancy
            </button>
          </div>
        </div>
      </Card>

      {/* Applicant Alert Banner: Material Changes after application */}
      {job.userApplication && job.changeHistoryCount && job.changeHistoryCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block">Important: Shift Details Were Updated by Employer</span>
              <span>The employer made changes to this shift listing after your application. Please review the updated terms.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={fetchHistory}
              leftIcon={<History className="w-3.5 h-3.5" />}
            >
              View Changes
            </Button>
            {job.userApplication.status !== 'WITHDRAWN' && job.userApplication.status !== 'CANCELLED' && (
              <Button
                size="sm"
                onClick={handleReconfirmInterest}
                isLoading={isReconfirming}
                leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
              >
                Reconfirm Interest
              </Button>
            )}
          </div>
        </div>
      )}

      {/* TrustTrack Confirmed Commitments Card */}
      <Card className="p-5 sm:p-6 bg-gradient-to-r from-emerald-50/50 via-white to-sky-50/50 border-emerald-100">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
              TT
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                WorkMatch TrustTrack Verified Commitments
              </h2>
              <p className="text-[11px] text-slate-500">
                Transparent and binding shift commitments backed by immutable platform audit logs.
              </p>
            </div>
          </div>
          {job.detailsConfirmedAt && (
            <span className="text-[11px] text-slate-400">
              Confirmed on {new Date(job.detailsConfirmedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/80 border border-slate-100 shadow-xs">
            <span className="text-slate-400 block text-[11px] mb-0.5">Guaranteed Rate</span>
            <span className="font-extrabold text-emerald-800">{formatPayWithBasis(job.grossPay, job.payBasis)}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">No hidden commission cuts</span>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-slate-100 shadow-xs">
            <span className="text-slate-400 block text-[11px] mb-0.5">Payout Timeline</span>
            <span className="font-bold text-slate-800">{job.paymentTiming}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">{job.paymentMethod}</span>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-slate-100 shadow-xs">
            <span className="text-slate-400 block text-[11px] mb-0.5">Shift Window</span>
            <span className="font-bold text-slate-800">{job.startTime} – {job.endTime}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">{job.totalHours} hrs ({job.breakDurationMinutes}m break)</span>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-slate-100 shadow-xs">
            <span className="text-slate-400 block text-[11px] mb-0.5">Change Policy</span>
            <span className="font-bold text-slate-800">Traceable History</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">Applicants notified on edits</span>
          </div>
        </div>
      </Card>

      {/* Revision History Timeline Accordion */}
      {showHistory && (
        <Card className="p-6 space-y-4 border-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Auditable Job Change Timeline ({changeHistory.length})
              </h3>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Close
            </button>
          </div>

          {loadingHistory ? (
            <LoadingSkeleton rows={2} />
          ) : changeHistory.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
              Original Listing — No revisions recorded since publication.
            </div>
          ) : (
            <div className="space-y-3">
              {changeHistory.map((entry, idx) => (
                <div key={entry._id || idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.isMaterial ? 'amber' : 'slate'} size="sm">
                        {entry.isMaterial ? 'Material Revision' : 'Minor Update'}
                      </Badge>
                      <span className="font-semibold text-slate-800">
                        Updated by {entry.actor?.name || 'Employer'} ({entry.actorRole})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {entry.reason && (
                    <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-100">
                      "{entry.reason}"
                    </p>
                  )}

                  <div className="space-y-1.5 pt-1">
                    {entry.changes.map((c, cIdx) => (
                      <div key={cIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-1 p-2 rounded-lg bg-white border border-slate-100 text-[11px]">
                        <span className="font-semibold text-slate-700 capitalize">{c.field}</span>
                        <span className="text-rose-600 line-through">
                          {typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue) : String(c.oldValue ?? 'None')}
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          &rarr; {typeof c.newValue === 'object' ? JSON.stringify(c.newValue) : String(c.newValue ?? 'None')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Two Column Layout: Details & Match Engine / Reliability */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Full Job Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Specifications Grid */}
          <Card className="p-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Shift Details & Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">Shift Date</span>
                  <span className="text-slate-600">
                    {new Date(job.workDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">Working Hours</span>
                  <span className="text-slate-600">
                    {job.startTime} – {job.endTime} ({job.totalHours} hours total)
                  </span>
                  <span className="text-slate-400 block mt-0.5">Break: {job.breakDurationMinutes} mins</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">Work Location</span>
                  <span className="text-slate-600">{job.locationName}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Users className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">Capacity & Openings</span>
                  <span className="text-slate-600">
                    {job.openings - job.filledCount} open ({job.filledCount} of {job.openings} filled)
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card className="p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Role Description</h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </Card>

          {/* Requirements & Terms */}
          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Requirements & Policies</h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-900 block mb-1">Required Skills:</span>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((sk) => (
                    <span key={sk} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-slate-900 block mb-0.5">Experience:</span>
                  <span className="text-slate-600">{job.experienceRequirement}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-slate-900 block mb-0.5">Dress Code:</span>
                  <span className="text-slate-600">{job.dressCode}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-slate-900 block mb-0.5">Physical Demands:</span>
                  <span className="text-slate-600">{job.physicalRequirements}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-slate-900 block mb-0.5">Age Restriction:</span>
                  <span className="text-slate-600">{job.ageRestriction}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-slate-700 space-y-1 mt-2">
                <span className="font-semibold text-amber-900 block">Cancellation Policy:</span>
                <p className="text-[11px] leading-relaxed">{job.cancellationPolicy}</p>
              </div>
            </div>
          </Card>

          {/* Payment Terms */}
          <Card className="p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Payment Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500 block">Payment Method</span>
                <span className="font-semibold text-slate-900">{job.paymentMethod}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500 block">Payment Timing</span>
                <span className="font-semibold text-slate-900">{job.paymentTiming}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              * Payment is recorded in platform ledgers. Both worker and employer confirm shift completion upon checkout.
            </p>
          </Card>
        </div>

        {/* Right Column: AI Match Engine & Evidence-Based Employer Reliability */}
        <div className="space-y-6">
          {/* Evidence-Based Employer Reliability Card */}
          <Card className="p-5 space-y-4 border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Employer Reliability
                </h3>
              </div>
              <button
                onClick={() => setIsReliabilityModalOpen(true)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Reliability explanation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            {reliability ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block text-[10px] uppercase">Completion Rate</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {reliability.hasSufficientHistory
                        ? `${reliability.metrics.completionRate}%`
                        : '—'}
                    </span>
                    {!reliability.hasSufficientHistory && (
                      <span className="block text-[10px] text-slate-400">Not enough history yet</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block text-[10px] uppercase">Finished Shifts</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {reliability.metrics.completedAssignments}
                    </span>
                    <span className="block text-[10px] text-slate-400">Verified completions</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-100 text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>Employer Cancellations:</span>
                    <span className="font-semibold text-slate-800">
                      {reliability.metrics.employerCancellations}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Substantiated Discrepancies:</span>
                    <span className={`font-semibold ${reliability.metrics.substantiatedMismatches > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {reliability.metrics.substantiatedMismatches} substantiated
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Worker Shift Ratings:</span>
                    <span className="font-semibold text-amber-600">
                      ★ {reliability.metrics.ratingAverage || '—'} ({reliability.metrics.ratingCount} reviews)
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span>Identity Status:</span>
                    <Badge variant={reliability.identityVerificationStatus === 'verified' ? 'emerald' : 'slate'} size="sm">
                      {reliability.identityVerificationStatus}
                    </Badge>
                  </div>
                </div>

                <button
                  onClick={() => setIsReliabilityModalOpen(true)}
                  className="w-full text-center text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer pt-1"
                >
                  How are these metrics calculated? &rarr;
                </button>
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                Reliability metrics are being aggregated from persisted shifts.
              </div>
            )}
          </Card>

          {/* AI Match Breakdown */}
          {job.matchData ? (
            <ScoreBreakdown matchData={job.matchData} />
          ) : (
            <Card className="p-5 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Want to see AI Match Details?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Log in as a worker to view personalized 5-factor compatibility scores and travel distance calculations.
              </p>
              <Link to="/login">
                <Button variant="outline" size="sm" className="w-full">
                  Log In as Worker
                </Button>
              </Link>
            </Card>
          )}

          {/* Employer Card */}
          {job.employerProfile && (
            <Card className="p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">About Employer</h3>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{job.employerProfile.businessName}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{job.employerProfile.description}</p>
              </div>

              {job.employerProfile.businessAddress && (
                <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{job.employerProfile.businessAddress}</span>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Reliability Metrics Explanation Modal */}
      <Modal
        isOpen={isReliabilityModalOpen}
        onClose={() => setIsReliabilityModalOpen(false)}
        title="Evidence-Based Employer Reliability"
        subtitle="Transparent, factual marketplace governance metrics"
      >
        <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-950 space-y-1">
            <span className="font-bold block">TrustTrack Governance Principle:</span>
            <span>Every reliability metric is derived directly from immutable database records of completed shifts, substantiated investigations, and verified ratings. We never fabricate trust scores or badges.</span>
          </div>

          <div className="space-y-3">
            <div>
              <strong className="text-slate-900 block mb-0.5">1. Completion Rate:</strong>
              <p className="text-slate-600">
                The ratio of completed shift assignments to all initiated assignments. Employers with fewer than 3 assignments display <em>"Not enough history yet"</em> to prevent misleading sample bias.
              </p>
            </div>

            <div>
              <strong className="text-slate-900 block mb-0.5">2. Substantiated Discrepancies:</strong>
              <p className="text-slate-600">
                Only reports that have been formally reviewed, investigated, and substantiated by platform administrators count toward this metric. Pending, investigating, or dismissed reports are strictly excluded.
              </p>
            </div>

            <div>
              <strong className="text-slate-900 block mb-0.5">3. Verified Ratings:</strong>
              <p className="text-slate-600">
                Reviews are restricted strictly to workers who have completed confirmed shift assignments with this employer. Fake or unverified reviews cannot be submitted.
              </p>
            </div>

            <div>
              <strong className="text-slate-900 block mb-0.5">4. Identity vs. Operational Reliability:</strong>
              <p className="text-slate-600">
                Identity verification certifies business documentation and registration. It is evaluated independently from historical shift fulfillment and punctuality.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={() => setIsReliabilityModalOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      {/* Voluntary Application Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Voluntary Shift Application"
        subtitle={`Submit voluntary application for: ${job.title}`}
      >
        {user && !user.emailVerified ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <Mail className="w-4 h-4 text-amber-700" />
                <span>Email Verification Required</span>
              </div>
              <p className="leading-relaxed">
                WorkMatch requires a verified email address before you can submit applications to shifts. A verification link was sent to <strong>{user.email}</strong>.
              </p>
              {resendVerifySent ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-1.5 mt-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Fresh verification link dispatched! Please check your inbox.</span>
                </div>
              ) : (
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-900 hover:bg-amber-100"
                    onClick={handleResendVerification}
                    isLoading={isResendingVerify}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Resend Verification Link
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsApplyModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <span className="font-bold block">Voluntary Application Guarantee:</span>
              <span>You are voluntarily choosing to apply. Employer reviews and confirms candidates. Confirmed terms are protected by TrustTrack.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Personal Message to Employer (Optional)
              </label>
              <textarea
                rows={4}
                value={applyMessage}
                onChange={(e) => setApplyMessage(e.target.value)}
                placeholder="Highlight any relevant past experience, your punctuality, or why you'd be a great fit for this shift..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsApplyModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" isLoading={isApplying} leftIcon={<Send className="w-3.5 h-3.5" />}>
                Submit Application
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Incident / Discrepancy Report Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Report Job Discrepancy or Incident"
        subtitle="Submit confidential report to Trust & Safety moderation"
      >
        {reportSuccessFeedback ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Report Submitted to Trust & Safety</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Thank you for protecting the WorkMatch marketplace. Our moderation team has received your report and will thoroughly investigate any wage, schedule, or condition discrepancy.
              </p>
            </div>
            <p className="text-[11px] text-slate-400">
              * Your identity is kept confidential. Employers are never automatically penalized without substantiated administrative review.
            </p>
            <div className="pt-2">
              <Button size="sm" onClick={() => setIsReportModalOpen(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                WorkMatch TrustTrack protects workers against wage discrepancies, inaccurate hours, and unauthorized duties. Reports are confidential and reviewed by human moderators.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Discrepancy Category</label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
              >
                <option value="pay_mismatch">Pay differs from listing (Offered less / unpaid)</option>
                <option value="schedule_mismatch">Shift timing or hours differ from listing</option>
                <option value="location_mismatch">Location differs from listing address</option>
                <option value="duties_mismatch">Actual duties differ significantly from listing</option>
                <option value="unexpected_cancellation">Job cancelled unexpectedly without notice</option>
                <option value="misleading_job">Other misleading or inaccurate job details</option>
                <option value="unsafe_conditions">Unsafe work conditions</option>
                <option value="scam_or_fraud">Suspected scam, fee demand, or wage theft</option>
                <option value="other">Other concern</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">What differed from the advertised opening?</label>
              <textarea
                rows={3}
                required
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Explain the specific difference between the listing and reality..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Supporting Evidence or Notes (Optional)</label>
              <textarea
                rows={2}
                value={reportEvidence}
                onChange={(e) => setReportEvidence(e.target.value)}
                placeholder="Mention any text messages, employer statements, or shift communications..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsReportModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" type="submit" isLoading={isReporting}>
                Submit Discrepancy Report
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

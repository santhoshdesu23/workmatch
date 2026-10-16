import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  ShieldCheck,
  Users,
  AlertCircle,
  FileText,
  Shirt,
  Sparkles,
  ChevronLeft,
  CheckCircle2,
  Flag,
  Send,
  Building2,
  Bookmark,
  Mail,
  RefreshCw
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Job, Application } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
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

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('misleading_job');
  const [reportDescription, setReportDescription] = useState('');
  const [isReporting, setIsReporting] = useState(false);

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
        description: reportDescription
      });
      if (res.data?.success) {
        success('Incident report submitted to Trust & Safety moderation team.');
        setIsReportModalOpen(false);
        setReportDescription('');
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
  const canApply =
    user?.role === 'worker' &&
    !job.userApplication &&
    job.status === 'OPEN' &&
    !isDeadlinePassed &&
    !isFilled;

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
              {job.employerProfile?.verificationStatus === 'verified' && (
                <Badge variant="blue">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Verified Business
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {job.title}
            </h1>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-800">
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
              ${job.grossPay}
              <span className="text-sm font-medium text-slate-500"> / {job.payBasis}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Estimated Total: ${(job.grossPay * job.totalHours).toFixed(2)} ({job.totalHours} hrs)
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

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            Report this listing
          </button>
        </div>
      </Card>

      {/* Two Column Layout: Details & Match Engine */}
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
              * Payment is logged and monitored in platform records. Both worker and employer confirm shift completion upon checkout.
            </p>
          </Card>
        </div>

        {/* Right Column: AI Explainable Engine & Employer Info */}
        <div className="space-y-6">
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
            <span>You are voluntarily choosing to apply. Notifications will never apply for you automatically. Employer reviews and confirms candidates.</span>
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

      {/* Incident Report Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Report Job Listing"
        subtitle="Submit confidential report to Trust & Safety"
      >
        <form onSubmit={handleReportSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Reason for Report</label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
            >
              <option value="misleading_job">Misleading Job Details or Pay</option>
              <option value="scam_or_fraud">Suspected Scam or Fee Demand</option>
              <option value="unsafe_conditions">Unsafe Work Conditions</option>
              <option value="harassment">Inappropriate Conduct</option>
              <option value="other">Other Violation</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Description & Evidence</label>
            <textarea
              rows={4}
              required
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Provide specific details about what occurred..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsReportModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="submit" isLoading={isReporting}>
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

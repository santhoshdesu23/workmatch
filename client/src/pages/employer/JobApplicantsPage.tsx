import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  ChevronLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ShieldCheck,
  Building2,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Job, Application } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ScoreBreakdown } from '../../components/common/ScoreBreakdown';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { formatPayWithBasis } from '../../utils/currency';

export const JobApplicantsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { success, error: toastError } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // Offer modal state
  const [offeringApplicant, setOfferingApplicant] = useState<Application | null>(null);
  const [offerNote, setOfferNote] = useState('');
  const [isSendingOffer, setIsSendingOffer] = useState(false);

  // Inspect Score state
  const [inspectingApplicant, setInspectingApplicant] = useState<Application | null>(null);

  const fetchApplicants = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/jobs/${jobId}/applications`);
      if (res.data?.success) {
        setJob(res.data.job);
        setApplicants(res.data.applicants || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch applicants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) fetchApplicants();
  }, [jobId]);

  const handleUpdateStatus = async (applicationId: string, status: string, note = '') => {
    try {
      const res = await api.patch(`/applications/${applicationId}/status`, {
        status,
        note
      });
      if (res.data?.success) {
        success(`Applicant marked as ${status}.`);
        fetchApplicants();
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const handleSendOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offeringApplicant) return;

    setIsSendingOffer(true);
    try {
      const res = await api.patch(`/applications/${offeringApplicant._id}/status`, {
        status: 'OFFERED',
        offerDetails: { note: offerNote }
      });
      if (res.data?.success) {
        success('Formal shift offer sent to candidate!');
        setOfferingApplicant(null);
        setOfferNote('');
        fetchApplicants();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsSendingOffer(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  const remainingSlots = job ? job.openings - job.filledCount : 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link to="/employer/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ChevronLeft className="w-4 h-4" /> Back to My Job Postings
        </Link>
      </div>

      {/* Header Card */}
      <Card className="p-6 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{job?.category}</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Applicants for: {job?.title}
            </h1>
            <p className="text-xs text-slate-500">
              {job?.startTime} – {job?.endTime} • Pay: {formatPayWithBasis(job?.grossPay, job?.payBasis)}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs sm:text-right">
            <span className="text-slate-500 block">Hiring Capacity:</span>
            <span className="text-base font-extrabold text-slate-900">
              {job?.filledCount} of {job?.openings} Hired
            </span>
            <span className={`block text-[11px] font-semibold ${remainingSlots > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {remainingSlots > 0 ? `${remainingSlots} opening(s) remaining` : 'Capacity Reached'}
            </span>
          </div>
        </div>
      </Card>

      {/* Applicants List */}
      {applicants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates have applied yet"
          description="Your posting is visible to active workers in your area. Qualified workers will appear here upon voluntary application."
        />
      ) : (
        <div className="space-y-4">
          {applicants.map((app) => (
            <Card key={app._id} className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={app.status === 'HIRED' ? 'emerald' : app.status === 'SHORTLISTED' ? 'amber' : 'blue'}>
                      {app.status}
                    </Badge>
                    {app.worker?.verificationStatus === 'verified' && (
                      <Badge variant="blue" size="sm">
                        <ShieldCheck className="w-3 h-3 text-sky-600" /> Verified Worker
                      </Badge>
                    )}
                    {app.matchData && (
                      <Badge variant={app.matchData.matchScore >= 80 ? 'emerald' : 'amber'} size="sm">
                        <Sparkles className="w-3 h-3" />
                        {app.matchData.matchScore}% Match
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{app.worker?.name}</h3>
                  <div className="text-xs text-slate-500">{app.worker?.email}</div>

                  {/* Worker bio & skills */}
                  {app.workerProfile?.bio && (
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{app.workerProfile.bio}"
                    </p>
                  )}

                  {app.workerProfile?.skills && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {app.workerProfile.skills.map((sk) => (
                        <span key={sk} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Application message if any */}
                  {app.message && (
                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-slate-700 mt-2">
                      <span className="font-semibold text-emerald-900 block mb-0.5">Applicant Note:</span>
                      "{app.message}"
                    </div>
                  )}
                </div>

                {/* Candidate Action Buttons */}
                <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-2.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-[11px] text-slate-400">
                    Applied {new Date(app.createdAt).toLocaleString()}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {app.matchData && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInspectingApplicant(app)}
                        leftIcon={<Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
                      >
                        Inspect Fit
                      </Button>
                    )}

                    {app.status === 'APPLIED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(app._id, 'SHORTLISTED', 'Candidate shortlisted for review')}
                      >
                        Shortlist
                      </Button>
                    )}

                    {['APPLIED', 'SHORTLISTED'].includes(app.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOfferingApplicant(app)}
                        leftIcon={<Send className="w-3 h-3" />}
                      >
                        Send Offer
                      </Button>
                    )}

                    {app.status !== 'HIRED' && app.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        disabled={remainingSlots <= 0}
                        onClick={() => {
                          if (window.confirm(`Confirm hiring ${app.worker?.name}? This reserves 1 opening and generates shift attendance tracking.`)) {
                            handleUpdateStatus(app._id, 'HIRED', 'Confirmed hire by employer');
                          }
                        }}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        {remainingSlots <= 0 ? 'Capacity Full' : 'Confirm Hire'}
                      </Button>
                    )}

                    {app.status !== 'REJECTED' && app.status !== 'HIRED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => handleUpdateStatus(app._id, 'REJECTED', 'Position filled or candidate not selected')}
                      >
                        Reject
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Inspect AI Compatibility Modal */}
      <Modal
        isOpen={Boolean(inspectingApplicant)}
        onClose={() => setInspectingApplicant(null)}
        title="Candidate AI Compatibility Breakdown"
        subtitle={inspectingApplicant ? `${inspectingApplicant.worker?.name} • ${job?.title}` : ''}
      >
        {inspectingApplicant?.matchData && (
          <ScoreBreakdown matchData={inspectingApplicant.matchData} />
        )}
      </Modal>

      {/* Send Offer Modal */}
      <Modal
        isOpen={Boolean(offeringApplicant)}
        onClose={() => setOfferingApplicant(null)}
        title="Send Shift Offer to Candidate"
        subtitle={offeringApplicant ? offeringApplicant.worker?.name : ''}
      >
        <form onSubmit={handleSendOfferSubmit} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Sending a formal offer notifies the candidate. They will have the voluntary choice to accept or decline before the shift assignment is confirmed.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Offer Note or Briefing</label>
            <textarea
              rows={3}
              value={offerNote}
              onChange={(e) => setOfferNote(e.target.value)}
              placeholder="e.g. We are offering you the morning check-in shift. Please confirm by tonight..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOfferingApplicant(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isSendingOffer}>
              Send Formal Offer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Calendar,
  Clock,
  DollarSign,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
  ArrowRight
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Application } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const WorkerApplicationsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<Application | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/applications/me');
      if (res.data?.success) {
        setApplications(res.data.applications || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleWithdraw = async (applicationId: string) => {
    if (!window.confirm('Are you sure you want to voluntarily withdraw this application?')) return;
    try {
      const res = await api.post(`/applications/${applicationId}/withdraw`);
      if (res.data?.success) {
        success('Application withdrawn successfully.');
        fetchApplications();
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const handleRespondToOffer = async (applicationId: string, accept: boolean) => {
    try {
      const res = await api.post(`/applications/${applicationId}/respond-to-offer`, { accept });
      if (res.data?.success) {
        success(`Offer ${accept ? 'accepted' : 'declined'}.`);
        fetchApplications();
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'HIRED':
      case 'ACCEPTED':
      case 'COMPLETED':
        return 'emerald';
      case 'OFFERED':
      case 'SHORTLISTED':
        return 'amber';
      case 'APPLIED':
        return 'blue';
      case 'REJECTED':
      case 'CANCELLED':
      case 'WITHDRAWN':
        return 'rose';
      default:
        return 'slate';
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Shift Applications</h1>
        <p className="text-xs text-slate-500">
          Track employer reviews, offers, confirmations, and decision timelines.
        </p>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No applications submitted yet"
          description="Browse available one-day and short-duration shifts to apply voluntarily."
          actionText="Discover Shifts"
          onAction={() => (window.location.href = '/jobs')}
        />
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const job = typeof app.job === 'object' ? app.job : null;
            if (!job) return null;

            return (
              <Card key={app._id} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant(app.status)} size="md">
                        {app.status}
                      </Badge>
                      <span className="text-[11px] text-slate-400">
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <Link to={`/jobs/${job._id}`}>
                      <h3 className="text-base font-bold text-slate-900 hover:text-emerald-600 transition-colors">
                        {job.title}
                      </h3>
                    </Link>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.employer?.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(job.workDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.startTime} – {job.endTime}</span>
                      </div>
                    </div>

                    {app.message && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                        "{app.message}"
                      </p>
                    )}
                  </div>

                  {/* Pay & Actions */}
                  <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-lg font-black text-slate-900">
                      ${job.grossPay} <span className="text-xs font-normal text-slate-500">/{job.payBasis}</span>
                    </div>

                    {/* Action buttons depending on state */}
                    <div className="flex flex-wrap items-center gap-2">
                      {app.status === 'OFFERED' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleRespondToOffer(app._id, true)}
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Accept Offer
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRespondToOffer(app._id, false)}
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {['APPLIED', 'SHORTLISTED'].includes(app.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => handleWithdraw(app._id)}
                        >
                          Withdraw
                        </Button>
                      )}

                      <button
                        onClick={() => setSelectedHistory(app)}
                        className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Decision Timeline"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Decision Audit History Modal */}
      <Modal
        isOpen={Boolean(selectedHistory)}
        onClose={() => setSelectedHistory(null)}
        title="Application Status History"
        subtitle="Server-enforced status transition audit"
      >
        {selectedHistory && (
          <div className="space-y-4">
            <div className="space-y-3">
              {selectedHistory.decisionHistory?.map((d, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs border-l-2 border-emerald-500 pl-3 py-1">
                  <div>
                    <span className="font-bold text-slate-900 block">{d.status}</span>
                    <span className="text-slate-400 text-[11px]">{new Date(d.timestamp).toLocaleString()}</span>
                    {d.note && <p className="text-slate-600 mt-1">{d.note}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedHistory(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

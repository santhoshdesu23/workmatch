import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, User } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ReportItem } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const AdminReportsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolution Modal
  const [resolvingReport, setResolvingReport] = useState<ReportItem | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'investigating' | 'dismissed'>('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/reports');
      if (res.data?.success) {
        setReports(res.data.reports || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleResolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReport) return;

    setIsUpdating(true);
    try {
      const res = await api.patch(`/admin/reports/${resolvingReport._id}`, {
        status: resolutionStatus,
        resolutionNotes
      });
      if (res.data?.success) {
        success('Incident report resolution saved.');
        setResolvingReport(null);
        setResolutionNotes('');
        fetchReports();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trust & Safety Incident Reports</h1>
        <p className="text-xs text-slate-500">
          Review reported job listings, scam allegations, unpaid wage claims, and safety incidents.
        </p>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No incident reports"
          description="There are currently no active trust & safety reports in the moderation queue."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r._id} className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === 'pending' ? 'rose' : 'emerald'} size="sm">
                      {r.status}
                    </Badge>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {r.category}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{r.description}"
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <div>
                      Reporter: <span className="font-semibold text-slate-700">{r.reporter?.name}</span> ({r.reporter?.email})
                    </div>
                    {r.reportedJob && (
                      <div>
                        Reported Job: <span className="font-semibold text-slate-700">{r.reportedJob?.title}</span>
                      </div>
                    )}
                  </div>

                  {r.resolutionNotes && (
                    <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                      <strong>Resolution Notes:</strong> {r.resolutionNotes}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setResolvingReport(r);
                    setResolutionStatus(r.status === 'pending' ? 'resolved' : r.status as any);
                    setResolutionNotes(r.resolutionNotes || '');
                  }}
                >
                  Manage Status
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      <Modal
        isOpen={Boolean(resolvingReport)}
        onClose={() => setResolvingReport(null)}
        title="Resolve Incident Report"
        subtitle={resolvingReport ? `Category: ${resolvingReport.category}` : ''}
      >
        <form onSubmit={handleResolutionSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Action Status</label>
            <select
              value={resolutionStatus}
              onChange={(e: any) => setResolutionStatus(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="resolved">RESOLVED (Action taken)</option>
              <option value="investigating">INVESTIGATING (Under review)</option>
              <option value="dismissed">DISMISSED (No violation found)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Resolution Notes</label>
            <textarea
              rows={3}
              required
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Record official moderation findings..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setResolvingReport(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isUpdating}>
              Submit Resolution
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { BadgeCheck, ShieldCheck, CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { VerificationItem } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const AdminVerificationsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modal
  const [reviewingItem, setReviewingItem] = useState<VerificationItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/verifications');
      if (res.data?.success) {
        setVerifications(res.data.verifications || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch verification queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;

    setIsUpdating(true);
    try {
      const res = await api.patch(`/admin/verifications/${reviewingItem._id}`, {
        status: reviewStatus,
        reviewNotes
      });
      if (res.data?.success) {
        success(`Verification request marked as ${reviewStatus}!`);
        setReviewingItem(null);
        setReviewNotes('');
        fetchVerifications();
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business & Identity Verification Queue</h1>
        <p className="text-xs text-slate-500">
          Approve or reject real verification requests. We never fabricate verification badges.
        </p>
      </div>

      {verifications.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Verification queue is empty"
          description="Submitted organization license or worker verification documents will appear here for review."
        />
      ) : (
        <div className="space-y-3">
          {verifications.map((v) => (
            <Card key={v._id} className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={v.status === 'approved' ? 'emerald' : v.status === 'rejected' ? 'rose' : 'amber'} size="sm">
                      {v.status}
                    </Badge>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {v.verificationType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">
                    {v.user?.name} ({v.user?.email}) • Role: {v.user?.role}
                  </h3>

                  {v.submittedData && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                      {v.submittedData.businessName && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Business Name:</span>
                          <span className="font-semibold text-slate-800">{v.submittedData.businessName}</span>
                        </div>
                      )}
                      {v.submittedData.registrationNumber && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Registration / Tax ID:</span>
                          <span className="font-semibold text-slate-800">{v.submittedData.registrationNumber}</span>
                        </div>
                      )}
                      {v.submittedData.documentType && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Document Type:</span>
                          <span className="font-semibold text-slate-800">{v.submittedData.documentType}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {v.reviewNotes && (
                    <p className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-lg">
                      <strong>Admin Notes:</strong> {v.reviewNotes}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReviewingItem(v);
                    setReviewStatus(v.status === 'pending' ? 'approved' : v.status as any);
                    setReviewNotes(v.reviewNotes || '');
                  }}
                >
                  Process Request
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={Boolean(reviewingItem)}
        onClose={() => setReviewingItem(null)}
        title="Review Verification Request"
        subtitle={reviewingItem ? `${reviewingItem.user?.name} (${reviewingItem.verificationType})` : ''}
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Verification Decision</label>
            <select
              value={reviewStatus}
              onChange={(e: any) => setReviewStatus(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="approved">APPROVE (Grant Verified Status Badge)</option>
              <option value="rejected">REJECT (Deny Verification)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Verification Notes</label>
            <textarea
              rows={3}
              required
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="e.g. Verified against state registry database..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setReviewingItem(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isUpdating}>
              Confirm Decision
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck2,
  Clock,
  DollarSign,
  Building2,
  CheckCircle2,
  Star,
  MapPin,
  AlertCircle
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Assignment } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const WorkerAssignmentsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal state
  const [reviewingAssignment, setReviewingAssignment] = useState<Assignment | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/assignments/me');
      if (res.data?.success) {
        setAssignments(res.data.assignments || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleConfirmCompletion = async (assignmentId: string) => {
    try {
      const res = await api.post(`/assignments/${assignmentId}/confirm-completion`);
      if (res.data?.success) {
        success('Shift completion confirmed on your behalf!');
        fetchAssignments();
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingAssignment) return;

    setIsSubmittingReview(true);
    try {
      const res = await api.post('/reviews', {
        assignmentId: reviewingAssignment._id,
        rating,
        reviewText
      });
      if (res.data?.success) {
        success('Review submitted successfully!');
        setReviewingAssignment(null);
        setReviewText('');
        fetchAssignments();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Confirmed Shifts & Assignments</h1>
        <p className="text-xs text-slate-500">
          Manage your upcoming scheduled shifts, confirm completion, and track attendance checkout.
        </p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="No confirmed shifts yet"
          description="When an employer confirms your application, your shift schedule will appear here."
          actionText="Discover Shifts"
          onAction={() => (window.location.href = '/jobs')}
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((assign) => (
            <Card key={assign._id} className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        assign.status === 'COMPLETED'
                          ? 'emerald'
                          : assign.status === 'CONFIRMED'
                          ? 'blue'
                          : 'slate'
                      }
                      size="md"
                    >
                      {assign.status}
                    </Badge>
                    <span className="text-xs text-slate-500 font-medium">
                      Employer: {assign.employer?.name}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{assign.job?.title}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        {new Date(assign.agreedSchedule.workDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>{assign.agreedSchedule.startTime} – {assign.agreedSchedule.endTime} ({assign.agreedSchedule.totalHours} hrs)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-slate-900">
                        Agreed: ${assign.agreedPayment.grossAmount} ({assign.agreedPayment.basis})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>{assign.job?.locationName}</span>
                    </div>
                  </div>

                  {/* Dual Completion Status Progress */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                    <span className="font-bold text-slate-800 block">Shift Completion Dual Verification:</span>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            assign.completionConfirmations?.workerConfirmed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {assign.completionConfirmations?.workerConfirmed ? '✓' : '•'}
                        </span>
                        <span>Worker Confirmed: {assign.completionConfirmations?.workerConfirmed ? 'Yes' : 'Pending'}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            assign.completionConfirmations?.employerConfirmed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {assign.completionConfirmations?.employerConfirmed ? '✓' : '•'}
                        </span>
                        <span>Employer Verified: {assign.completionConfirmations?.employerConfirmed ? 'Yes' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Action Block */}
                <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Payment Status:</div>
                    <Badge variant={assign.payment?.status === 'PAID' ? 'emerald' : 'amber'} size="sm">
                      {assign.payment?.status || 'PENDING'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!assign.completionConfirmations?.workerConfirmed && assign.status !== 'CANCELLED' && (
                      <Button
                        size="sm"
                        onClick={() => handleConfirmCompletion(assign._id)}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        Confirm I Completed Shift
                      </Button>
                    )}

                    {assign.status === 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewingAssignment(assign)}
                        leftIcon={<Star className="w-3.5 h-3.5 text-amber-500" />}
                      >
                        Review Employer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={Boolean(reviewingAssignment)}
        onClose={() => setReviewingAssignment(null)}
        title="Leave Review for Employer"
        subtitle={reviewingAssignment ? reviewingAssignment.job?.title : ''}
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Rating (1 to 5 Stars)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setRating(s)}
                  className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    rating >= s
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-slate-200 text-slate-400'
                  }`}
                >
                  ★ {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Feedback & Experience</label>
            <textarea
              rows={4}
              required
              minLength={5}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Was the employer welcoming? Were breaks provided as scheduled? Did payment follow agreed terms?"
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setReviewingAssignment(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isSubmittingReview}>
              Publish Review
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

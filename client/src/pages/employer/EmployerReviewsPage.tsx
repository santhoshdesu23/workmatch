import React, { useState, useEffect } from 'react';
import { Star, User, Calendar } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Review } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const EmployerReviewsPage: React.FC = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      api.get(`/reviews/${user.id}`)
        .then((res) => {
          if (res.data?.success) setReviews(res.data.reviews || []);
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) {
    return <LoadingSkeleton rows={3} />;
  }

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Worker Reviews of Your Shifts</h1>
          <p className="text-xs text-slate-500">
            Ratings and feedback left by confirmed staff following completed shift assignments.
          </p>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="text-2xl font-black text-amber-500">★ {averageRating}</div>
          <div className="text-xs text-slate-500">
            Based on {reviews.length} completed shift review{reviews.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No worker reviews yet"
          description="Workers will be eligible to review your business after completed shift assignments."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r._id} className="p-5 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900">{r.reviewer?.name}</span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-amber-500 font-bold text-xs">
                  {'★'.repeat(r.rating)}
                  <span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed italic">
                "{r.reviewText}"
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

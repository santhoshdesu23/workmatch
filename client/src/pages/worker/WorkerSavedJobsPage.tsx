import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin, Calendar, Clock, Building2, Trash2, ArrowRight } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Job } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { formatPayWithBasis } from '../../utils/currency';

export const WorkerSavedJobsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = async () => {
    setLoading(true);
    try {
      const res = await api.get('/workers/me/saved-jobs');
      if (res.data?.success) {
        setSavedJobs(res.data.savedJobs || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch saved jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const handleRemove = async (jobId: string) => {
    try {
      const res = await api.delete(`/jobs/${jobId}/save`);
      if (res.data?.success) {
        success('Removed from bookmarks.');
        setSavedJobs((prev) => prev.filter((j) => j._id !== jobId));
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={3} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Saved Shift Bookmarks</h1>
        <p className="text-xs text-slate-500">
          Review saved positions and submit applications whenever you are ready.
        </p>
      </div>

      {savedJobs.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No bookmarked shifts"
          description="Click the bookmark icon on any open shift in discovery to save it here."
          actionText="Discover Shifts"
          onAction={() => (window.location.href = '/jobs')}
        />
      ) : (
        <div className="space-y-3">
          {savedJobs.map((job) => (
            <Card key={job._id} className="p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div className="space-y-1.5 flex-1">
                  <Badge variant="emerald" size="sm">{job.category}</Badge>
                  <Link to={`/jobs/${job._id}`}>
                    <h3 className="text-base font-bold text-slate-900 hover:text-emerald-600 transition-colors">
                      {job.title}
                    </h3>
                  </Link>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.employer?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.locationName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(job.workDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-lg font-black text-slate-900">
                    {formatPayWithBasis(job.grossPay, job.payBasis)}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemove(job._id)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
                      title="Remove bookmark"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link to={`/jobs/${job._id}`}>
                      <Button size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        View Shift
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

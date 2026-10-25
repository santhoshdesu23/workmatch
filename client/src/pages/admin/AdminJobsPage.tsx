import React, { useState, useEffect } from 'react';
import { Briefcase, AlertTriangle, Eye, Building2, Calendar, MapPin } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Job } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { formatPayWithBasis } from '../../utils/currency';

export const AdminJobsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/jobs');
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

  const handleCancelJob = async (jobId: string) => {
    if (!window.confirm('Cancel this job posting as an administrator?')) return;
    try {
      const res = await api.post(`/jobs/${jobId}/cancel`, {
        reason: 'Cancelled by platform administrator due to policy review.'
      });
      if (res.data?.success) {
        success('Job cancelled by admin.');
        fetchJobs();
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Job Listings Moderation</h1>
        <p className="text-xs text-slate-500">
          Inspect public shift postings, monitor compliance, and cancel prohibited or fraudulent listings.
        </p>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <Card key={job._id} className="p-5 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="emerald" size="sm">{job.category}</Badge>
                  <Badge variant={job.status === 'OPEN' ? 'blue' : 'slate'} size="sm">
                    {job.status}
                  </Badge>
                  <span className="text-xs text-slate-400 font-medium break-words">
                    Employer: {job.employer?.name} ({job.employer?.email})
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{job.title}</h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{job.locationName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(job.workDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    Pay: <span className="font-bold text-slate-800">{formatPayWithBasis(job.grossPay, job.payBasis)}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mt-1">{job.description}</p>
              </div>

              <div className="sm:text-right shrink-0 flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <a href={`/jobs/${job._id}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                </a>
                {job.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleCancelJob(job._id)}
                  >
                    Moderate / Cancel
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

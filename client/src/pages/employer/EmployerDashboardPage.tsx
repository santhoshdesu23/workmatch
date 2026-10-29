import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Layers,
  CalendarCheck2,
  DollarSign,
  PlusCircle,
  Building2,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Job, Application } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const EmployerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    activeJobsCount: 0,
    openJobsCount: 0,
    closedApplicationsCount: 0,
    ongoingJobsCount: 0,
    upcomingJobsCount: 0,
    pastJobsCount: 0,
    totalJobsCount: 0,
    totalApplicationsCount: 0,
    shortlistedCount: 0,
    confirmedAssignmentsCount: 0,
    pendingPaymentsCount: 0
  });
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await api.get('/employers/me/dashboard');
        if (res.data?.success) {
          if (res.data.metrics) setMetrics(res.data.metrics);
          if (res.data.recentApplications) setRecentApplications(res.data.recentApplications);
        }
      } catch (err: any) {
        console.warn('Employer dashboard fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">Employer Management</span>
              {user?.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                  <ShieldCheck className="w-3 h-3" /> Verified Business
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight break-words">
              <span className="sm:hidden">
                {user?.firstName || (user?.name ? user.name.split(' ')[0] : 'Employer')}'s Operations
              </span>
              <span className="hidden sm:inline">
                {user?.name}'s Operations
              </span>
            </h1>
            <p className="text-xs text-slate-300 max-w-lg">
              Manage temporary postings, candidate applications, shift attendance, and recorded compensation.
            </p>
          </div>

          <Link to="/employer/jobs/create" className="shrink-0">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Post New Shift
            </Button>
          </Link>
        </div>
      </Card>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Active Shift Postings</span>
            <Briefcase className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.activeJobsCount}</div>
          <Link to="/employer/jobs" className="text-[11px] text-emerald-600 font-semibold hover:underline block pt-1">
            Manage postings &rarr;
          </Link>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Total Applicants</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.totalApplicationsCount}</div>
          <div className="text-[11px] text-slate-400 pt-1">
            {metrics.shortlistedCount} currently shortlisted
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Confirmed Workers</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.confirmedAssignmentsCount}</div>
          <Link to="/employer/assignments" className="text-[11px] text-indigo-600 font-semibold hover:underline block pt-1">
            View attendance &rarr;
          </Link>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Pending Payments</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.pendingPaymentsCount}</div>
          <Link to="/employer/payments" className="text-[11px] text-amber-600 font-semibold hover:underline block pt-1">
            Disburse / Record &rarr;
          </Link>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Total Shifts Created</span>
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.totalJobsCount}</div>
          <div className="text-[11px] text-slate-400 pt-1">Lifetime postings</div>
        </Card>
      </div>

      {/* Shift Lifecycle Status Breakdown */}
      <Card className="p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-emerald-600" /> Shift Operational Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <div className="text-xl font-bold text-emerald-700">{metrics.openJobsCount || 0}</div>
            <div className="text-[11px] font-semibold text-emerald-800">Accepting Applications</div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <div className="text-xl font-bold text-amber-700">{metrics.closedApplicationsCount || 0}</div>
            <div className="text-[11px] font-semibold text-amber-800">Applications Closed</div>
          </div>
          <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl">
            <div className="text-xl font-bold text-sky-700">{metrics.ongoingJobsCount || 0}</div>
            <div className="text-[11px] font-semibold text-sky-800">Ongoing Shifts</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xl font-bold text-slate-700">{metrics.pastJobsCount || 0}</div>
            <div className="text-[11px] font-semibold text-slate-800">Past / Ended Work</div>
          </div>
        </div>
      </Card>

      {/* Recent Applications Feed */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Recent Candidate Applications</h2>
            <p className="text-xs text-slate-500">Candidates awaiting review or interview offer</p>
          </div>
          <Link to="/employer/jobs" className="text-xs font-semibold text-emerald-600 hover:underline">
            View by Shift &rarr;
          </Link>
        </div>

        {recentApplications.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No pending candidate applications. Published jobs appear in worker discovery.
          </p>
        ) : (
          <div className="space-y-3">
            {recentApplications.map((app) => {
              const jobTitle = typeof app.job === 'object' ? app.job?.title : 'Shift';
              return (
                <div key={app._id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate max-w-[200px] sm:max-w-xs" title={app.worker?.name}>
                        {app.worker?.name}
                      </span>
                      <Badge variant="blue" size="sm" className="shrink-0">{app.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-600">Applied for: <span className="font-medium">{jobTitle}</span></p>
                    <span className="text-[10px] text-slate-400">
                      Received {new Date(app.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <Link to={`/employer/jobs/${typeof app.job === 'object' ? app.job._id : app.job}/applicants`}>
                    <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3 h-3" />}>
                      Review Candidate
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

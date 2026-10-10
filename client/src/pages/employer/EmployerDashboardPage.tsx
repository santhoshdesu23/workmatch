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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">Employer Management</span>
              {user?.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Verified Business
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {user?.name}'s Operations
            </h1>
            <p className="text-xs text-slate-300 max-w-lg">
              Manage temporary postings, candidate applications, shift attendance, and recorded compensation.
            </p>
          </div>

          <Link to="/employer/jobs/create">
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
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{app.worker?.name}</span>
                      <Badge variant="blue" size="sm">{app.status}</Badge>
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

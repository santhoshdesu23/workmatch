import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Layers,
  Calendar,
  CalendarCheck2,
  DollarSign,
  Bookmark,
  Bell,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  AlertCircle
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Job, Application, Assignment, NotificationItem, WorkerProfile } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatPayWithBasis, formatINR } from '../../utils/currency';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const WorkerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [recommendations, setRecommendations] = useState<Job[]>([]);
  const [requiresProfileCompletion, setRequiresProfileCompletion] = useState<boolean>(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [profRes, recRes, appRes, assignRes, notifRes] = await Promise.all([
          api.get('/workers/me'),
          api.get('/recommendations/jobs?limit=3'),
          api.get('/applications/me'),
          api.get('/assignments/me'),
          api.get('/notifications')
        ]);

        if (profRes.data?.success) setProfile(profRes.data.profile);
        if (recRes.data?.success) {
          setRecommendations(recRes.data.recommendations || []);
          setRequiresProfileCompletion(Boolean(recRes.data.requiresProfileCompletion));
        }
        if (appRes.data?.success) setApplications(appRes.data.applications || []);
        if (assignRes.data?.success) setAssignments(assignRes.data.assignments || []);
        if (notifRes.data?.success) setNotifications(notifRes.data.notifications?.slice(0, 4) || []);
      } catch (err: any) {
        console.warn('Dashboard data fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  // Profile completion calculation
  let completedFields = 0;
  const totalFields = 5;
  if (profile?.skills && profile.skills.length > 0) completedFields++;
  if (profile?.preferredCategories && profile.preferredCategories.length > 0) completedFields++;
  if (profile?.bio && profile.bio.length > 10) completedFields++;
  if (profile?.preferredLocationName) completedFields++;
  if (profile?.expectedPay?.min) completedFields++;
  const completionPercentage = Math.round((completedFields / totalFields) * 100);

  const activeApplicationsCount = applications.filter((a) =>
    ['APPLIED', 'SHORTLISTED', 'OFFERED'].includes(a.status)
  ).length;

  const upcomingAssignments = assignments.filter((a) =>
    ['CONFIRMED', 'IN_PROGRESS'].includes(a.status)
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-0 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-200">Worker Portal</span>
              {user?.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-white border border-emerald-400/40 font-semibold shrink-0">
                  <ShieldCheck className="w-3 h-3" /> Verified Worker
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight break-words">
              <span className="sm:hidden">
                Welcome back, {user?.firstName || (user?.name ? user.name.split(' ')[0] : 'Worker')}
              </span>
              <span className="hidden sm:inline">
                Welcome back, {user?.name}
              </span>
            </h1>
            <p className="text-xs text-emerald-100 max-w-lg">
              Explore local temporary shifts matching your preferences. You retain full freedom to apply or decline.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/worker/recommendations">
              <Button size="sm" className="bg-white text-emerald-800 hover:bg-emerald-50 shadow-none font-bold" leftIcon={<Sparkles className="w-4 h-4 text-emerald-600" />}>
                View AI Matches
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Profile Completion Callout (if < 100%) */}
      {completionPercentage < 100 && (
        <Card className="p-4 bg-amber-50/60 border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Profile is {completionPercentage}% complete
              </h3>
              <p className="text-xs text-slate-600">
                Add skills and availability to maximize your explainable AI match accuracy.
              </p>
            </div>
          </div>
          <Link to="/worker/profile">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100/50">
              Update Profile
            </Button>
          </Link>
        </Card>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Active Applications</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activeApplicationsCount}</div>
          <Link to="/worker/applications" className="text-[11px] text-sky-600 font-semibold hover:underline block pt-1">
            Track status &rarr;
          </Link>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Upcoming Shifts</span>
            <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{upcomingAssignments.length}</div>
          <Link to="/worker/assignments" className="text-[11px] text-emerald-600 font-semibold hover:underline block pt-1">
            View shift times &rarr;
          </Link>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Completed Shifts</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{profile?.completedJobsCount || 0}</div>
          <Link to="/worker/payments" className="text-[11px] text-teal-600 font-semibold hover:underline block pt-1">
            Earnings history &rarr;
          </Link>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Saved Shifts</span>
            <Bookmark className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{profile?.savedJobs?.length || 0}</div>
          <Link to="/worker/saved-jobs" className="text-[11px] text-amber-600 font-semibold hover:underline block pt-1">
            View bookmarks &rarr;
          </Link>
        </Card>
      </div>

      {/* Two Column Layout: Recommended Shifts & Upcoming Shifts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recommended Shifts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">Top AI Shift Matches</h2>
            </div>
            <Link to="/worker/recommendations" className="text-xs font-semibold text-emerald-600 hover:underline">
              See all matches &rarr;
            </Link>
          </div>

          {recommendations.length === 0 ? (
            <Card className="p-6 text-center text-xs text-slate-500">
              {requiresProfileCompletion ? (
                <div className="space-y-2 py-2">
                  <p className="font-semibold text-slate-800 text-sm">Complete Your Profile to Get AI Matches</p>
                  <p className="text-slate-500 max-w-sm mx-auto">Add your skills and work preferences so WorkMatch can find relevant opportunities for you.</p>
                  <div className="pt-1">
                    <Link to="/worker/profile">
                      <Button size="sm" variant="outline">
                        Edit Worker Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-800">No matching jobs found yet.</p>
                  <p className="text-slate-500">Try updating your skills or preferences, or check again later.</p>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {recommendations.map((job) => (
                <Card key={job._id} hoverable className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="emerald" size="sm">{job.category}</Badge>
                        {job.isDemo && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            DEMO
                          </span>
                        )}
                        {job.matchData && (
                          <Badge variant="emerald" size="sm">
                            <Sparkles className="w-3 h-3" />
                            {job.matchData.matchScore}% Match
                          </Badge>
                        )}
                      </div>

                      <Link to={`/jobs/${job._id}`}>
                        <h4 className="text-sm font-bold text-slate-900 hover:text-emerald-600 transition-colors">
                          {job.title}
                        </h4>
                      </Link>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1 min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={job.employerProfile?.businessName || job.employer?.name}>
                            {job.employerProfile?.businessName || job.employer?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{job.locality ? `${job.locality}, ${job.district || job.city || ''}` : job.locationName}</span>
                          {job.distanceKm !== null && job.distanceKm !== undefined && (
                            <span className="text-emerald-600 font-semibold">(~{job.distanceKm} km)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(job.workDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-slate-900">
                        {formatPayWithBasis(job.grossPay, job.payBasis)}
                      </div>
                      <Link to={`/jobs/${job._id}`} className="inline-block mt-2">
                        <Button size="sm">View Shift</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Upcoming Shifts & Notifications */}
        <div className="space-y-6">
          {/* Upcoming Shifts Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarCheck2 className="w-4 h-4 text-emerald-600" /> Confirmed Shifts
              </h3>
              <Link to="/worker/assignments" className="text-[11px] text-emerald-600 hover:underline font-semibold">
                View all
              </Link>
            </div>

            {upcomingAssignments.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No upcoming confirmed shifts scheduled.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.slice(0, 3).map((assign) => (
                  <div key={assign._id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {assign.job.title}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{assign.agreedSchedule.startTime} – {assign.agreedSchedule.endTime}</span>
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold pt-1">
                      Agreed Pay: {formatINR(assign.agreedPayment.grossAmount)} ({assign.agreedPayment.basis})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Notifications Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-slate-500" /> In-App Alerts
              </h3>
              <Link to="/worker/notifications" className="text-[11px] text-emerald-600 hover:underline font-semibold">
                Center
              </Link>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">No unread notifications.</p>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => (
                  <div key={n._id} className="text-xs space-y-0.5 border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-900 block">{n.title}</span>
                    <p className="text-slate-500 line-clamp-1">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

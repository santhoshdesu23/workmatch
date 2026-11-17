import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
  Search,
  Building2,
  Navigation,
  ShieldCheck
} from 'lucide-react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

interface JobOverviewItem {
  _id: string;
  title: string;
  locationName: string;
  location?: {
    coordinates: [number, number];
  };
  workDate: string;
  startTime: string;
  endTime: string;
  status: string;
  openings: number;
  filledCount: number;
  attendanceRadiusMeters?: number;
  coordinatesConfirmed?: boolean;
  metrics: {
    totalSelected: number;
    presentTotal: number;
    presentGps: number;
    presentManual: number;
    absent: number;
    pending: number;
  };
}

export const EmployerAttendancePage: React.FC = () => {
  const [jobs, setJobs] = useState<JobOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/employer/jobs');
      if (res.data?.success && Array.isArray(res.data.jobs)) {
        setJobs(res.data.jobs);
      }
    } catch (err) {
      console.error('Failed to load attendance overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.locationName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || job.workDate.slice(0, 10) === filterDate;
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900">Worker Attendance Management</h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Track real-time GPS check-ins within the verified 200m radius of your venues, or record manual attendance for your confirmed staff.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/employer/assignments">
              <Button variant="outline" size="sm" leftIcon={<Users className="w-4 h-4" />}>
                Selected Staff
              </Button>
            </Link>
            <Link to="/employer/jobs/create">
              <Button size="sm" leftIcon={<Building2 className="w-4 h-4" />}>
                Post New Shift
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by job title or venue location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Jobs Attendance List */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton rows={3} />
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No shifts found"
          description={
            searchTerm || filterDate
              ? 'No jobs match your current search filters.'
              : 'Post a shift and confirm worker assignments to start managing attendance.'
          }
          actionText={searchTerm || filterDate ? 'Clear Filters' : 'Post a Shift'}
          onAction={() => {
            if (searchTerm || filterDate) {
              setSearchTerm('');
              setFilterDate('');
            } else {
              window.location.href = '/employer/jobs/create';
            }
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const hasCoords =
              job.location?.coordinates &&
              (job.location.coordinates[0] !== 0 || job.location.coordinates[1] !== 0);

            return (
              <Card
                key={job._id}
                className="p-5 hover:border-emerald-300 transition-all shadow-xs border-slate-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Job Details */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-slate-900 hover:text-emerald-700 transition-colors">
                        {job.title}
                      </h2>
                      <Badge
                        variant={
                          job.status === 'OPEN'
                            ? 'emerald'
                            : job.status === 'FILLED'
                            ? 'blue'
                            : job.status === 'COMPLETED'
                            ? 'slate'
                            : 'amber'
                        }
                        size="sm"
                      >
                        {job.status}
                      </Badge>
                      {hasCoords ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Navigation className="w-3 h-3 text-emerald-600" />
                          GPS Geofence (200m) Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Manual Attendance Only
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{job.locationName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{new Date(job.workDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{job.startTime} – {job.endTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Metrics Pills */}
                  <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shrink-0 sm:w-auto">
                    <div className="text-center px-2 py-1">
                      <div className="text-[10px] font-medium text-slate-500 uppercase">Selected</div>
                      <div className="text-sm font-bold text-slate-900">{job.metrics.totalSelected}</div>
                    </div>
                    <div className="text-center px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                      <div className="text-[10px] font-semibold text-emerald-700 uppercase flex items-center justify-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Present
                      </div>
                      <div className="text-sm font-bold text-emerald-800">{job.metrics.presentTotal}</div>
                    </div>
                    <div className="text-center px-2 py-1 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="text-[10px] font-semibold text-amber-700 uppercase flex items-center justify-center gap-0.5">
                        <Clock className="w-2.5 h-2.5 text-amber-600" /> Pending
                      </div>
                      <div className="text-sm font-bold text-amber-800">{job.metrics.pending}</div>
                    </div>
                    <div className="text-center px-2 py-1 bg-rose-50 rounded-lg border border-rose-100">
                      <div className="text-[10px] font-semibold text-rose-700 uppercase flex items-center justify-center gap-0.5">
                        <XCircle className="w-2.5 h-2.5 text-rose-600" /> Absent
                      </div>
                      <div className="text-sm font-bold text-rose-800">{job.metrics.absent}</div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex items-center justify-end">
                    <Link to={`/employer/attendance/${job._id}`}>
                      <Button size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                        Manage Attendance
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

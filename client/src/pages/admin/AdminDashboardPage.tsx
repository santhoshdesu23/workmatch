import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Briefcase,
  CalendarCheck,
  AlertTriangle,
  UserCheck,
  Building2,
  FileCheck2,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  Tag
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend
} from 'recharts';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [cityDistribution, setCityDistribution] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  const fetchDashboard = async (selectedRange = range) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/dashboard?range=${selectedRange}`);
      if (res.data?.success) {
        setStats(res.data.stats);
        setTrends(res.data.trends);
        setCategoryDistribution(res.data.categoryDistribution || []);
        setCityDistribution(res.data.cityDistribution || []);
        setRecentActivity(res.data.recentActivity || null);
      }
    } catch (err: any) {
      console.warn('Failed to fetch admin dashboard:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(range);
  }, [range]);

  if (loading && !stats) {
    return <LoadingSkeleton rows={6} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome / Governance Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
              <Sparkles className="w-3.5 h-3.5" />
              SaaS Administration & Governance
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            WorkMatch Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time marketplace telemetry, user verification queues, attendance integrity & dispute oversight.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            {[
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRange(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  range === tab.id
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 8 Primary Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Users */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Total Users</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.totalUsers || 0}</span>
            <span className="text-[11px] text-emerald-600 font-medium">
              {stats?.activeUsers || 0} active
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{stats?.totalWorkers || 0} workers</span>
            <span>{stats?.totalEmployers || 0} employers</span>
          </div>
        </Card>

        {/* Active Jobs */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Active Job Postings</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.activeJobs || 0}</span>
            <span className="text-[11px] text-slate-500">of {stats?.totalJobs || 0} total</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Fill Rate</span>
            <span className="font-semibold text-slate-800">{stats?.fillRate || 0}%</span>
          </div>
        </Card>

        {/* Total Applications & Selected */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Applications</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.totalApplications || 0}</span>
            <span className="text-[11px] text-purple-600 font-medium">
              {stats?.selectedWorkers || 0} selected
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Assignments</span>
            <span className="font-semibold text-slate-800">{stats?.totalAssignments || 0} total</span>
          </div>
        </Card>

        {/* Attendance Verification */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Attendance Records</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.totalAttendance || 0}</span>
            <span className="text-[11px] text-indigo-600 font-medium">
              {stats?.gpsAttendance || 0} GPS verified
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Manual Marked</span>
            <span className="font-semibold text-slate-800">{stats?.manualAttendance || 0}</span>
          </div>
        </Card>

        {/* Total Workers */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Registered Workers</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.totalWorkers || 0}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <Link to="/admin/workers" className="text-primary-600 hover:underline flex items-center gap-1">
              Manage Workers <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        {/* Total Employers */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Registered Employers</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.totalEmployers || 0}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <Link to="/admin/employers" className="text-primary-600 hover:underline flex items-center gap-1">
              Manage Employers <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        {/* Pending Verifications */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Pending Verifications</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.pendingVerifications || 0}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <Link to="/admin/verifications" className="text-amber-600 hover:underline flex items-center gap-1">
              Review Queue <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        {/* Open Reports & Complaints */}
        <Card className="p-4 bg-white border-slate-200/80 hover:border-slate-300 transition-colors shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Open Reports & Complaints</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.openReports || 0}</span>
            <span className="text-[11px] text-rose-600 font-medium">Urgent</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <Link to="/admin/reports" className="text-rose-600 hover:underline flex items-center gap-1">
              Investigate <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Analytics Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">User Growth Trends</h3>
              <p className="text-xs text-slate-500">Worker and employer signups over time</p>
            </div>
            <Badge variant="slate">New Registrations</Badge>
          </div>

          <div className="h-64 w-full">
            {trends?.userGrowth && trends.userGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="workers" name="Workers" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="employers" name="Employers" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No user registrations recorded in this period.
              </div>
            )}
          </div>
        </Card>

        {/* Job Trends Chart */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Job Posting Trends</h3>
              <p className="text-xs text-slate-500">Listings created, filled and expired</p>
            </div>
            <Badge variant="slate">Market Activity</Badge>
          </div>

          <div className="h-64 w-full">
            {trends?.jobTrends && trends.jobTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.jobTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="open" name="Active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="filled" name="Filled" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expired" name="Expired" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No job postings recorded in this period.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Job Categories</h3>
              <p className="text-xs text-slate-500">Temporary staffing distribution by category</p>
            </div>
            <Tag className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-56 w-full flex items-center">
            {categoryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full text-center text-xs text-slate-400">No categories found.</div>
            )}
          </div>
        </Card>

        {/* City Distribution */}
        <Card className="p-5 bg-white border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Geographic Distribution</h3>
              <p className="text-xs text-slate-500">Live job listings by verified city/locality</p>
            </div>
            <MapPin className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            {cityDistribution.length > 0 ? (
              cityDistribution.map((item, idx) => (
                <div key={item.city || idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{item.city || 'Other Locations'}</span>
                    <span className="font-semibold text-slate-900">{item.count} jobs</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((item.count / Math.max(1, stats?.totalJobs || 1)) * 100)
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center">
                No location data recorded yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card className="p-5 bg-white border-slate-200/80 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Platform Activity Feed</h3>
            <p className="text-xs text-slate-500">Real-time marketplace transactions, reports & audits</p>
          </div>
          <Link to="/admin/audit-logs">
            <Button size="sm" variant="outline" className="text-xs">
              View All Audit Logs
            </Button>
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {recentActivity?.auditLogs && recentActivity.auditLogs.length > 0 ? (
            recentActivity.auditLogs.map((log: any) => (
              <div key={log._id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-600" />
                  <div>
                    <span className="font-semibold text-slate-900">
                      {log.actor?.name || 'Administrator'}
                    </span>{' '}
                    <span className="text-slate-600">performed</span>{' '}
                    <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px]">
                      {log.action}
                    </span>{' '}
                    <span className="text-slate-500">on {log.resourceType}</span>
                    {log.metadata?.reason && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Reason: &quot;{log.metadata.reason}&quot;
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              No recent audit logs available.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Briefcase,
  Layers,
  CalendarCheck2,
  AlertTriangle,
  BadgeCheck,
  Activity,
  ArrowRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminStats = async () => {
      setLoading(true);
      try {
        const res = await api.get('/admin/dashboard');
        if (res.data?.success) {
          setStats(res.data.stats);
          setRecentUsers(res.data.recentUsers || []);
          setRecentReports(res.data.recentReports || []);
        }
      } catch (err: any) {
        console.warn('Admin stats fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStats();
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  // Meaningful chart data derived from actual server statistics
  const userRoleData = [
    { name: 'Workers', count: stats?.totalWorkers || 0, color: '#059669' },
    { name: 'Employers', count: stats?.totalEmployers || 0, color: '#0284c7' }
  ];

  const lifecycleData = [
    { stage: 'Jobs', value: stats?.totalJobs || 0 },
    { stage: 'Applications', value: stats?.totalApplications || 0 },
    { stage: 'Assignments', value: stats?.totalAssignments || 0 },
    { stage: 'Completed', value: stats?.completedAssignments || 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="p-6 bg-gradient-to-r from-slate-950 to-slate-900 text-white border-0 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">
              Platform Administration & Moderation
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              WorkMatch Governance Center
            </h1>
            <p className="text-xs text-slate-300 max-w-lg">
              Live database queries, verified trust records, incident moderation, and dispute queues.
            </p>
          </div>

          <div className="flex gap-2">
            <Link to="/admin/reports">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                Review Reports ({stats?.openReports || 0})
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Registered Users</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.totalUsers || 0}</div>
          <div className="text-[11px] text-slate-400">
            {stats?.totalWorkers || 0} workers, {stats?.totalEmployers || 0} employers
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Shift Postings</span>
            <Briefcase className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.totalJobs || 0}</div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            {stats?.activeJobs || 0} currently OPEN
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Confirmed Shifts</span>
            <CalendarCheck2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.totalAssignments || 0}</div>
          <div className="text-[11px] text-indigo-600 font-semibold">
            {stats?.completionRate || 0}% Completion Rate
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Incident Reports</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.openReports || 0}</div>
          <div className="text-[11px] text-rose-600 font-semibold">
            {stats?.pendingVerifications || 0} pending verifications
          </div>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Marketplace Lifecycle Funnel
          </h2>
          <p className="text-xs text-slate-500">Jobs published through completed shift delivery</p>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifecycleData}>
                <XAxis dataKey="stage" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            User Composition Breakdown
          </h2>
          <p className="text-xs text-slate-500">Distribution of registered workers vs employers</p>
          <div className="h-64 w-full flex items-center justify-center pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userRoleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ name, count }) => `${name}: ${count}`}
                >
                  {userRoleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Recently Registered Accounts</h3>
            <Link to="/admin/users" className="text-xs font-semibold text-emerald-600 hover:underline">
              View All &rarr;
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentUsers.map((u) => (
              <div key={u._id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <span className="font-bold text-slate-900 block">{u.name}</span>
                  <span className="text-slate-400">{u.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.role === 'worker' ? 'emerald' : 'blue'} size="sm">
                    {u.role}
                  </Badge>
                  <span className={`text-[10px] font-semibold capitalize ${u.accountStatus === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {u.accountStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Incident Reports Queue</h3>
            <Link to="/admin/reports" className="text-xs font-semibold text-amber-600 hover:underline">
              Manage Queue &rarr;
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No reports currently in moderation.</p>
          ) : (
            <div className="space-y-2.5">
              {recentReports.map((r) => (
                <div key={r._id} className="p-3 rounded-xl bg-slate-50 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-800 uppercase text-[10px]">{r.category}</span>
                    <Badge variant={r.status === 'pending' ? 'amber' : 'emerald'} size="sm">{r.status}</Badge>
                  </div>
                  <p className="text-slate-600 line-clamp-1">{r.description}</p>
                  <span className="text-[10px] text-slate-400 block pt-0.5">
                    Reported by {r.reporter?.name || 'Anonymous'} • {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

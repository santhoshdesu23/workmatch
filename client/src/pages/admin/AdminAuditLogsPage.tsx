import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Eye,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminAuditLogsPage: React.FC = () => {
  const { error: toastError } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, totalCount: 0 });

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '15');
      if (actionFilter) params.append('action', actionFilter);
      if (resourceFilter) params.append('resourceType', resourceFilter);

      const res = await api.get(`/admin/audit-logs?${params.toString()}`);
      if (res.data?.success) {
        setLogs(res.data.auditLogs || []);
        setPagination(res.data.pagination || { totalPages: 1, totalCount: 0 });
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Administrator Activity & Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-evident, server-timestamped records of administrative interventions, suspensions, and settings.
          </p>
        </div>
        <Badge variant="slate">
          Total Logs: {pagination.totalCount}
        </Badge>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filters:</span>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="SUSPEND_USER">SUSPEND_USER</option>
            <option value="REACTIVATE_USER">REACTIVATE_USER</option>
            <option value="SUSPEND_JOB">SUSPEND_JOB</option>
            <option value="RESOLVE_REPORT">RESOLVE_REPORT</option>
            <option value="REVIEW_VERIFICATION">REVIEW_VERIFICATION</option>
            <option value="CORRECT_ATTENDANCE">CORRECT_ATTENDANCE</option>
            <option value="UPDATE_SETTING">UPDATE_SETTING</option>
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Entity Types</option>
            <option value="User">User</option>
            <option value="Job">Job</option>
            <option value="Report">Report</option>
            <option value="VerificationRequest">VerificationRequest</option>
            <option value="Attendance">Attendance</option>
            <option value="Setting">Setting</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ScrollText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No activity logs recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource Target</th>
                  <th className="py-3 px-4">Reason / Description</th>
                  <th className="py-3 px-4">Server Timestamp</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{l.actor?.name || 'Administrator'}</div>
                      <div className="text-[10px] text-slate-400">{l.actor?.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {l.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-medium">{l.resourceType}</span>
                      {l.resourceId && (
                        <span className="block font-mono text-[10px] text-slate-400 truncate max-w-[130px]">
                          {l.resourceId}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="truncate block text-slate-600">
                        {l.metadata?.reason || l.metadata?.description || l.metadata?.key || 'System audited action'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {l.createdAt ? new Date(l.createdAt).toLocaleString() : 'N/A'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLog(l)}
                        className="text-xs px-2.5 py-1"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log Record: ${selectedLog.action}`}
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Actor</span>
                <span className="font-semibold text-slate-900">{selectedLog.actor?.name} ({selectedLog.actor?.email})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Action</span>
                <span className="font-mono font-semibold text-slate-900">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Target Entity</span>
                <span className="font-semibold text-slate-900">{selectedLog.resourceType} ({selectedLog.resourceId})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Server Timestamp</span>
                <span className="font-semibold text-slate-900">{new Date(selectedLog.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase mb-1">Metadata Payload</span>
              <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

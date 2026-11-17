import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  History,
  FileEdit,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminAttendancePage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, totalCount: 0 });

  // History Inspect Modal
  const [inspectRecord, setInspectRecord] = useState<any | null>(null);

  // Administrative Correction Modal
  const [correctingRecord, setCorrectingRecord] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<'PRESENT' | 'ABSENT' | 'PENDING'>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');
      if (statusFilter) params.append('status', statusFilter);
      if (methodFilter) params.append('method', methodFilter);

      const res = await api.get(`/admin/attendance?${params.toString()}`);
      if (res.data?.success) {
        setAttendance(res.data.attendance || []);
        setStats(res.data.stats || null);
        setPagination(res.data.pagination || { totalPages: 1, totalCount: 0 });
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch attendance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [page, statusFilter, methodFilter]);

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;
    if (!correctionReason.trim()) {
      toastError('A mandatory justification reason must be provided.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.patch(`/admin/attendance/${correctingRecord._id}/correct`, {
        status: newStatus,
        reason: correctionReason.trim()
      });
      if (res.data?.success) {
        success('Attendance status corrected and audit trail logged.');
        setCorrectingRecord(null);
        setCorrectionReason('');
        fetchAttendance();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to correct attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Attendance Integrity & Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit 200m GPS-geofenced worker check-ins, employer manual overrides, and dispute resolution.
          </p>
        </div>
        <Badge variant="slate">
          Total Logs: {pagination.totalCount}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">GPS Geofence Verified</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {stats?.gpsVerified || 0}
          </div>
          <span className="text-[11px] text-slate-400">Within 200m radius</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Employer Manually Marked</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {stats?.manualMarked || 0}
          </div>
          <span className="text-[11px] text-slate-400">Venue supervisor attested</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Reported Absent</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            {stats?.absentCount || 0}
          </div>
          <span className="text-[11px] text-slate-400">No-show records</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Pending Check-in</span>
          <div className="text-2xl font-bold text-slate-700 mt-1">
            {stats?.pendingCount || 0}
          </div>
          <span className="text-[11px] text-slate-400">Upcoming or in-flight</span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filters:</span>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Attendance Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="PENDING">Pending</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Check-in Methods</option>
            <option value="GPS">GPS Geofence</option>
            <option value="MANUAL">Employer Manual</option>
          </select>
        </div>
      </Card>

      {/* Attendance Table */}
      <Card className="bg-white border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CalendarCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No attendance records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Worker</th>
                  <th className="py-3 px-4">Job & Venue</th>
                  <th className="py-3 px-4">Check-in Method</th>
                  <th className="py-3 px-4">Proximity / Accuracy</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {attendance.map((rec) => (
                  <tr key={rec._id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Worker */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{rec.worker?.name || 'Worker'}</div>
                      <div className="text-[10px] text-slate-400">{rec.worker?.email}</div>
                    </td>

                    {/* Job & Venue */}
                    <td className="py-3 px-4 text-slate-700">
                      <div className="font-semibold text-slate-900 truncate max-w-[170px]">
                        {rec.job?.title || 'Job Listing'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                        📍 {rec.job?.location?.city || 'Local Venue'}
                      </div>
                    </td>

                    {/* Check-in Method Badge */}
                    <td className="py-3 px-4">
                      {rec.method === 'GPS' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          GPS Verified
                        </span>
                      ) : rec.method === 'MANUAL' ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          <FileEdit className="w-3 h-3 text-blue-600" />
                          Employer Manual
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Unrecorded</span>
                      )}
                    </td>

                    {/* Proximity / Accuracy */}
                    <td className="py-3 px-4 text-slate-600">
                      {rec.method === 'GPS' ? (
                        <div>
                          <span className="font-medium text-slate-900">
                            {rec.distanceMeters !== undefined ? `${Math.round(rec.distanceMeters)}m away` : 'N/A'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Accuracy: ±{Math.round(rec.accuracyMeters || 0)}m
                          </span>
                        </div>
                      ) : rec.reason ? (
                        <span className="text-[11px] text-slate-500 italic max-w-[150px] truncate block">
                          &quot;{rec.reason}&quot;
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          rec.status === 'PRESENT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : rec.status === 'ABSENT'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {rec.checkedInAt ? new Date(rec.checkedInAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {rec.auditHistory && rec.auditHistory.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectRecord(rec)}
                          className="text-xs px-2.5 py-1"
                        >
                          <History className="w-3.5 h-3.5 mr-1" /> Log ({rec.auditHistory.length})
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCorrectingRecord(rec);
                          setNewStatus(rec.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                        }}
                        className="text-xs px-2.5 py-1"
                      >
                        Correct
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

      {/* History Audit Inspect Modal */}
      {inspectRecord && (
        <Modal
          isOpen={Boolean(inspectRecord)}
          onClose={() => setInspectRecord(null)}
          title={`Attendance Audit History: ${inspectRecord.worker?.name}`}
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-500">
              Below is the tamper-evident log of changes made to this attendance event:
            </p>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-72 overflow-y-auto">
              {inspectRecord.auditHistory?.map((h: any, idx: number) => (
                <div key={idx} className="py-2 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                      {h.action}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(h.changedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    Status: <span className="font-medium text-slate-800">{h.previousStatus} → {h.newStatus}</span>
                  </div>
                  {h.reason && (
                    <div className="text-[11px] text-slate-500">
                      Reason: &quot;{h.reason}&quot;
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400">
                    Recorded By: {h.changedBy?.name || 'Administrator'} ({h.changedBy?.email || 'N/A'})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Administrative Correction Modal */}
      {correctingRecord && (
        <Modal
          isOpen={Boolean(correctingRecord)}
          onClose={() => setCorrectingRecord(null)}
          title={`Administrative Attendance Correction: ${correctingRecord.worker?.name}`}
        >
          <form onSubmit={handleCorrectionSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Immutable Dispute Resolution</p>
                <p className="mt-0.5">
                  Administrative corrections record your identity, timestamp, and justification reason into the audit trail.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Attendance Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
              >
                <option value="PRESENT">PRESENT (Mark Present)</option>
                <option value="ABSENT">ABSENT (Mark Absent)</option>
                <option value="PENDING">PENDING (Reset to Pending)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Correction Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="State the resolution reason (e.g. employer confirmed attendance dispute, cellular outage)..."
                rows={3}
                required
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setCorrectingRecord(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !correctionReason.trim()}
              >
                {isSubmitting ? 'Recording...' : 'Save Correction'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

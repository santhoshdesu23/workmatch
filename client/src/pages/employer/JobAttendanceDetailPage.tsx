import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  History,
  Navigation,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import {
  JobAttendanceDetailResponse,
  JobAttendanceWorkerItem,
  AttendanceStatus,
  AttendanceAuditEntry
} from '../../types';

export const JobAttendanceDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { success, error: toastError } = useToast();

  const [data, setData] = useState<JobAttendanceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual Attendance Modal states
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<JobAttendanceWorkerItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<'present_manual' | 'absent_manual'>('present_manual');
  const [reason, setReason] = useState('');
  const [allowCorrection, setAllowCorrection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audit History Modal states
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AttendanceAuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditWorkerName, setAuditWorkerName] = useState('');

  const fetchJobAttendance = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const res = await api.get(`/attendance/job/${jobId}`);
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err: any) {
      toastError(err?.response?.data?.message || err?.message || 'Failed to load attendance details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobAttendance();
  }, [jobId]);

  // Open manual mark modal
  const handleOpenManualModal = (
    worker: JobAttendanceWorkerItem,
    status: 'present_manual' | 'absent_manual',
    isCorrection = false
  ) => {
    setSelectedWorker(worker);
    setTargetStatus(status);
    setReason('');
    setAllowCorrection(isCorrection || worker.status === 'present_gps');
    setManualModalOpen(true);
  };

  // Submit manual mark or correction
  const handleSaveManualAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker || !jobId) return;

    if (!reason.trim() || reason.trim().length < 3) {
      toastError('Please enter a clear explanation (minimum 3 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedWorker.attendanceId && allowCorrection) {
        // Use correction endpoint
        const res = await api.patch(`/attendance/${selectedWorker.attendanceId}/correction`, {
          status: targetStatus,
          reason: reason.trim()
        });
        if (res.data?.success) {
          success(`Attendance record updated to ${targetStatus === 'present_manual' ? 'Present' : 'Absent'}.`);
          setManualModalOpen(false);
          fetchJobAttendance();
        }
      } else {
        // Standard manual marking
        const res = await api.post(`/attendance/job/${jobId}/worker/${selectedWorker.worker._id}/manual`, {
          status: targetStatus,
          reason: reason.trim(),
          allowCorrection
        });
        if (res.data?.success) {
          success(`Worker marked as ${targetStatus === 'present_manual' ? 'Present' : 'Absent'}.`);
          setManualModalOpen(false);
          fetchJobAttendance();
        }
      }
    } catch (err: any) {
      if (err?.response?.data?.code === 'REQUIRES_EXPLICIT_CORRECTION') {
        toastError(err.response.data.message);
        setAllowCorrection(true);
      } else {
        toastError(err?.response?.data?.message || err?.message || 'Failed to record attendance.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open audit log modal
  const handleViewAuditHistory = async (worker: JobAttendanceWorkerItem) => {
    if (!worker.attendanceId) return;
    setSelectedWorker(worker);
    setAuditWorkerName(worker.worker.name);
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const res = await api.get(`/attendance/${worker.attendanceId}/audit`);
      if (res.data?.success) {
        setAuditEntries(res.data.auditHistory || []);
      }
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Failed to load audit history.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present_gps':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            Present – GPS Verified
          </span>
        );
      case 'present_manual':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            Present – Manually Marked
          </span>
        );
      case 'absent_manual':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Absent – Employer Marked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Check-in
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Shift not found"
        description="The attendance details for this shift could not be loaded."
        actionText="Back to Attendance Overview"
        onAction={() => {
          window.location.href = '/employer/attendance';
        }}
      />
    );
  }

  const { job, summary, workers } = data;
  const hasCoordinates =
    job.location?.coordinates &&
    (job.location.coordinates[0] !== 0 || job.location.coordinates[1] !== 0);

  return (
    <div className="space-y-6">
      {/* Back button & Title Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <Link
            to="/employer/attendance"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Shifts</span>
          </Link>
          {hasCoordinates && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Navigation className="w-3 h-3 text-emerald-600" />
              Verified GPS Geofence (200m)
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{job.locationName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{new Date(job.workDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{job.startTime} – {job.endTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Total Selected</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.totalSelected}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Confirmed Staff</div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Present
            </div>
            <div className="text-2xl font-bold text-emerald-800 mt-1">{summary.presentCount}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">
              {summary.presentGpsCount} GPS • {summary.presentManualCount} Manual
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <div className="text-[11px] font-semibold text-amber-700 uppercase flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" /> Pending
            </div>
            <div className="text-2xl font-bold text-amber-800 mt-1">{summary.pendingCount}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Awaiting Check-in</div>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
            <div className="text-[11px] font-semibold text-rose-700 uppercase flex items-center justify-center gap-1">
              <XCircle className="w-3 h-3 text-rose-600" /> Absent
            </div>
            <div className="text-2xl font-bold text-rose-800 mt-1">{summary.absentCount}</div>
            <div className="text-[10px] text-rose-600 mt-0.5">Marked Absent</div>
          </div>
        </div>
      </div>

      {/* Selected Workers Attendance Table */}
      <Card className="overflow-hidden border-slate-200 shadow-xs">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Selected Workers Attendance ({workers.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Only confirmed staff appear in this list
          </span>
        </div>

        {workers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No workers have been selected or hired for this shift yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200/80">
                  <th className="py-3 px-6">Worker Name</th>
                  <th className="py-3 px-6">Attendance Status</th>
                  <th className="py-3 px-6">Method & Verification</th>
                  <th className="py-3 px-6">Check-in Time</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((item) => {
                  const isGpsVerified = item.status === 'present_gps';
                  const isMarked = item.status !== 'pending';

                  return (
                    <tr key={item.assignmentId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Worker info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 shrink-0">
                            {item.worker.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{item.worker.name}</div>
                            <div className="text-[11px] text-slate-500">{item.worker.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {getStatusBadge(item.status)}
                        {item.reason && (
                          <div className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                            "{item.reason}"
                          </div>
                        )}
                      </td>

                      {/* Method & Verification */}
                      <td className="py-4 px-6">
                        {item.method === 'GPS' ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-emerald-700 flex items-center gap-1">
                              <Navigation className="w-3 h-3" /> Geofence Verified
                            </span>
                            {item.distanceMeters !== null && (
                              <div className="text-[11px] text-slate-500">
                                ~{item.distanceMeters}m from venue
                              </div>
                            )}
                          </div>
                        ) : item.method === 'MANUAL' ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-blue-700 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Manual Record
                            </span>
                            {item.markedBy && (
                              <div className="text-[11px] text-slate-500">
                                By {item.markedBy.name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not recorded</span>
                        )}
                      </td>

                      {/* Check-in time */}
                      <td className="py-4 px-6 text-slate-600">
                        {item.checkedInAt ? (
                          <div>
                            <div className="font-medium text-slate-800">
                              {new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(item.checkedInAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {!isMarked ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenManualModal(item, 'present_manual')}
                                leftIcon={<CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              >
                                Mark Present
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenManualModal(item, 'absent_manual')}
                                className="text-rose-600 hover:bg-rose-50"
                                leftIcon={<XCircle className="w-3 h-3 text-rose-500" />}
                              >
                                Mark Absent
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleOpenManualModal(
                                    item,
                                    item.status === 'absent_manual' ? 'present_manual' : 'absent_manual',
                                    true
                                  )
                                }
                                leftIcon={<Edit3 className="w-3 h-3 text-slate-500" />}
                              >
                                Correct
                              </Button>
                            </>
                          )}

                          {item.attendanceId && (
                            <button
                              type="button"
                              onClick={() => handleViewAuditHistory(item)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="View Audit History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Manual Attendance & Correction Modal */}
      {manualModalOpen && selectedWorker && (
        <Modal
          isOpen={manualModalOpen}
          onClose={() => setManualModalOpen(false)}
          title={
            allowCorrection
              ? `Correct Attendance for ${selectedWorker.worker.name}`
              : `Manual Attendance: ${selectedWorker.worker.name}`
          }
        >
          <form onSubmit={handleSaveManualAttendance} className="space-y-4">
            {selectedWorker.status === 'present_gps' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">GPS Attendance Protection:</span> This worker has already
                  verified their attendance via GPS within 200m. Modifying this status will be recorded in the audit log.
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Attendance Status *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetStatus('present_manual')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    targetStatus === 'present_manual'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Present (Manual)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetStatus('absent_manual')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    targetStatus === 'absent_manual'
                      ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-500'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Absent (No-Show)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason / Documented Explanation *
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Worker was physically on site at 9:00 AM; phone battery died so could not check in via GPS."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                A documented reason is mandatory and will be permanently stored in the audit trail.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setManualModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                Confirm Attendance Record
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Audit History Modal */}
      {auditModalOpen && (
        <Modal
          isOpen={auditModalOpen}
          onClose={() => setAuditModalOpen(false)}
          title={`Attendance Audit Trail: ${auditWorkerName}`}
        >
          <div className="space-y-4">
            {loadingAudit ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading audit history...</div>
            ) : auditEntries.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No previous changes recorded for this worker.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {auditEntries.map((entry, idx) => (
                  <div
                    key={entry._id || idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 uppercase tracking-wider">
                        {entry.action.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400">
                        {new Date(entry.changedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-medium text-slate-500">Status change:</span>
                      <span className="line-through text-slate-400">{entry.previousStatus}</span>
                      <span>→</span>
                      <span className="font-semibold text-slate-900">{entry.newStatus}</span>
                    </div>

                    {entry.reason && (
                      <div className="text-slate-700 bg-white p-2 rounded-lg border border-slate-100 italic">
                        "{entry.reason}"
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1">
                      Recorded by:{' '}
                      <span className="font-medium text-slate-600">
                        {typeof entry.changedBy === 'object' ? entry.changedBy?.name : 'User'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button size="sm" variant="outline" onClick={() => setAuditModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

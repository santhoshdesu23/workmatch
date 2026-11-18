import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Building2,
  Compass
} from 'lucide-react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { AttendanceStatus } from '../../types';

interface ShiftAttendanceItem {
  assignmentId: string;
  job: {
    _id: string;
    title: string;
    locationName: string;
    location?: {
      coordinates: [number, number];
    };
    workDate: string;
    startTime: string;
    endTime: string;
    grossPay: number;
    payBasis: string;
  };
  employer: {
    _id: string;
    name: string;
    email: string;
  };
  status: AttendanceStatus;
  method: string | null;
  checkedInAt: string | null;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  reason: string;
  attendanceId: string | null;
}

export const WorkerAttendancePage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [shifts, setShifts] = useState<ShiftAttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Check-in modal state
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftAttendanceItem | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/my-history');
      if (res.data?.success && Array.isArray(res.data.history)) {
        setShifts(res.data.history);
      }
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Failed to load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleOpenCheckIn = (shift: ShiftAttendanceItem) => {
    setSelectedShift(shift);
    setCheckInError(null);
    setCheckInSuccess(null);
    setCurrentDistance(null);
    setCheckInModalOpen(true);
  };

  const handlePerformCheckIn = () => {
    if (!selectedShift || !selectedShift.job?._id) return;

    if (!navigator.geolocation) {
      setCheckInError('Geolocation is not supported by your browser. Please use a supported device.');
      return;
    }

    setIsLocating(true);
    setCheckInError(null);
    setCheckInSuccess(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        try {
          const res = await api.post('/attendance/check-in', {
            jobId: selectedShift.job._id,
            latitude,
            longitude,
            accuracy
          });

          if (res.data?.success) {
            setCheckInSuccess(res.data.message || 'Attendance marked successfully. Your GPS location has been verified.');
            setCurrentDistance(res.data.attendance?.distanceMeters || null);
            success('Attendance marked successfully!');
            fetchHistory();
          }
        } catch (err: any) {
          const resData = err?.response?.data;
          if (resData?.code === 'OUTSIDE_ATTENDANCE_RADIUS') {
            setCheckInError(resData.message);
            if (resData.distanceMeters) {
              setCurrentDistance(resData.distanceMeters);
            }
          } else if (resData?.code === 'POOR_GPS_ACCURACY') {
            setCheckInError(resData.message);
          } else if (resData?.code === 'ALREADY_CHECKED_IN') {
            setCheckInError(resData.message);
            fetchHistory();
          } else {
            setCheckInError(resData?.message || err.message || 'Failed to verify GPS check-in.');
          }
        } finally {
          setIsLocating(false);
        }
      },
      (geoError) => {
        setIsLocating(false);
        if (geoError.code === 1) {
          setCheckInError('Location permission is required to mark GPS attendance. Please enable location permissions in your browser and try again.');
        } else if (geoError.code === 2) {
          setCheckInError("We couldn't verify your exact location. Please try again in an area with a stronger GPS signal.");
        } else if (geoError.code === 3) {
          setCheckInError('GPS request timed out. Please try again.');
        } else {
          setCheckInError(`Geolocation error: ${geoError.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
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
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            Present – Manually Recorded
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Navigation className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900">Shift Attendance & GPS Check-in</h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              When arriving at your confirmed work location, click "Mark Attendance" to verify your arrival within the 200-metre venue radius.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              200m Attendance Geofence
            </span>
          </div>
        </div>
      </div>

      {/* Shifts List */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton rows={3} />
        </div>
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No confirmed shifts found"
          description="You don't have any confirmed shifts scheduled. Apply for jobs to get hired and record attendance."
          actionText="Find Work"
          onAction={() => {
            window.location.href = '/jobs';
          }}
        />
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => {
            const isPending = shift.status === 'pending';

            return (
              <Card
                key={shift.assignmentId}
                className="p-5 hover:border-emerald-300 transition-all shadow-xs border-slate-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-slate-900">{shift.job?.title || 'Scheduled Shift'}</h2>
                      {getStatusBadge(shift.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Employer: {shift.employer?.name || 'Local Employer'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{shift.job?.locationName || 'Venue location on file'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {shift.job?.workDate
                            ? new Date(shift.job.workDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'Date scheduled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{shift.job?.startTime || '09:00'} – {shift.job?.endTime || '17:00'}</span>
                      </div>
                    </div>

                    {shift.checkedInAt && (
                      <div className="text-[11px] text-slate-600 flex items-center gap-2 pt-1">
                        <span className="font-medium text-emerald-700">
                          Checked in at {new Date(shift.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {shift.distanceMeters !== null && (
                          <span className="text-slate-400">• ~{shift.distanceMeters}m from venue</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex items-center justify-end">
                    {isPending ? (
                      <Button
                        size="sm"
                        onClick={() => handleOpenCheckIn(shift)}
                        leftIcon={<Navigation className="w-3.5 h-3.5" />}
                      >
                        Mark Attendance
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Attendance Recorded
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* GPS Check-in Modal */}
      {checkInModalOpen && selectedShift && (
        <Modal
          isOpen={checkInModalOpen}
          onClose={() => setCheckInModalOpen(false)}
          title={`GPS Attendance Check-in`}
        >
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900">{selectedShift.job?.title || 'Scheduled Shift'}</div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{selectedShift.job?.locationName || 'Venue location on file'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Shift Hours: {selectedShift.job?.startTime || '09:00'} – {selectedShift.job?.endTime || '17:00'}</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold pt-1">
                Required Radius: Within 200 metres of the venue
              </div>
            </div>

            {/* Error banner */}
            {checkInError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Check-in Verification Failed</span>
                </div>
                <p>{checkInError}</p>
                {currentDistance !== null && (
                  <p className="text-[11px] text-rose-700 font-medium">
                    Your current distance from the venue: ~{currentDistance > 1000 ? (currentDistance / 1000).toFixed(1) + ' km' : currentDistance + ' m'}
                  </p>
                )}
              </div>
            )}

            {/* Success banner */}
            {checkInSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Attendance Verified</span>
                </div>
                <p>{checkInSuccess}</p>
                {currentDistance !== null && (
                  <p className="text-[11px] text-emerald-700">
                    Verified distance from venue: ~{currentDistance} metres.
                  </p>
                )}
              </div>
            )}

            {!checkInSuccess && (
              <div className="text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">How GPS Check-in Works:</p>
                <ul className="list-disc list-inside text-slate-500 space-y-1 text-[11px]">
                  <li>Ensure your device GPS / location services are turned ON.</li>
                  <li>Click "Verify GPS Location & Check In" below.</li>
                  <li>Allow the browser location prompt when requested.</li>
                  <li>Your device coordinates are verified against the confirmed venue location.</li>
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCheckInModalOpen(false)}
                disabled={isLocating}
              >
                {checkInSuccess ? 'Close' : 'Cancel'}
              </Button>
              {!checkInSuccess && (
                <Button
                  size="sm"
                  onClick={handlePerformCheckIn}
                  isLoading={isLocating}
                  leftIcon={<Compass className="w-4 h-4" />}
                >
                  Verify GPS Location & Check In
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

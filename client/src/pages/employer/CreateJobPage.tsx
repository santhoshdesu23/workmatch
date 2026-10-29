import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Navigation,
  Mail,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatPayWithBasis } from '../../utils/currency';
import {
  validateJobSchedule,
  getTodayDateString,
  formatCalendarDate
} from '../../utils/scheduleValidation';

export const CreateJobPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [resendVerifySent, setResendVerifySent] = useState(false);

  const handleResendVerification = async () => {
    setIsResendingVerify(true);
    try {
      const res = await api.post('/auth/resend-verification');
      if (res.data?.success) {
        setResendVerifySent(true);
        success('Verification email dispatched! Please check your inbox.');
      } else {
        toastError(res.data?.message || 'Failed to dispatch verification email.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to dispatch verification email.');
    } finally {
      setIsResendingVerify(false);
    }
  };

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Details
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Event assistance');
  const [customCategory, setCustomCategory] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Location & Schedule
  const [locationName, setLocationName] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number]>([-73.9851, 40.7484]); // Default NYC Midtown
  const [workDate, setWorkDate] = useState('');
  const [workEndDate, setWorkEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState<number>(30);
  const [totalHours, setTotalHours] = useState<number>(7.5);

  // Step 3: Requirements
  const [openings, setOpenings] = useState<number>(2);
  const [requiredSkills, setRequiredSkills] = useState('');
  const [experienceRequirement, setExperienceRequirement] = useState('No prior experience necessary, training provided on site');
  const [dressCode, setDressCode] = useState('Casual comfortable clothing, closed-toe shoes');
  const [physicalRequirements, setPhysicalRequirements] = useState('Standard physical mobility for role');
  const [ageRestriction, setAgeRestriction] = useState('18+');

  // Step 4: Pay & Terms
  const [grossPay, setGrossPay] = useState<number>(25);
  const [payBasis, setPayBasis] = useState<string>('hourly');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer / Platform Recorded');
  const [paymentTiming, setPaymentTiming] = useState('Same Day / Within 24 hours of completion');
  const [cancellationPolicy, setCancellationPolicy] = useState('Notice must be provided at least 12 hours prior to shift commencement');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);

  const categories = [
    'Event assistance',
    'Wedding and catering support',
    'Restaurant and hospitality',
    'Retail and store assistance',
    'Warehouse and packing',
    'Delivery and logistics',
    'Data entry and office assistance',
    'Cleaning and maintenance',
    'Tutoring and event staffing'
  ];
  const OTHER_CATEGORY_VALUE = 'OTHER';
  const OTHER_CATEGORY_LABEL = 'Other (Specify your category)';

  const resolvedCategory = selectedCategory === OTHER_CATEGORY_VALUE ? customCategory.trim() : selectedCategory;

  const todayDateStr = getTodayDateString();
  const effectiveEndDate = workEndDate || workDate;
  const scheduleValidation = validateJobSchedule({
    workDate,
    workEndDate: effectiveEndDate,
    startTime,
    endTime
  });

  const showWorkDateError = Boolean(
    (Boolean(workDate) || scheduleTouched) && scheduleValidation.errors.workDate
  );
  const showWorkEndDateError = Boolean(
    (Boolean(workEndDate) || scheduleTouched) && scheduleValidation.errors.workEndDate
  );
  const showStartTimeError = Boolean(
    (Boolean(workDate) || scheduleTouched || !startTime) && scheduleValidation.errors.startTime
  );
  const showEndTimeError = Boolean(
    (Boolean(workDate) || scheduleTouched || Boolean(scheduleValidation.errors.endTime)) &&
      scheduleValidation.errors.endTime
  );
  const hasVisibleScheduleError =
    showWorkDateError || showWorkEndDateError || showStartTimeError || showEndTimeError;

  const handleWorkDateChange = (newStartDate: string) => {
    setScheduleTouched(true);
    setWorkDate(newStartDate);
    if (!workEndDate || workEndDate === workDate || (newStartDate && workEndDate < newStartDate)) {
      setWorkEndDate(newStartDate);
    }
  };

  const handleWorkEndDateChange = (newEndDate: string) => {
    setScheduleTouched(true);
    setWorkEndDate(newEndDate);
  };

  const handleStartTimeChange = (newStartTime: string) => {
    setScheduleTouched(true);
    setStartTime(newStartTime);
  };

  const handleEndTimeChange = (newEndTime: string) => {
    setScheduleTouched(true);
    setEndTime(newEndTime);
  };

  const handleUseBrowserGPS = () => {
    if (!navigator.geolocation) {
      toastError('Geolocation not supported in browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates([pos.coords.longitude, pos.coords.latitude]);
        if (!locationName) {
          setLocationName(`Current Business GPS (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`);
        }
        success('Coordinates fetched from device.');
      },
      (err) => toastError(err.message)
    );
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!title.trim() || title.length < 5) {
        toastError('Please provide a clear job title (at least 5 characters).');
        return false;
      }
      if (selectedCategory === OTHER_CATEGORY_VALUE) {
        const trimmedCustom = customCategory.trim();
        if (!trimmedCustom) {
          setCategoryError('Please enter your custom job category.');
          toastError('Please enter your custom job category.');
          return false;
        }
        if (trimmedCustom.length > 60) {
          setCategoryError('Job category cannot exceed 60 characters.');
          toastError('Job category cannot exceed 60 characters.');
          return false;
        }
      }
      if (!description.trim() || description.length < 15) {
        toastError('Please provide a descriptive role description (at least 15 characters).');
        return false;
      }
    } else if (step === 2) {
      setScheduleTouched(true);
      if (!locationName.trim()) {
        toastError('Please specify the work address or venue location.');
        return false;
      }
      const currentScheduleCheck = validateJobSchedule({
        workDate,
        workEndDate: workEndDate || workDate,
        startTime,
        endTime
      });
      if (!currentScheduleCheck.isValid) {
        toastError(currentScheduleCheck.error || 'Please provide a valid future work schedule.');
        return false;
      }
      if (totalHours <= 0) {
        toastError('Total hours must be greater than zero.');
        return false;
      }
    } else if (step === 3) {
      if (openings < 1) {
        toastError('Number of openings must be at least 1.');
        return false;
      }
      if (!requiredSkills.trim()) {
        toastError('Please enter at least one prerequisite skill.');
        return false;
      }
    } else if (step === 4) {
      if (grossPay <= 0) {
        toastError('Offered pay amount must be greater than ₹0.');
        return false;
      }
      if (!applicationDeadline) {
        setApplicationDeadline(workDate);
      } else if (formatCalendarDate(applicationDeadline) > formatCalendarDate(workDate)) {
        toastError('Application deadline cannot be after the scheduled work date.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(5, s + 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const handlePublish = async () => {
    if (user && !user.emailVerified) {
      toastError('Email verification is required before you can publish shifts. Please verify your email address.');
      return;
    }

    const currentScheduleCheck = validateJobSchedule({
      workDate,
      workEndDate: workEndDate || workDate,
      startTime,
      endTime
    });
    if (!currentScheduleCheck.isValid) {
      setScheduleTouched(true);
      toastError(currentScheduleCheck.error || 'Work schedule is invalid. Please update the shift dates and times.');
      return;
    }

    if (!detailsConfirmed) {
      toastError('Please check the confirmation box to confirm that the displayed shift details are accurate and binding.');
      return;
    }

    setIsSubmitting(true);
    try {
      const skillsArray = requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await api.post('/jobs', {
        title,
        description,
        category: resolvedCategory,
        locationName,
        coordinates,
        workDate,
        workEndDate: workEndDate || workDate,
        startTime,
        endTime,
        breakDurationMinutes,
        totalHours,
        openings,
        requiredSkills: skillsArray,
        experienceRequirement,
        dressCode,
        physicalRequirements,
        ageRestriction,
        grossPay,
        payBasis,
        currency: 'INR',
        paymentMethod,
        paymentTiming,
        cancellationPolicy,
        applicationDeadline: applicationDeadline || workDate,
        detailsConfirmed: true,
        status: 'OPEN'
      });

      if (res.data?.success) {
        success('Shift published successfully! Open for worker discovery.');
        navigate('/employer/jobs');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to publish shift.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep2ContinueDisabled = currentStep === 2 && !scheduleValidation.isValid;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Wizard Progress Bar */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create & Publish Shift</h1>
        <p className="text-xs text-slate-500">Step {currentStep} of 5 — Complete all transparent shift terms.</p>

        <div className="grid grid-cols-5 gap-2 mt-4">
          {['Job Details', 'Schedule', 'Requirements', 'Pay & Terms', 'Preview'].map((st, idx) => (
            <div key={st} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  currentStep >= idx + 1 ? 'bg-emerald-600' : 'bg-slate-200'
                }`}
              />
              <span className="text-[10px] font-semibold text-slate-500 hidden sm:block truncate">
                {st}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Details */}
      {currentStep === 1 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Step 1: Role Overview
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Shift / Job Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Banquet Check-in & Registration Assistant"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="job-category-select" className="block text-xs font-semibold text-slate-700 mb-1">Job Category *</label>
            <select
              id="job-category-select"
              value={selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCategory(val);
                if (val !== OTHER_CATEGORY_VALUE) {
                  setCustomCategory('');
                  setCategoryError('');
                }
              }}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={OTHER_CATEGORY_VALUE}>{OTHER_CATEGORY_LABEL}</option>
            </select>
          </div>

          {selectedCategory === OTHER_CATEGORY_VALUE && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label htmlFor="custom-category-input" className="block text-xs font-semibold text-slate-700">
                  Enter your job category *
                </label>
                <span className="text-[10px] text-slate-400">{customCategory.length}/60</span>
              </div>
              <input
                id="custom-category-input"
                name="customCategory"
                type="text"
                required
                maxLength={60}
                value={customCategory}
                onChange={(e) => {
                  setCustomCategory(e.target.value);
                  if (categoryError) setCategoryError('');
                }}
                placeholder="e.g., Wedding Photography, Home Tutor, Farm Worker, Delivery Partner"
                className={`w-full text-xs p-2.5 border rounded-xl focus:outline-none focus:ring-1 transition-colors ${
                  categoryError
                    ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-emerald-500'
                }`}
              />
              {categoryError && (
                <p id="custom-category-error" className="text-[11px] text-rose-600 font-medium">
                  {categoryError}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Shift Responsibilities *</label>
            <textarea
              rows={5}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the duties clearly: greeting guests, scanning badges, physical tasks, expectations..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </Card>
      )}

      {/* Step 2: Location and Schedule */}
      {currentStep === 2 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Step 2: Location & Working Hours
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Venue or Shift Work Address *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Javits Center, 429 11th Ave, New York, NY"
                className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleUseBrowserGPS} leftIcon={<Navigation className="w-3.5 h-3.5" />}>
                GPS
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="work-start-date" className="block text-xs font-semibold text-slate-700">
                Work Start Date *
              </label>
              <input
                id="work-start-date"
                type="date"
                required
                min={todayDateStr}
                value={workDate}
                onChange={(e) => handleWorkDateChange(e.target.value)}
                className={`w-full text-xs p-2.5 border rounded-xl focus:outline-none focus:ring-1 transition-colors ${
                  showWorkDateError
                    ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-emerald-500'
                }`}
              />
              {showWorkDateError && (
                <p id="work-start-date-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {scheduleValidation.errors.workDate}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="work-start-time" className="block text-xs font-semibold text-slate-700">
                Start Time *
              </label>
              <input
                id="work-start-time"
                type="time"
                required
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={`w-full text-xs p-2.5 border rounded-xl focus:outline-none focus:ring-1 transition-colors ${
                  showStartTimeError
                    ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-emerald-500'
                }`}
              />
              {showStartTimeError && (
                <p id="work-start-time-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {scheduleValidation.errors.startTime}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="work-end-date" className="block text-xs font-semibold text-slate-700">
                Work End Date *
              </label>
              <input
                id="work-end-date"
                type="date"
                required
                min={workDate || todayDateStr}
                value={effectiveEndDate}
                onChange={(e) => handleWorkEndDateChange(e.target.value)}
                className={`w-full text-xs p-2.5 border rounded-xl focus:outline-none focus:ring-1 transition-colors ${
                  showWorkEndDateError
                    ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-emerald-500'
                }`}
              />
              {showWorkEndDateError ? (
                <p id="work-end-date-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {scheduleValidation.errors.workEndDate}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Defaults to start date. Select the next day for overnight shifts.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="work-end-time" className="block text-xs font-semibold text-slate-700">
                End Time *
              </label>
              <input
                id="work-end-time"
                type="time"
                required
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className={`w-full text-xs p-2.5 border rounded-xl focus:outline-none focus:ring-1 transition-colors ${
                  showEndTimeError
                    ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-emerald-500'
                }`}
              />
              {showEndTimeError && (
                <p id="work-end-time-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {scheduleValidation.errors.endTime}
                </p>
              )}
            </div>
          </div>

          {hasVisibleScheduleError && scheduleValidation.error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{scheduleValidation.error}</span>
            </div>
          )}

          {scheduleValidation.isValid && scheduleValidation.isOvernight && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
              Overnight shift scheduled: begins on {workDate} at {startTime} and ends on {effectiveEndDate} at {endTime} ({scheduleValidation.durationHours} hrs).
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Meal / Rest Break (minutes)</label>
              <input
                type="number"
                min="0"
                value={breakDurationMinutes}
                onChange={(e) => setBreakDurationMinutes(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Billable Hours</label>
              <input
                type="number"
                step="0.25"
                min="0.5"
                value={totalHours}
                onChange={(e) => setTotalHours(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Requirements */}
      {currentStep === 3 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Step 3: Worker Requirements
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Openings (Staff Needed) *</label>
              <input
                type="number"
                min="1"
                required
                value={openings}
                onChange={(e) => setOpenings(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Age Restriction</label>
              <input
                type="text"
                value={ageRestriction}
                onChange={(e) => setAgeRestriction(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Required Skills (Comma separated) *</label>
            <input
              type="text"
              required
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              placeholder="e.g. Guest Registration, Food Handling, Box Packing"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dress Code Requirements</label>
            <input
              type="text"
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
              placeholder="e.g. Plain black polo shirt, black trousers, non-slip shoes"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Experience Requirement</label>
              <input
                type="text"
                value={experienceRequirement}
                onChange={(e) => setExperienceRequirement(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Requirements</label>
              <input
                type="text"
                value={physicalRequirements}
                onChange={(e) => setPhysicalRequirements(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Pay & Terms */}
      {currentStep === 4 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Step 4: Compensation & Terms
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gross Pay Amount (₹) *</label>
              <input
                type="number"
                min="1"
                required
                value={grossPay}
                onChange={(e) => setGrossPay(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Basis *</label>
              <select
                value={payBasis}
                onChange={(e) => setPayBasis(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
              >
                <option value="hourly">Hourly (₹/hr)</option>
                <option value="daily">Daily Flat Rate</option>
                <option value="shift">Shift-based Flat Rate</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method Label</label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Payment Timing</label>
              <input
                type="text"
                value={paymentTiming}
                onChange={(e) => setPaymentTiming(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation Policy</label>
            <textarea
              rows={2}
              value={cancellationPolicy}
              onChange={(e) => setCancellationPolicy(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Application Deadline</label>
            <input
              type="date"
              value={applicationDeadline}
              onChange={(e) => setApplicationDeadline(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>
        </Card>
      )}

      {/* Step 5: Preview & Publish */}
      {currentStep === 5 && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Step 5: Shift Preview</h2>
              <p className="text-xs text-slate-500">Confirm all details before publishing to marketplace</p>
            </div>
            <Badge variant={scheduleValidation.isValid ? 'emerald' : 'amber'}>
              {scheduleValidation.isValid ? 'Ready to Publish' : 'Schedule Needs Update'}
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <Badge variant="emerald" size="sm">{resolvedCategory}</Badge>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{title}</h3>
              <p className="text-xs text-slate-600 mt-2 whitespace-pre-line leading-relaxed">{description}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="text-slate-400 block">Work Date</span>
                <span className="font-bold text-slate-800">
                  {effectiveEndDate && effectiveEndDate !== workDate
                    ? `${workDate} → ${effectiveEndDate}`
                    : workDate}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Hours</span>
                <span className="font-bold text-slate-800">{startTime} – {endTime}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Offered Pay</span>
                <span className="font-bold text-emerald-700">{formatPayWithBasis(grossPay, payBasis)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Openings</span>
                <span className="font-bold text-slate-800">{openings} workers</span>
              </div>
            </div>

            {!scheduleValidation.isValid && scheduleValidation.error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{scheduleValidation.error}</span>
              </div>
            )}

            <div className="text-xs space-y-1 text-slate-600">
              <div><strong>Location:</strong> {locationName}</div>
              <div><strong>Required Skills:</strong> {requiredSkills}</div>
              <div><strong>Dress Code:</strong> {dressCode}</div>
              <div><strong>Payment Terms:</strong> {paymentMethod} ({paymentTiming})</div>
            </div>

            {/* TrustTrack Explicit Confirmation Card */}
            <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-xs text-slate-800 space-y-2 mt-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirm-details-accuracy"
                  checked={detailsConfirmed}
                  onChange={(e) => setDetailsConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="confirm-details-accuracy" className="leading-relaxed cursor-pointer select-none">
                  <span className="font-bold text-emerald-950 block mb-0.5">
                    TrustTrack Employer Commitment & Accuracy Confirmation
                  </span>
                  I explicitly confirm that all shift timing, compensation rate, location, duties, and physical requirements stated above are accurate, guaranteed, and binding. I acknowledge that any material change will be recorded in public job history and applicants will be notified.
                </label>
              </div>
              <p className="text-[11px] text-slate-500 pl-7">
                * Note: Confirming shift details certifies commitment to this listing. Platform identity verification is evaluated separately.
              </p>
            </div>

            {user && !user.emailVerified && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2.5 mt-4">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                  <Mail className="w-4 h-4 text-amber-700" />
                  <span>Email Verification Required Before Publishing</span>
                </div>
                <p className="leading-relaxed">
                  You cannot publish jobs to the marketplace until your employer email (<strong>{user.email}</strong>) is verified.
                </p>
                {resendVerifySent ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Verification link dispatched! Please check your inbox.</span>
                  </div>
                ) : (
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-900 hover:bg-amber-100"
                      onClick={handleResendVerification}
                      isLoading={isResendingVerify}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Resend Verification Email
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-2">
        {currentStep > 1 ? (
          <Button type="button" variant="outline" size="sm" onClick={prevStep} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back
          </Button>
        ) : <div />}

        {currentStep < 5 ? (
          <Button
            type="button"
            size="sm"
            disabled={isStep2ContinueDisabled}
            onClick={nextStep}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={Boolean(user && !user.emailVerified) || !detailsConfirmed || !scheduleValidation.isValid}
            isLoading={isSubmitting}
            onClick={handlePublish}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            {user && !user.emailVerified
              ? 'Email Verification Required to Publish'
              : !scheduleValidation.isValid
              ? 'Valid Schedule Required to Publish'
              : !detailsConfirmed
              ? 'Confirm Shift Details to Publish'
              : 'Publish Shift to Marketplace'}
          </Button>
        )}
      </div>
    </div>
  );
};

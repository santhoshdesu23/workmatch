export type Role = 'worker' | 'employer' | 'admin';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: Role;
  roles?: Role[];
  activeRole?: Role;
  emailVerified: boolean;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  accountStatus?: 'active' | 'suspended' | 'pending';
  lastLogin?: string;
  profile?: WorkerProfile | EmployerProfile | null;
  workerProfile?: WorkerProfile | null;
  employerProfile?: EmployerProfile | null;
}

export interface WorkerProfile {
  _id?: string;
  user: string;
  bio?: string;
  skills: string[];
  experienceSummary?: string;
  preferredCategories: string[];
  preferredLocationName?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  travelRadiusKm: number;
  availability: {
    isAvailable: boolean;
    days: string[];
    timeSlots: string[];
  };
  expectedPay: {
    min: number;
    max: number;
    basis: 'hourly' | 'daily' | 'shift' | 'task';
  };
  languages: string[];
  verificationStatus: string;
  rating?: {
    average: number;
    count: number;
  };
  completedJobsCount: number;
  savedJobs?: (string | Job)[];
}

export interface EmployerProfile {
  _id?: string;
  user: string;
  businessName: string;
  description?: string;
  businessCategory?: string;
  businessAddress?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  publicContact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  rating?: {
    average: number;
    count: number;
  };
  totalJobsPosted: number;
  totalHiredWorkers: number;
}

export interface Job {
  _id: string;
  employer: {
    _id: string;
    name: string;
    email?: string;
    verificationStatus?: string;
  };
  employerProfile?: {
    businessName: string;
    description?: string;
    businessAddress?: string;
    verificationStatus: string;
    rating?: { average: number; count: number };
    publicContact?: { phone?: string; email?: string; website?: string };
  };
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  openings: number;
  filledCount: number;
  locationName: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  isDemo?: boolean;
  seedId?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  workDate: string;
  workEndDate?: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  totalHours: number;
  grossPay: number;
  payBasis: 'hourly' | 'daily' | 'shift' | 'task';
  currency: string;
  paymentMethod: string;
  paymentTiming: string;
  experienceRequirement: string;
  dressCode: string;
  physicalRequirements: string;
  ageRestriction: string;
  applicationDeadline: string;
  cancellationPolicy: string;
  attendanceRadiusMeters?: number;
  coordinatesConfirmed?: boolean;
  status: 'DRAFT' | 'OPEN' | 'FILLED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  isDeadlinePassed?: boolean;
  isWorkEnded?: boolean;
  isWorkOngoing?: boolean;
  effectiveStatus?: string;
  detailsConfirmed?: boolean;
  detailsConfirmedAt?: string;
  detailsConfirmedBy?: string;
  employerReliability?: EmployerReliability;
  changeHistoryCount?: number;
  viewsCount?: number;
  applicationsCount?: number;
  distanceKm?: number | null;
  distanceReliability?: 'exact' | 'approximate' | 'unknown';
  matchType?: 'exact' | 'strong' | 'partial';
  matchedRequirements?: string[];
  missingOptionalSkills?: string[];
  preferenceDifferences?: string[];
  matchData?: MatchData | null;
  userApplication?: Application | null;
  isSaved?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MatchData {
  matchScore: number;
  weights: {
    SKILLS: number;
    LOCATION: number;
    AVAILABILITY: number;
    PAYMENT: number;
    CATEGORY_EXPERIENCE: number;
  };
  componentScores: {
    skills: number;
    location: number;
    availability: number;
    payment: number;
    categoryExperience: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  distanceKm: number | null;
  dataCompleteness: number;
  explanations: string[];
  warnings: string[];
  evaluatedAt: string;
}

export interface Application {
  _id: string;
  job: Job | string;
  worker: {
    _id: string;
    name: string;
    email: string;
    verificationStatus?: string;
    lastLogin?: string;
  };
  workerProfile?: WorkerProfile;
  matchData?: MatchData;
  status: 'APPLIED' | 'SHORTLISTED' | 'OFFERED' | 'ACCEPTED' | 'HIRED' | 'REJECTED' | 'WITHDRAWN' | 'COMPLETED' | 'CANCELLED';
  message: string;
  offerDetails?: {
    offeredAt?: string;
    note?: string;
    expiresAt?: string;
  };
  decisionHistory: Array<{
    status: string;
    note?: string;
    changedBy?: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  _id: string;
  job: Job;
  worker: {
    _id: string;
    name: string;
    email: string;
    verificationStatus?: string;
  };
  employer: {
    _id: string;
    name: string;
    email: string;
  };
  application: string;
  agreedSchedule: {
    workDate: string;
    workEndDate?: string;
    startTime: string;
    endTime: string;
    totalHours: number;
  };
  agreedPayment: {
    grossAmount: number;
    currency: string;
    basis: string;
  };
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  attendance?: {
    checkedInAt?: string;
    checkedOutAt?: string;
    notes?: string;
  };
  completionConfirmations: {
    workerConfirmed: boolean;
    workerConfirmedAt?: string;
    employerConfirmed: boolean;
    employerConfirmedAt?: string;
  };
  payment?: PaymentRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProof {
  _id?: string;
  fileId: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface PaymentRecord {
  _id: string;
  assignment: string;
  job: Job | { _id: string; title: string; workDate: string; totalHours: number; payBasis?: string };
  worker: { _id: string; name: string; email: string };
  employer: { _id: string; name: string; email: string };
  amount: number;
  currency: string;
  basis: string;
  status: 'NOT_DUE' | 'DUE' | 'PROCESSING' | 'PAID' | 'DISPUTED' | 'CANCELLED';
  expectedDate?: string;
  paymentMethod: string;
  providerReference?: string;
  verificationSource?: 'employer_recorded' | 'worker_confirmed' | 'provider_verified';
  workerConfirmedReceipt?: boolean;
  workerConfirmedReceiptAt?: string;
  notes?: string;
  proofs?: PaymentProof[];
  history?: Array<{
    status: string;
    note?: string;
    updatedBy?: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentRecordItem = PaymentRecord;

export interface Review {
  _id: string;
  assignment: string | Assignment;
  reviewer: { _id: string; name: string };
  reviewee: { _id: string; name: string };
  rating: number;
  reviewText: string;
  status: 'published' | 'flagged' | 'hidden';
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface JobChangeHistoryItem {
  _id: string;
  job: string;
  actor: {
    _id: string;
    name: string;
    role: string;
  };
  actorRole: 'employer' | 'admin';
  changedFields: string[];
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    isMaterial: boolean;
  }>;
  isMaterial: boolean;
  reason?: string;
  createdAt: string;
}

export interface EmployerReliability {
  employerId: string;
  businessName: string;
  identityVerificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected' | string;
  hasSufficientHistory: boolean;
  minimumThresholdRequired: number;
  metrics: {
    completedAssignments: number;
    totalInitiatedAssignments: number;
    employerCancellations: number;
    completionRate: number | null;
    cancellationRate: number | null;
    substantiatedMismatches: number;
    ratingAverage: number;
    ratingCount: number;
  };
  explanations: {
    completionRate: string;
    cancellationRate: string;
    substantiatedMismatches: string;
    rating: string;
    identityVerificationNotice: string;
  };
}

export interface ReportItem {
  _id: string;
  reporter: { _id: string; name: string; email: string };
  reportedUser?: { _id: string; name: string; email: string };
  reportedJob?: { _id: string; title: string };
  category: string;
  description: string;
  evidence?: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  substantiated?: boolean;
  resolutionNotes?: string;
  createdAt: string;
}

export interface VerificationItem {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
    verificationStatus: string;
  };
  verificationType: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedData?: {
    businessName?: string;
    registrationNumber?: string;
    documentType?: string;
  };
  reviewNotes?: string;
  createdAt: string;
}

export interface MixedMatchResults {
  exact: Job[];
  strong: Job[];
  partial: Job[];
}

export interface MixedMatchCounts {
  exact: number;
  strong: number;
  partial: number;
  total: number;
}

export interface AppliedRequirement {
  field: string;
  value: any;
  type: 'HARD' | 'SOFT';
  source: 'UI_FILTER' | 'NLP_QUERY' | 'WORKER_PROFILE' | 'SEARCH_KEYWORD' | 'SAFETY_CONDITION' | 'EMPLOYER_MANDATORY';
}

export type AttendanceStatus = 'pending' | 'present_gps' | 'present_manual' | 'absent_manual';
export type AttendanceMethod = 'GPS' | 'MANUAL';

export interface AttendanceAuditEntry {
  _id?: string;
  action: 'CHECK_IN' | 'MANUAL_PRESENT' | 'MANUAL_ABSENT' | 'CORRECTION';
  previousStatus?: string;
  newStatus: string;
  changedBy: {
    _id?: string;
    name?: string;
    role?: string;
    email?: string;
  } | string;
  reason?: string;
  changedAt: string;
  metadata?: any;
}

export interface Attendance {
  _id?: string;
  id?: string;
  job: string | Job;
  worker: string | User;
  employer: string | User;
  assignment: string | Assignment;
  status: AttendanceStatus;
  method?: AttendanceMethod | null;
  checkInCoordinates?: {
    latitude: number;
    longitude: number;
  };
  accuracyMeters?: number | null;
  distanceMeters?: number | null;
  checkedInAt?: string | null;
  markedBy?: {
    _id?: string;
    name?: string;
    role?: string;
  } | string | null;
  reason?: string;
  auditHistory?: AttendanceAuditEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface JobAttendanceWorkerItem {
  assignmentId: string;
  worker: {
    _id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    verificationStatus?: string;
  };
  status: AttendanceStatus;
  method?: AttendanceMethod | null;
  checkedInAt?: string | null;
  distanceMeters?: number | null;
  accuracyMeters?: number | null;
  reason?: string;
  markedBy?: {
    _id?: string;
    name?: string;
    role?: string;
  } | null;
  attendanceId?: string | null;
  auditHistoryCount?: number;
}

export interface JobAttendanceDetailResponse {
  job: {
    id: string;
    title: string;
    locationName: string;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
    workDate: string;
    workEndDate?: string;
    startTime: string;
    endTime: string;
    attendanceRadiusMeters: number;
    coordinatesConfirmed?: boolean;
  };
  summary: {
    totalSelected: number;
    presentCount: number;
    presentGpsCount: number;
    presentManualCount: number;
    absentCount: number;
    pendingCount: number;
  };
  workers: JobAttendanceWorkerItem[];
}

// Admin Management Types
export interface AdminDashboardStats {
  totalUsers: number;
  totalWorkers: number;
  totalEmployers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  totalAssignments: number;
  selectedWorkers: number;
  fillRate: number;
  openReports: number;
  pendingVerifications: number;
  totalAttendance: number;
  gpsAttendance: number;
  manualAttendance: number;
}

export interface AdminTrendItem {
  date: string;
  total: number;
  workers?: number;
  employers?: number;
  open?: number;
  filled?: number;
  expired?: number;
  selected?: number;
  rejected?: number;
}

export interface AdminCategoryStat {
  category: string;
  count: number;
}

export interface AdminCityStat {
  city: string;
  count: number;
}

export interface AdminAuditLog {
  _id: string;
  actor: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AdminSettingsConfig {
  allowedCategories: string[];
  moderationRules: {
    autoFlagExcessivePay: boolean;
    maxHourlyRateINR: number;
    maxPerShiftRateINR: number;
    requireJobApproval: boolean;
  };
  attendanceConfig: {
    maxGeofenceMeters: number;
    allowEmployerManualMarking: boolean;
  };
  platformBanner: {
    enabled: boolean;
    message: string;
    type: 'info' | 'warning' | 'alert';
  };
}

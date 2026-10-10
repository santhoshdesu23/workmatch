export const ROLES = {
  WORKER: 'worker',
  EMPLOYER: 'employer',
  ADMIN: 'admin'
};

export const JOB_STATUSES = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  FILLED: 'FILLED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

export const APPLICATION_STATUSES = {
  APPLIED: 'APPLIED',
  SHORTLISTED: 'SHORTLISTED',
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const ASSIGNMENT_STATUSES = {
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW'
};

export const PAYMENT_STATUSES = {
  NOT_DUE: 'NOT_DUE',
  DUE: 'DUE',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED'
};

export const PAYMENT_BASES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  SHIFT: 'shift',
  TASK: 'task'
};

export const JOB_CATEGORIES = [
  'Event assistance',
  'Wedding and catering support',
  'Restaurant and hospitality',
  'Retail and store assistance',
  'Warehouse and packing',
  'Delivery and logistics',
  'Data entry and office assistance',
  'Cleaning and maintenance',
  'Tutoring and event staffing',
  'Other lawful temporary work'
];

export const MATCH_WEIGHTS = {
  SKILLS: 0.30,
  LOCATION: 0.25,
  AVAILABILITY: 0.20,
  PAYMENT: 0.15,
  CATEGORY_EXPERIENCE: 0.10
};

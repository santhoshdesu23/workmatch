import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import { User } from './models/User.js';
import { WorkerProfile } from './models/WorkerProfile.js';
import { EmployerProfile } from './models/EmployerProfile.js';
import { Job } from './models/Job.js';
import { Application } from './models/Application.js';
import { Assignment } from './models/Assignment.js';
import { PaymentRecord } from './models/PaymentRecord.js';
import { Review } from './models/Review.js';
import { Notification } from './models/Notification.js';
import { Report } from './models/Report.js';
import { VerificationRequest } from './models/VerificationRequest.js';
import {
  ROLES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  ASSIGNMENT_STATUSES,
  PAYMENT_STATUSES,
  JOB_CATEGORIES
} from './config/constants.js';

export async function runSeed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  console.log('[Seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    WorkerProfile.deleteMany({}),
    EmployerProfile.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
    Assignment.deleteMany({}),
    PaymentRecord.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
    Report.deleteMany({}),
    VerificationRequest.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);

  console.log('[Seed] Creating demo users...');
  // 1. Admin
  const admin = await User.create({
    name: 'WorkMatch Administrator',
    email: 'admin@workmatch.demo',
    passwordHash: adminPasswordHash,
    role: ROLES.ADMIN,
    accountStatus: 'active',
    emailVerified: true,
    verificationStatus: 'verified'
  });

  // 2. Employers
  const employer1User = await User.create({
    name: 'Sarah Jenkins',
    email: 'employer@workmatch.demo',
    passwordHash,
    role: ROLES.EMPLOYER,
    accountStatus: 'active',
    emailVerified: true,
    verificationStatus: 'verified'
  });

  const employer1Profile = await EmployerProfile.create({
    user: employer1User._id,
    businessName: 'Apex Event Staffing & Banquets',
    description: 'Premier temporary event hospitality, catering logistics, and corporate banquet operations.',
    businessCategory: 'Event and Hospitality Logistics',
    businessAddress: '450 Lexington Ave, New York, NY 10017',
    location: {
      type: 'Point',
      coordinates: [-73.9749, 40.7527] // NYC Midtown
    },
    publicContact: {
      phone: '+1 (555) 234-5678',
      email: 'contact@apexevents.demo',
      website: 'https://apexevents.demo'
    },
    verificationStatus: 'verified',
    rating: { average: 4.8, count: 12 },
    totalJobsPosted: 4,
    totalHiredWorkers: 8
  });

  const employer2User = await User.create({
    name: 'Marcus Chen',
    email: 'employer2@workmatch.demo',
    passwordHash,
    role: ROLES.EMPLOYER,
    accountStatus: 'active',
    emailVerified: true,
    verificationStatus: 'verified'
  });

  const employer2Profile = await EmployerProfile.create({
    user: employer2User._id,
    businessName: 'Metro Dispatch Logistics Co.',
    description: 'Regional packaging fulfillment and warehouse distribution support across the metro area.',
    businessCategory: 'Warehouse and Logistics',
    businessAddress: '120 Broadway, New York, NY 10271',
    location: {
      type: 'Point',
      coordinates: [-74.011, 40.708] // NYC Lower Manhattan
    },
    publicContact: {
      phone: '+1 (555) 876-5432',
      email: 'ops@metrodispatch.demo',
      website: 'https://metrodispatch.demo'
    },
    verificationStatus: 'verified',
    rating: { average: 4.6, count: 8 },
    totalJobsPosted: 3,
    totalHiredWorkers: 5
  });

  // 3. Workers
  const worker1User = await User.create({
    name: 'Alex Rivera',
    email: 'worker@workmatch.demo',
    passwordHash,
    role: ROLES.WORKER,
    accountStatus: 'active',
    emailVerified: true,
    verificationStatus: 'verified'
  });

  const worker1Profile = await WorkerProfile.create({
    user: worker1User._id,
    bio: 'Experienced event setup specialist, hospitality server, and warehouse packing associate. Dependable and prompt.',
    skills: ['Guest Registration', 'Catering Setup', 'Customer Service', 'Food Handling', 'Inventory Sorting'],
    experienceSummary: '3 years of flexible part-time event staffing, banquet service, and retail holiday shifts.',
    preferredCategories: ['Event assistance', 'Wedding and catering support', 'Restaurant and hospitality'],
    preferredLocationName: 'Manhattan & Brooklyn, NY',
    location: {
      type: 'Point',
      coordinates: [-73.9851, 40.7484] // Empire State Building area
    },
    travelRadiusKm: 20,
    availability: {
      isAvailable: true,
      days: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
      timeSlots: ['Morning', 'Afternoon', 'Evening']
    },
    expectedPay: { min: 22, max: 35, basis: 'hourly' },
    languages: ['English', 'Spanish'],
    verificationStatus: 'verified',
    rating: { average: 4.9, count: 9 },
    completedJobsCount: 7
  });

  const worker2User = await User.create({
    name: 'Jordan Taylor',
    email: 'worker2@workmatch.demo',
    passwordHash,
    role: ROLES.WORKER,
    accountStatus: 'active',
    emailVerified: true,
    verificationStatus: 'verified'
  });

  const worker2Profile = await WorkerProfile.create({
    user: worker2User._id,
    bio: 'Fast learner, college student seeking weekend and evening shifts in retail support, warehouse sorting, and data entry.',
    skills: ['Box Packing', 'Barcode Scanning', 'Stock Replenishment', 'Basic POS Operation', 'Data Entry'],
    experienceSummary: 'Experienced in fulfillment centers and seasonal campus bookstore inventory.',
    preferredCategories: ['Warehouse and packing', 'Retail and store assistance', 'Delivery and logistics'],
    preferredLocationName: 'Downtown Brooklyn, NY',
    location: {
      type: 'Point',
      coordinates: [-73.989, 40.693] // Downtown Brooklyn
    },
    travelRadiusKm: 15,
    availability: {
      isAvailable: true,
      days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'],
      timeSlots: ['Morning', 'Afternoon']
    },
    expectedPay: { min: 20, max: 28, basis: 'hourly' },
    languages: ['English'],
    verificationStatus: 'verified',
    rating: { average: 4.7, count: 5 },
    completedJobsCount: 4
  });

  console.log('[Seed] Creating demo temporary jobs...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  tomorrow.setHours(9, 0, 0, 0);

  const thisWeekend = new Date();
  thisWeekend.setDate(thisWeekend.getDate() + 4);
  thisWeekend.setHours(17, 0, 0, 0);

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 3);
  pastDate.setHours(10, 0, 0, 0);

  // Job 1: Open Event Hospitality
  const job1 = await Job.create({
    employer: employer1User._id,
    title: 'Banquet Guest Check-in & Registration Assistant',
    description: 'Welcome arriving conference guests, check badges, verify RSVPs on provided tablets, and direct attendees to main hall seats. Professional casual attire required.',
    category: 'Event assistance',
    requiredSkills: ['Guest Registration', 'Customer Service', 'Hospitality'],
    openings: 3,
    filledCount: 1,
    locationName: 'Javits Center, 429 11th Ave, New York, NY 10001',
    location: {
      type: 'Point',
      coordinates: [-74.002, 40.757] // Javits Center
    },
    workDate: tomorrow,
    startTime: '08:30',
    endTime: '16:30',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 26,
    payBasis: 'hourly',
    currency: 'USD',
    paymentMethod: 'Direct Deposit / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Comfortable interacting politely with corporate attendees',
    dressCode: 'Dark dress slacks, plain black shirt or blouse, comfortable closed-toe dress shoes',
    physicalRequirements: 'Standing for periods up to 2 hours between breaks',
    ageRestriction: '18+',
    applicationDeadline: new Date(Date.now() + 86400000),
    status: JOB_STATUSES.OPEN
  });

  // Job 2: Open Catering Support
  const job2 = await Job.create({
    employer: employer1User._id,
    title: 'Gala Dinner Plated Service & Table Prep',
    description: 'Assist captain server with setting formal dining tables, tray service of hors d’oeuvres during cocktail hour, and clearing course plates.',
    category: 'Wedding and catering support',
    requiredSkills: ['Catering Setup', 'Food Handling', 'Customer Service'],
    openings: 4,
    filledCount: 0,
    locationName: 'Gotham Hall, 1356 Broadway, New York, NY 10018',
    location: {
      type: 'Point',
      coordinates: [-73.987, 40.752]
    },
    workDate: thisWeekend,
    startTime: '16:00',
    endTime: '23:00',
    breakDurationMinutes: 30,
    totalHours: 6.5,
    grossPay: 28,
    payBasis: 'hourly',
    currency: 'USD',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same day completion recorded',
    experienceRequirement: 'Prior banquet or restaurant busser/waiter experience preferred',
    dressCode: 'Black button-down shirt, black trousers, black non-slip shoes',
    physicalRequirements: 'Ability to carry service trays up to 20 lbs',
    ageRestriction: '18+',
    applicationDeadline: new Date(Date.now() + 172800000),
    status: JOB_STATUSES.OPEN
  });

  // Job 3: Warehouse Packaging
  const job3 = await Job.create({
    employer: employer2User._id,
    title: 'E-Commerce Peak Fulfillment & Box Packing',
    description: 'Verify pick slips against barcode scans, wrap items carefully in recyclable cushioning, pack into shipping cartons and affix courier shipping labels.',
    category: 'Warehouse and packing',
    requiredSkills: ['Box Packing', 'Barcode Scanning', 'Inventory Sorting'],
    openings: 5,
    filledCount: 2,
    locationName: 'Brooklyn Navy Yard, 63 Flushing Ave, Brooklyn, NY 11205',
    location: {
      type: 'Point',
      coordinates: [-73.974, 40.702]
    },
    workDate: tomorrow,
    startTime: '07:00',
    endTime: '15:30',
    breakDurationMinutes: 60,
    totalHours: 7.5,
    grossPay: 24,
    payBasis: 'hourly',
    currency: 'USD',
    paymentMethod: 'Direct Deposit',
    paymentTiming: 'Within 2 business days',
    experienceRequirement: 'Attention to detail and speed',
    dressCode: 'Comfortable work attire, steel or composite toe footwear recommended',
    physicalRequirements: 'Lifting packages up to 35 lbs',
    ageRestriction: '18+',
    applicationDeadline: new Date(Date.now() + 86400000),
    status: JOB_STATUSES.OPEN
  });

  // Job 4: Retail Assistant
  const job4 = await Job.create({
    employer: employer2User._id,
    title: 'Weekend Pop-up Store Floor & Stock Support',
    description: 'Unbox incoming designer apparel merchandise, steam garments, restock sizes on display racks, and assist shoppers locating fitting rooms.',
    category: 'Retail and store assistance',
    requiredSkills: ['Stock Replenishment', 'Customer Service'],
    openings: 2,
    filledCount: 0,
    locationName: 'SoHo Pop-Up Gallery, 480 Broome St, New York, NY 10013',
    location: {
      type: 'Point',
      coordinates: [-74.001, 40.722]
    },
    workDate: thisWeekend,
    startTime: '10:00',
    endTime: '18:00',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 23,
    payBasis: 'hourly',
    currency: 'USD',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same day',
    experienceRequirement: 'Friendly customer-facing attitude',
    dressCode: 'All-black stylish casual clothing',
    physicalRequirements: 'Standing and light stocking',
    ageRestriction: '18+',
    applicationDeadline: new Date(Date.now() + 259200000),
    status: JOB_STATUSES.OPEN
  });

  // Job 5: Completed Job for Assignment, Review, and Payment demonstrations
  const completedJob = await Job.create({
    employer: employer1User._id,
    title: 'Museum Exhibition Opening Night Usher & Host',
    description: 'Greet VIP guests, distribute souvenir programs, guide attendees toward the auditorium, and manage entryway lines.',
    category: 'Event assistance',
    requiredSkills: ['Guest Registration', 'Customer Service'],
    openings: 2,
    filledCount: 2,
    locationName: 'Museum Mile, 1000 5th Ave, New York, NY 10028',
    location: {
      type: 'Point',
      coordinates: [-73.963, 40.779]
    },
    workDate: pastDate,
    startTime: '17:00',
    endTime: '22:00',
    breakDurationMinutes: 30,
    totalHours: 4.5,
    grossPay: 27,
    payBasis: 'hourly',
    currency: 'USD',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Paid upon completion',
    experienceRequirement: 'Polite presentation',
    dressCode: 'Formal dark attire',
    physicalRequirements: 'Standing',
    ageRestriction: '18+',
    applicationDeadline: pastDate,
    status: JOB_STATUSES.COMPLETED
  });

  console.log('[Seed] Creating demo applications, assignments, and payments...');
  // Worker 1 applied to Job 1 (SHORTLISTED)
  const app1 = await Application.create({
    job: job1._id,
    worker: worker1User._id,
    status: APPLICATION_STATUSES.SHORTLISTED,
    message: 'Hello! I have worked badge check-ins at multiple trade shows and would love to support your Javits Center event.',
    decisionHistory: [
      {
        status: APPLICATION_STATUSES.APPLIED,
        note: 'Voluntary application submitted',
        changedBy: worker1User._id,
        timestamp: new Date(Date.now() - 3600000)
      },
      {
        status: APPLICATION_STATUSES.SHORTLISTED,
        note: 'High skills match (100% prerequisite match) and strong profile ratings',
        changedBy: employer1User._id,
        timestamp: new Date(Date.now() - 1800000)
      }
    ]
  });

  // Worker 2 applied to Job 3 (OFFERED)
  const app2 = await Application.create({
    job: job3._id,
    worker: worker2User._id,
    status: APPLICATION_STATUSES.OFFERED,
    message: 'Hi Marcus, I have barcode scanning and shipping packaging experience from campus center logistics.',
    offerDetails: {
      offeredAt: new Date(),
      note: 'Offering shift for tomorrow morning packing run at Brooklyn Navy Yard.',
      expiresAt: new Date(Date.now() + 43200000)
    },
    decisionHistory: [
      {
        status: APPLICATION_STATUSES.APPLIED,
        note: 'Application submitted',
        changedBy: worker2User._id,
        timestamp: new Date(Date.now() - 7200000)
      },
      {
        status: APPLICATION_STATUSES.OFFERED,
        note: 'Offer sent for morning shift',
        changedBy: employer2User._id,
        timestamp: new Date()
      }
    ]
  });

  // Completed Application & Assignment for Worker 1 on completedJob
  const completedApp = await Application.create({
    job: completedJob._id,
    worker: worker1User._id,
    status: APPLICATION_STATUSES.COMPLETED,
    message: 'Excited to assist with opening night operations.',
    decisionHistory: [
      { status: APPLICATION_STATUSES.APPLIED, changedBy: worker1User._id },
      { status: APPLICATION_STATUSES.HIRED, changedBy: employer1User._id },
      { status: APPLICATION_STATUSES.COMPLETED, changedBy: employer1User._id }
    ]
  });

  const assignment1 = await Assignment.create({
    job: completedJob._id,
    worker: worker1User._id,
    employer: employer1User._id,
    application: completedApp._id,
    agreedSchedule: {
      workDate: pastDate,
      startTime: '17:00',
      endTime: '22:00',
      totalHours: 4.5
    },
    agreedPayment: {
      grossAmount: 121.5, // 4.5 hrs * $27
      currency: 'USD',
      basis: 'hourly'
    },
    status: ASSIGNMENT_STATUSES.COMPLETED,
    attendance: {
      checkedInAt: new Date(pastDate.getTime() + 1000 * 60 * 15),
      checkedOutAt: new Date(pastDate.getTime() + 1000 * 60 * 60 * 5),
      notes: 'Punctual arrival, exemplary visitor assistance.'
    },
    completionConfirmations: {
      workerConfirmed: true,
      workerConfirmedAt: pastDate,
      employerConfirmed: true,
      employerConfirmedAt: pastDate
    }
  });

  const payment1 = await PaymentRecord.create({
    assignment: assignment1._id,
    job: completedJob._id,
    worker: worker1User._id,
    employer: employer1User._id,
    amount: 121.5,
    currency: 'USD',
    basis: 'hourly',
    status: PAYMENT_STATUSES.PAID,
    expectedDate: pastDate,
    paymentMethod: 'Platform Recorded Direct ACH',
    providerReference: 'ACH-WM-89412',
    notes: 'Disbursed following confirmed completion confirmation from both parties.',
    history: [
      { status: PAYMENT_STATUSES.DUE, note: 'Initial shift creation', updatedBy: employer1User._id, timestamp: pastDate },
      { status: PAYMENT_STATUSES.PROCESSING, note: 'Shift verified completed', updatedBy: employer1User._id, timestamp: pastDate },
      { status: PAYMENT_STATUSES.PAID, note: 'Transfer completed', updatedBy: employer1User._id, timestamp: pastDate }
    ]
  });

  // Review for assignment1 (Worker 1 reviewed by Employer 1)
  await Review.create({
    assignment: assignment1._id,
    reviewer: employer1User._id,
    reviewee: worker1User._id,
    rating: 5,
    reviewText: 'Alex was exceptionally courteous with our museum guests, arrived 15 minutes early, and handled check-in queues seamlessly!',
    status: 'published'
  });

  // Review for assignment1 (Employer 1 reviewed by Worker 1)
  await Review.create({
    assignment: assignment1._id,
    reviewer: worker1User._id,
    reviewee: employer1User._id,
    rating: 5,
    reviewText: 'Sarah provided clear briefing notes, on-time breaks, and payment was recorded promptly right after the gala finished.',
    status: 'published'
  });

  // Notifications
  await Notification.create({
    recipient: worker1User._id,
    type: 'APPLICATION_STATUS',
    title: 'Shortlisted for Banquet Check-in',
    message: 'Apex Event Staffing shortlisted your application for "Banquet Guest Check-in & Registration Assistant".',
    link: '/worker/applications'
  });

  await Notification.create({
    recipient: worker1User._id,
    type: 'PAYMENT_UPDATE',
    title: 'Payment Recorded: $121.50 PAID',
    message: 'Your payment for "Museum Exhibition Opening Night Usher" was successfully recorded as PAID.',
    link: '/worker/payments'
  });

  await Notification.create({
    recipient: employer1User._id,
    type: 'APPLICATION_STATUS',
    title: 'New Applicant for Gala Dinner',
    message: 'A candidate submitted a voluntary application for your Gala Dinner table prep position.',
    link: `/employer/jobs/${job2._id}/applicants`
  });

  // Demo verification request
  await VerificationRequest.create({
    user: employer1User._id,
    verificationType: 'business_license',
    status: 'approved',
    submittedData: {
      businessName: 'Apex Event Staffing & Banquets',
      registrationNumber: 'NY-CORP-984210',
      documentType: 'Certificate of Incorporation'
    },
    reviewNotes: 'Verified via state entity search.',
    reviewedBy: admin._id,
    reviewedAt: new Date(Date.now() - 864000000)
  });

  console.log('[Seed] Demo data seeding completed successfully!');
  console.log('---------------------------------------------------------');
  console.log('DEMO ACCOUNTS READY:');
  console.log('Worker:   worker@workmatch.demo     / Password123!');
  console.log('Worker 2: worker2@workmatch.demo    / Password123!');
  console.log('Employer: employer@workmatch.demo   / Password123!');
  console.log('Admin:    admin@workmatch.demo      / AdminPass123!');
  console.log('---------------------------------------------------------');
}

// Direct execution
if (process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(() => {
      disconnectDB().then(() => process.exit(0));
    })
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}

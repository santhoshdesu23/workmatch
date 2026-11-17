import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { Attendance } from '../src/models/Attendance.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { Review } from '../src/models/Review.js';
import {
  ROLES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  ASSIGNMENT_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_BASES,
  ATTENDANCE_STATUSES,
  ATTENDANCE_METHODS
} from '../src/config/constants.js';
import { seedAtigreKolhapurJobs } from './seed_atigre_kolhapur_jobs.js';

export async function seedWorksForAtigreWorker() {
  console.log('[Seed Works] Starting database connection...');
  await connectDB();

  // 1. Refresh all demo jobs so their dates are in the future
  console.log('[Seed Works] Refreshing demo jobs with current/future dates...');
  await seedAtigreKolhapurJobs({ verbose: false });

  // 2. Locate or create the target user
  const email = 'atigre.employer@workmatch.demo';
  let user = await User.findOne({ email });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('DemoPassword123!', salt);

  if (!user) {
    user = await User.create({
      name: 'Anand Patil (Atigre Operations)',
      firstName: 'Anand',
      lastName: 'Patil',
      email,
      passwordHash,
      role: ROLES.WORKER,
      roles: [ROLES.WORKER, ROLES.EMPLOYER],
      activeRole: ROLES.WORKER,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
  } else {
    user.roles = [ROLES.WORKER, ROLES.EMPLOYER];
    user.role = ROLES.WORKER;
    user.activeRole = ROLES.WORKER;
    user.passwordHash = passwordHash;
    user.emailVerified = true;
    user.verificationStatus = 'verified';
    user.accountStatus = 'active';
    await user.save();
  }
  console.log('[Seed Works] User updated with dual-role (active: WORKER):', user.email);

  // 3. Ensure rich WorkerProfile exists
  const workerProfile = await WorkerProfile.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        bio: 'Reliable and punctual field associate based in Atigre. Experienced in agricultural sorting, packaging, retail inventory, and light industrial warehousing across Hatkanangale, Shiroli MIDC, and Kolhapur.',
        skills: [
          'Agricultural Packaging',
          'Produce Sorting',
          'Inventory Stocking',
          'Box Packing',
          'Loading & Unloading',
          'Physical Stamina',
          'Machine Operation'
        ],
        experienceSummary: '4+ years of consistent hands-on experience in agro-processing facilities and commercial goods handling. High reliability score and prompt attendance.',
        preferredCategories: [
          'Warehouse and packing',
          'Retail and store assistance',
          'General help',
          'Agricultural and Logistics Support'
        ],
        preferredLocationName: 'Atigre, Maharashtra',
        location: {
          type: 'Point',
          coordinates: [74.3720, 16.7410] // Atigre
        },
        travelRadiusKm: 30,
        availability: {
          isAvailable: true,
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          timeSlots: ['Morning', 'Afternoon', 'Evening']
        },
        expectedPay: {
          min: 500,
          max: 950,
          basis: 'shift'
        },
        languages: ['Marathi', 'Hindi', 'English'],
        verificationStatus: 'verified',
        rating: { average: 4.9, count: 5 },
        completedJobsCount: 4
      }
    },
    { upsert: true, new: true }
  );
  console.log('[Seed Works] WorkerProfile created/updated with ID:', workerProfile._id);

  // 4. Ensure EmployerProfile exists as well for seamless switching
  await EmployerProfile.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        businessName: 'Demo Employer – Atigre Logistics & Agro Hub',
        description: 'Demonstration employer profile for temporary agro-processing, retail, and hospitality assignments in Atigre & Hatkanangale.',
        businessCategory: 'Agricultural and Logistics Support',
        businessAddress: 'Sangli-Kolhapur Highway, Atigre, Maharashtra 416118',
        location: {
          type: 'Point',
          coordinates: [74.3720, 16.7410]
        },
        verificationStatus: 'verified',
        rating: { average: 4.8, count: 14 },
        totalJobsPosted: 14,
        totalHiredWorkers: 22
      }
    },
    { upsert: true, new: true }
  );

  // 5. Find suitable other employers and jobs to create works for this worker
  const kolhapurEmployer = await User.findOne({ email: 'kolhapur.logistics@workmatch.demo' });
  const employerSarah = await User.findOne({ email: 'employer@workmatch.demo' });
  const primaryEmployer = kolhapurEmployer || employerSarah || user;

  // Fetch jobs in Atigre / Kolhapur
  const allJobs = await Job.find({ status: { $in: [JOB_STATUSES.OPEN, JOB_STATUSES.IN_PROGRESS, JOB_STATUSES.COMPLETED] } }).sort({ createdAt: -1 });

  if (allJobs.length < 5) {
    throw new Error('Not enough jobs in database to seed works.');
  }

  // Pick specific diverse jobs
  const job1_today = allJobs.find(j => j.title.includes('Industrial Packaging') || j.locality === 'Shiroli MIDC') || allJobs[0];
  const job2_ongoing = allJobs.find(j => j.title.includes('Harvest') || j.locality === 'Atigre') || allJobs[1];
  const job3_upcoming = allJobs.find(j => j.title.includes('Retail') || j.locality === 'Hatkanangale') || allJobs[2];
  const job4_completed = allJobs.find(j => j.title.includes('Banquet') || j.title.includes('Goods Shed')) || allJobs[3];
  const job5_completed = allJobs.find(j => j.title.includes('Box Assembly') || j.title.includes('General Store')) || allJobs[4];
  const job6_applied = allJobs[5] || allJobs[0];
  const job7_applied = allJobs[6] || allJobs[1];

  console.log('[Seed Works] Selected jobs for works:');
  console.log(' - Shift 1 (Today, Ready for GPS Check-in):', job1_today.title, `(${job1_today.locality})`);
  console.log(' - Shift 2 (Ongoing, Present GPS Verified):', job2_ongoing.title, `(${job2_ongoing.locality})`);
  console.log(' - Shift 3 (Upcoming Shift):', job3_upcoming.title, `(${job3_upcoming.locality})`);
  console.log(' - Shift 4 (Past Completed Work):', job4_completed.title);
  console.log(' - Shift 5 (Past Completed Work):', job5_completed.title);

  // Helper to upsert Application & Assignment
  const now = new Date();
  const todayMorning = new Date();
  todayMorning.setHours(9, 0, 0, 0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 30, 0, 0);

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  dayAfterTomorrow.setHours(10, 0, 0, 0);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(9, 0, 0, 0);

  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  fourDaysAgo.setHours(8, 0, 0, 0);

  // --- WORK 1: TODAY'S SHIFT - READY FOR GPS CHECK-IN ---
  const app1 = await Application.findOneAndUpdate(
    { job: job1_today._id, worker: user._id },
    {
      $set: {
        status: APPLICATION_STATUSES.ACCEPTED,
        message: 'Available immediately. Located in Atigre, can easily reach Shiroli MIDC on time.',
        offerDetails: {
          offeredAt: twoDaysAgo,
          note: 'Offer confirmed. Please report to Sector A bay on schedule.',
          expiresAt: tomorrow
        }
      }
    },
    { upsert: true, new: true }
  );

  const assign1 = await Assignment.findOneAndUpdate(
    { job: job1_today._id, worker: user._id },
    {
      $set: {
        employer: job1_today.employer || primaryEmployer._id,
        application: app1._id,
        agreedSchedule: {
          workDate: todayMorning,
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8.0
        },
        agreedPayment: {
          grossAmount: job1_today.grossPay || 750,
          currency: 'INR',
          basis: job1_today.payBasis || 'shift'
        },
        status: ASSIGNMENT_STATUSES.CONFIRMED,
        attendance: { notes: 'Shift active today. Worker scheduled for GPS check-in.' }
      }
    },
    { upsert: true, new: true }
  );

  // Attendance: Pending Check-in (Ready for worker to test GPS Check-in)
  await Attendance.findOneAndUpdate(
    { job: job1_today._id, worker: user._id },
    {
      $set: {
        employer: job1_today.employer || primaryEmployer._id,
        assignment: assign1._id,
        status: ATTENDANCE_STATUSES.PENDING,
        method: ATTENDANCE_METHODS.GPS,
        reason: 'Shift scheduled for today; waiting for worker GPS check-in.'
      }
    },
    { upsert: true, new: true }
  );

  // --- WORK 2: ONGOING SHIFT - ALREADY CHECKED IN (PRESENT GPS VERIFIED) ---
  const app2 = await Application.findOneAndUpdate(
    { job: job2_ongoing._id, worker: user._id },
    {
      $set: {
        status: APPLICATION_STATUSES.ACCEPTED,
        message: 'Experienced in agricultural grading and crate packing in Atigre.',
        offerDetails: {
          offeredAt: twoDaysAgo,
          note: 'Confirmed. Assigned to morning sorting bay.',
          expiresAt: tomorrow
        }
      }
    },
    { upsert: true, new: true }
  );

  const assign2 = await Assignment.findOneAndUpdate(
    { job: job2_ongoing._id, worker: user._id },
    {
      $set: {
        employer: job2_ongoing.employer || primaryEmployer._id,
        application: app2._id,
        agreedSchedule: {
          workDate: todayMorning,
          startTime: '07:30',
          endTime: '15:30',
          totalHours: 7.5
        },
        agreedPayment: {
          grossAmount: job2_ongoing.grossPay || 650,
          currency: 'INR',
          basis: job2_ongoing.payBasis || 'shift'
        },
        status: ASSIGNMENT_STATUSES.IN_PROGRESS,
        attendance: {
          checkedInAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          notes: 'Checked in on-site via GPS (Atigre Agro Processing Yard).'
        }
      }
    },
    { upsert: true, new: true }
  );

  const checkInCoords = job2_ongoing.location?.coordinates || [74.3720, 16.7410];
  await Attendance.findOneAndUpdate(
    { job: job2_ongoing._id, worker: user._id },
    {
      $set: {
        employer: job2_ongoing.employer || primaryEmployer._id,
        assignment: assign2._id,
        status: ATTENDANCE_STATUSES.PRESENT_GPS,
        method: ATTENDANCE_METHODS.GPS,
        checkInCoordinates: {
          type: 'Point',
          coordinates: checkInCoords
        },
        accuracyMeters: 18,
        distanceMeters: 35,
        checkedInAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        reason: 'Worker verified on-site via GPS (35m from venue center).'
      }
    },
    { upsert: true, new: true }
  );

  // --- WORK 3: UPCOMING SHIFT (DAY AFTER TOMORROW) ---
  const app3 = await Application.findOneAndUpdate(
    { job: job3_upcoming._id, worker: user._id },
    {
      $set: {
        status: APPLICATION_STATUSES.ACCEPTED,
        message: 'Experienced with stock replenishment and customer assistance.',
        offerDetails: {
          offeredAt: now,
          note: 'Offer accepted. Please bring ID proof.',
          expiresAt: dayAfterTomorrow
        }
      }
    },
    { upsert: true, new: true }
  );

  const assign3 = await Assignment.findOneAndUpdate(
    { job: job3_upcoming._id, worker: user._id },
    {
      $set: {
        employer: job3_upcoming.employer || primaryEmployer._id,
        application: app3._id,
        agreedSchedule: {
          workDate: dayAfterTomorrow,
          startTime: '10:00',
          endTime: '19:00',
          totalHours: 8.0
        },
        agreedPayment: {
          grossAmount: job3_upcoming.grossPay || 600,
          currency: 'INR',
          basis: job3_upcoming.payBasis || 'shift'
        },
        status: ASSIGNMENT_STATUSES.CONFIRMED,
        attendance: { notes: 'Upcoming shift scheduled.' }
      }
    },
    { upsert: true, new: true }
  );

  await Attendance.findOneAndUpdate(
    { job: job3_upcoming._id, worker: user._id },
    {
      $set: {
        employer: job3_upcoming.employer || primaryEmployer._id,
        assignment: assign3._id,
        status: ATTENDANCE_STATUSES.PENDING,
        method: ATTENDANCE_METHODS.GPS,
        reason: 'Shift confirmed for upcoming date.'
      }
    },
    { upsert: true, new: true }
  );

  // --- WORK 4: COMPLETED PAST SHIFT (PAID & REVIEWED) ---
  const app4 = await Application.findOneAndUpdate(
    { job: job4_completed._id, worker: user._id },
    {
      $set: {
        status: APPLICATION_STATUSES.COMPLETED,
        message: 'Assisted with banquet seating and table arrangements.',
        offerDetails: {
          offeredAt: fourDaysAgo,
          note: 'Hired for banquet event setup.'
        }
      }
    },
    { upsert: true, new: true }
  );

  const assign4 = await Assignment.findOneAndUpdate(
    { job: job4_completed._id, worker: user._id },
    {
      $set: {
        employer: job4_completed.employer || primaryEmployer._id,
        application: app4._id,
        agreedSchedule: {
          workDate: twoDaysAgo,
          startTime: '08:00',
          endTime: '16:00',
          totalHours: 8.0
        },
        agreedPayment: {
          grossAmount: 700,
          currency: 'INR',
          basis: 'shift'
        },
        status: ASSIGNMENT_STATUSES.COMPLETED,
        completionConfirmations: {
          workerConfirmed: true,
          workerConfirmedAt: twoDaysAgo,
          employerConfirmed: true,
          employerConfirmedAt: twoDaysAgo
        },
        attendance: {
          checkedInAt: twoDaysAgo,
          checkedOutAt: new Date(twoDaysAgo.getTime() + 8 * 3600 * 1000),
          notes: 'Shift completed successfully with full attendance.'
        }
      }
    },
    { upsert: true, new: true }
  );

  // Payment Record for Work 4
  await PaymentRecord.findOneAndUpdate(
    { assignment: assign4._id },
    {
      $set: {
        job: job4_completed._id,
        worker: user._id,
        employer: job4_completed.employer || primaryEmployer._id,
        amount: 700,
        currency: 'INR',
        basis: 'shift',
        status: PAYMENT_STATUSES.PAID,
        paidAt: twoDaysAgo,
        paymentReference: 'TXN-WM-ATIGRE-9921',
        paymentNotes: 'Settled via Direct Bank Transfer within 24 hours of shift completion.'
      }
    },
    { upsert: true, new: true }
  );

  // Review for Work 4
  await Review.findOneAndUpdate(
    { assignment: assign4._id, reviewer: job4_completed.employer || primaryEmployer._id },
    {
      $set: {
        reviewee: user._id,
        rating: 5,
        reviewText: 'Punctual, disciplined, and very helpful during banquet hall setup in Atigre. Excellent communication!',
        status: 'published'
      }
    },
    { upsert: true, new: true }
  );

  // --- WORK 5: COMPLETED PAST SHIFT (PAID & REVIEWED) ---
  const app5 = await Application.findOneAndUpdate(
    { job: job5_completed._id, worker: user._id },
    {
      $set: {
        status: APPLICATION_STATUSES.COMPLETED,
        message: 'Handled loading and carton packing assistance.',
        offerDetails: {
          offeredAt: fourDaysAgo,
          note: 'Assigned to logistics team.'
        }
      }
    },
    { upsert: true, new: true }
  );

  const assign5 = await Assignment.findOneAndUpdate(
    { job: job5_completed._id, worker: user._id },
    {
      $set: {
        employer: job5_completed.employer || primaryEmployer._id,
        application: app5._id,
        agreedSchedule: {
          workDate: fourDaysAgo,
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8.0
        },
        agreedPayment: {
          grossAmount: 750,
          currency: 'INR',
          basis: 'shift'
        },
        status: ASSIGNMENT_STATUSES.COMPLETED,
        completionConfirmations: {
          workerConfirmed: true,
          workerConfirmedAt: fourDaysAgo,
          employerConfirmed: true,
          employerConfirmedAt: fourDaysAgo
        },
        attendance: {
          checkedInAt: fourDaysAgo,
          checkedOutAt: new Date(fourDaysAgo.getTime() + 8 * 3600 * 1000),
          notes: 'Full shift completed with high quality output.'
        }
      }
    },
    { upsert: true, new: true }
  );

  await PaymentRecord.findOneAndUpdate(
    { assignment: assign5._id },
    {
      $set: {
        job: job5_completed._id,
        worker: user._id,
        employer: job5_completed.employer || primaryEmployer._id,
        amount: 750,
        currency: 'INR',
        basis: 'shift',
        status: PAYMENT_STATUSES.PAID,
        paidAt: fourDaysAgo,
        paymentReference: 'TXN-WM-KOLHAPUR-4412',
        paymentNotes: 'Settled via UPI on shift completion.'
      }
    },
    { upsert: true, new: true }
  );

  await Review.findOneAndUpdate(
    { assignment: assign5._id, reviewer: job5_completed.employer || primaryEmployer._id },
    {
      $set: {
        reviewee: user._id,
        rating: 5,
        reviewText: 'Great manual dexterity and speed. Carefully handled all pre-cut corrugated cartons without damage.',
        status: 'published'
      }
    },
    { upsert: true, new: true }
  );

  // --- ACTIVE APPLICATIONS (PENDING & SHORTLISTED) ---
  if (job6_applied) {
    await Application.findOneAndUpdate(
      { job: job6_applied._id, worker: user._id },
      {
        $set: {
          status: APPLICATION_STATUSES.SHORTLISTED,
          message: 'Interested in this assignment. Available for the full schedule.',
          decisionHistory: [
            { status: APPLICATION_STATUSES.APPLIED, note: 'Applied via WorkMatch web application' },
            { status: APPLICATION_STATUSES.SHORTLISTED, note: 'Profile shortlisted by hiring manager' }
          ]
        }
      },
      { upsert: true, new: true }
    );
  }

  if (job7_applied) {
    await Application.findOneAndUpdate(
      { job: job7_applied._id, worker: user._id },
      {
        $set: {
          status: APPLICATION_STATUSES.APPLIED,
          message: 'Nearby in Atigre. Can join on short notice.',
          decisionHistory: [
            { status: APPLICATION_STATUSES.APPLIED, note: 'Applied via WorkMatch' }
          ]
        }
      },
      { upsert: true, new: true }
    );
  }

  console.log('[Seed Works] Successfully created/updated 5 assignments (3 active, 2 completed) and 2 applications for worker!');
  await disconnectDB();
  return { success: true };
}

// Direct CLI execution
if (process.argv[1]?.endsWith('seed_works_for_atigre_worker.js')) {
  seedWorksForAtigreWorker()
    .then(() => {
      console.log('[Seed Works] Seeding finished successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Works] Seeding failed:', err);
      process.exit(1);
    });
}

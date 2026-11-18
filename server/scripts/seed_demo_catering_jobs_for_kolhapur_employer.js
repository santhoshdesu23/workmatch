import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { Attendance } from '../src/models/Attendance.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { storePaymentProof } from '../src/services/gridfsService.js';
import {
  ROLES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  ASSIGNMENT_STATUSES,
  PAYMENT_STATUSES,
  ATTENDANCE_STATUSES,
  ATTENDANCE_METHODS
} from '../src/config/constants.js';

export async function seedCateringJobsForKolhapurEmployer() {
  console.log('[Seed Catering Jobs] Connecting to MongoDB Atlas...');
  await connectDB();

  const employerEmail = 'kolhapur.logistics@workmatch.demo';
  const rawPassword = 'DemoPassword123!';

  console.log(`[Seed Catering Jobs] Setting up employer account: ${employerEmail}`);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  // 1. Find or create employer user
  let employer = await User.findOne({ email: employerEmail });
  if (!employer) {
    employer = await User.create({
      name: 'Kolhapur Premium Events, Catering & Logistics',
      firstName: 'Kolhapur',
      lastName: 'Logistics',
      email: employerEmail,
      passwordHash,
      role: ROLES.EMPLOYER,
      roles: [ROLES.EMPLOYER, ROLES.WORKER],
      activeRole: ROLES.EMPLOYER,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
  } else {
    employer.name = 'Kolhapur Premium Events, Catering & Logistics';
    employer.role = ROLES.EMPLOYER;
    employer.roles = [ROLES.EMPLOYER, ROLES.WORKER];
    employer.activeRole = ROLES.EMPLOYER;
    employer.passwordHash = passwordHash;
    employer.emailVerified = true;
    employer.verificationStatus = 'verified';
    employer.accountStatus = 'active';
    await employer.save();
  }

  // 2. Setup EmployerProfile
  await EmployerProfile.findOneAndUpdate(
    { user: employer._id },
    {
      $set: {
        businessName: 'Kolhapur Hospitality, Catering & Logistics Network',
        description: 'Premier event hospitality, luxury wedding banquet catering, and industrial warehouse logistics operating across Kolhapur, Atigre, Shiroli MIDC, and Ichalkaranji.',
        businessCategory: 'Wedding and catering support',
        businessAddress: 'Kawala Naka & Shiroli MIDC, Kolhapur, Maharashtra 416003',
        location: {
          type: 'Point',
          coordinates: [74.2433, 16.7049] // Kawala Naka, Kolhapur
        },
        publicContact: {
          phone: '+91 231 299 4400',
          email: employerEmail,
          website: 'https://workmatch.demo/kolhapur-catering'
        },
        verificationStatus: 'verified',
        rating: { average: 4.95, count: 24 },
        totalJobsPosted: 20,
        totalHiredWorkers: 38
      }
    },
    { upsert: true, new: true }
  );

  // 3. Find demo workers for applications and assignments
  const demoWorkers = await User.find({
    role: { $in: [ROLES.WORKER, 'worker'] },
    _id: { $ne: employer._id }
  }).limit(5);

  const getFutureDate = (daysAhead, hours = 10, minutes = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const getFutureDateString = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  // Remove previous jobs created by this script to ensure fresh data
  await Job.deleteMany({ employer: employer._id });

  console.log('[Seed Catering Jobs] Creating realistic catering and hospitality jobs...');

  const jobsData = [
    {
      title: 'Royal Wedding Banquet Catering & Buffet Servers',
      description: 'Professional banquet and catering attendants needed for a 500-guest luxury wedding reception. Responsibilities include guest greeting, buffet food replenishment, live counter assistance, table water service, and maintaining spotless dining presentation. Complete dinner provided on site.',
      category: 'Wedding and catering support',
      locationName: 'Sayaji Hotel & Banquet Lawns, Kawala Naka, Kolhapur',
      coordinates: [74.2433, 16.7049],
      workDaysAhead: 1,
      startTime: '16:30',
      endTime: '23:30',
      breakDurationMinutes: 30,
      totalHours: 6.5,
      openings: 6,
      requiredSkills: ['Catering Service', 'Buffet Management', 'Table Setup', 'Hygiene Standards'],
      experienceRequirement: 'Basic catering experience preferred; briefing provided at shift start',
      dressCode: 'Crisp black trousers, white shirt, comfortable black non-slip shoes',
      physicalRequirements: 'Standing, moving between banquet tables, tray carrying up to 10kg',
      ageRestriction: '18+',
      grossPay: 850,
      payBasis: 'shift',
      paymentMethod: 'UPI',
      paymentTiming: 'Same day upon shift completion',
      cancellationPolicy: 'Notice required 12 hours prior to shift commencement'
    },
    {
      title: 'Live Counter Chef & Food Prep Assistant',
      description: 'Assist senior chefs at live chaat, dosa, and dessert counters during an evening sangeet ceremony. Refill fresh ingredients, prepare appetizer servings, ensure counter hygiene, and assist with guest plate presentation with warm hospitality.',
      category: 'Wedding and catering support',
      locationName: 'Sanjay Ghodawat Institute Banquet Hall, NH166, Atigre, Kolhapur',
      coordinates: [74.3720, 16.7410],
      workDaysAhead: 2,
      startTime: '16:00',
      endTime: '22:30',
      breakDurationMinutes: 30,
      totalHours: 6.0,
      openings: 4,
      requiredSkills: ['Food Prep', 'Counter Assistance', 'Customer Hospitality', 'Speed Service'],
      experienceRequirement: 'Prior restaurant or catering experience desirable',
      dressCode: 'Clean white shirt or t-shirt, dark trousers, chef cap provided on site',
      physicalRequirements: 'Standing during live counter service, quick hand-eye coordination',
      ageRestriction: '18+',
      grossPay: 125,
      payBasis: 'hourly',
      paymentMethod: 'UPI',
      paymentTiming: 'Within 12 hours of shift completion',
      cancellationPolicy: 'Notice required 12 hours prior'
    },
    {
      title: 'Corporate Gala Dinner Catering Crew',
      description: 'Hospitality crew required for an evening corporate business summit and gala dinner. Responsibilities include tray-passing welcome mocktails, hors d’oeuvres service, buffet oversight, and ensuring corporate attendees receive prompt hospitality.',
      category: 'Restaurant and hospitality',
      locationName: 'Hotel Pearl Grand Ballroom, Tarabai Park, Kolhapur',
      coordinates: [74.2355, 16.7112],
      workDaysAhead: 3,
      startTime: '17:30',
      endTime: '23:00',
      breakDurationMinutes: 30,
      totalHours: 5.0,
      openings: 5,
      requiredSkills: ['Beverage Service', 'Guest Hospitality', 'Tray Service', 'Professional Demeanor'],
      experienceRequirement: 'Polite guest communication and neat presentation required',
      dressCode: 'Formal black trousers, black shoes; black aprons provided by hotel',
      physicalRequirements: 'Tray carrying and walking in banquet hall',
      ageRestriction: '18+',
      grossPay: 800,
      payBasis: 'shift',
      paymentMethod: 'Bank Transfer',
      paymentTiming: 'Direct bank transfer within 24 hours',
      cancellationPolicy: 'Notice required 24 hours prior'
    },
    {
      title: 'Traditional Wedding Lunch Dining Hall Attendant',
      description: 'Assist during traditional wedding lunch batches. Duties include traditional thali service, hot dal and rice replenishment, refilling water glasses, clearing patravali/plates, and keeping dining hall tables pristine between lunch batches.',
      category: 'Wedding and catering support',
      locationName: 'Padmavati Mangal Karyalaya, Station Road, Kolhapur',
      coordinates: [74.2389, 16.7020],
      workDaysAhead: 4,
      startTime: '10:00',
      endTime: '16:30',
      breakDurationMinutes: 30,
      totalHours: 6.0,
      openings: 5,
      requiredSkills: ['Traditional Thali Service', 'Fast Walking', 'Teamwork', 'Cleanliness'],
      experienceRequirement: 'No prior experience needed; on-site instructions provided',
      dressCode: 'Comfortable traditional or casual clothing, closed-toe footwear',
      physicalRequirements: 'Bending, brisk walking, carrying serving buckets/trays',
      ageRestriction: '18+',
      grossPay: 900,
      payBasis: 'shift',
      paymentMethod: 'UPI',
      paymentTiming: 'Same day cash/UPI upon shift conclusion',
      cancellationPolicy: 'Notice required 12 hours prior'
    },
    {
      title: 'Banquet Crockery, Cutlery & Kitchen Steward Assistant',
      description: 'Back-of-house kitchen stewards and crockery assistants for high-volume banquet service. Assist with sorting dinner plates, washing and sanitizing cutlery, operating commercial dishwashers, and restocking clean serving dishes for chefs.',
      category: 'Cleaning and maintenance',
      locationName: 'Mahalaxmi Garden Hall, Ichalkaranji, Kolhapur District',
      coordinates: [74.4620, 16.6960],
      workDaysAhead: 5,
      startTime: '11:30',
      endTime: '18:30',
      breakDurationMinutes: 30,
      totalHours: 6.5,
      openings: 4,
      requiredSkills: ['Kitchen Stewarding', 'Dish Sanitizing', 'Cutlery Polishing', 'Physical Stamina'],
      experienceRequirement: 'None, willingness to maintain spotless sanitation',
      dressCode: 'Rubber boots or waterproof shoes, casual pants, waterproof aprons provided',
      physicalRequirements: 'Lifting dish racks up to 15kg, prolonged standing in kitchen area',
      ageRestriction: '18+',
      grossPay: 115,
      payBasis: 'hourly',
      paymentMethod: 'UPI',
      paymentTiming: 'Within 24 hours of completion',
      cancellationPolicy: 'Notice required 12 hours prior'
    },
    {
      title: 'Festival Sweets & Dry Fruit Gift Hampers Packing Crew',
      description: 'Carefully pack festive sweet boxes, dry fruit gift trays, and wedding return gift hampers. Responsibilities include weighing sweets accurately, placing decorative ribbons and labels, seal verification, and packing boxes into master shipping cartons.',
      category: 'Warehouse and packing',
      locationName: 'Shiroli MIDC Industrial Park, Kolhapur',
      coordinates: [74.3015, 16.7482],
      workDaysAhead: 6,
      startTime: '08:30',
      endTime: '16:30',
      breakDurationMinutes: 30,
      totalHours: 7.5,
      openings: 6,
      requiredSkills: ['Packaging', 'Quality Inspection', 'Box Assembly', 'Attention to Detail'],
      experienceRequirement: 'Neat hand packaging skills',
      dressCode: 'Comfortable casual wear, hairnets and clean gloves provided on site',
      physicalRequirements: 'Sitting and standing at packaging stations',
      ageRestriction: '18+',
      grossPay: 750,
      payBasis: 'shift',
      paymentMethod: 'Bank Transfer',
      paymentTiming: 'Direct bank transfer within 24 hours',
      cancellationPolicy: 'Notice required 24 hours prior'
    }
  ];

  const createdJobs = [];

  for (const jobData of jobsData) {
    const workDate = getFutureDate(jobData.workDaysAhead, 10, 0);
    const workEndDate = getFutureDate(jobData.workDaysAhead, 18, 0);

    const job = await Job.create({
      employer: employer._id,
      title: jobData.title,
      description: jobData.description,
      category: jobData.category,
      locationName: jobData.locationName,
      location: {
        type: 'Point',
        coordinates: jobData.coordinates
      },
      attendanceRadiusMeters: 200,
      coordinatesConfirmed: true,
      workDate,
      workEndDate,
      startTime: jobData.startTime,
      endTime: jobData.endTime,
      breakDurationMinutes: jobData.breakDurationMinutes,
      totalHours: jobData.totalHours,
      openings: jobData.openings,
      requiredSkills: jobData.requiredSkills,
      experienceRequirement: jobData.experienceRequirement,
      dressCode: jobData.dressCode,
      physicalRequirements: jobData.physicalRequirements,
      ageRestriction: jobData.ageRestriction,
      grossPay: jobData.grossPay,
      payBasis: jobData.payBasis,
      currency: 'INR',
      paymentMethod: jobData.paymentMethod,
      paymentTiming: jobData.paymentTiming,
      cancellationPolicy: jobData.cancellationPolicy,
      applicationDeadline: workDate,
      detailsConfirmed: true,
      status: JOB_STATUSES.OPEN
    });

    createdJobs.push(job);
    console.log(`  ✓ Created Job: "${job.title}" (${job.category} • ₹${job.grossPay}/${job.payBasis})`);
  }

  // 4. Create active applications and assignments for the first job to show real hired workers & payment records!
  if (demoWorkers.length >= 2 && createdJobs.length > 0) {
    const primaryJob = createdJobs[0]; // Royal Wedding Banquet
    console.log(`[Seed Catering Jobs] Adding hired workers & payment evidence for: "${primaryJob.title}"`);

    // Worker 1: Hired with payment marked as PAID with real GridFS proof
    const worker1 = demoWorkers[0];
    const app1 = await Application.create({
      job: primaryJob._id,
      worker: worker1._id,
      employer: employer._id,
      status: APPLICATION_STATUSES.HIRED,
      appliedAt: new Date(Date.now() - 3600 * 24 * 1000),
      hiredAt: new Date()
    });

    const assign1 = await Assignment.create({
      job: primaryJob._id,
      worker: worker1._id,
      employer: employer._id,
      application: app1._id,
      agreedSchedule: {
        workDate: primaryJob.workDate,
        workEndDate: primaryJob.workEndDate,
        startTime: primaryJob.startTime,
        endTime: primaryJob.endTime,
        totalHours: primaryJob.totalHours
      },
      agreedPayment: {
        grossAmount: primaryJob.grossPay,
        amount: primaryJob.grossPay,
        currency: 'INR',
        basis: primaryJob.payBasis
      },
      status: ASSIGNMENT_STATUSES.COMPLETED,
      completionConfirmations: {
        workerConfirmed: true,
        workerConfirmedAt: new Date(),
        employerConfirmed: true,
        employerConfirmedAt: new Date()
      }
    });

    // Attendance record
    await Attendance.create({
      job: primaryJob._id,
      assignment: assign1._id,
      worker: worker1._id,
      employer: employer._id,
      status: ATTENDANCE_STATUSES.PRESENT_GPS,
      method: ATTENDANCE_METHODS.GPS,
      checkInTime: new Date(Date.now() - 3600 * 6 * 1000),
      checkInCoordinates: [74.2435, 16.7051],
      distanceFromVenueMeters: 28,
      verifiedWithinRadius: true,
      attendanceRadiusMeters: 200,
      supervisorConfirmed: true
    });

    // Payment Record with attached GridFS screenshot proof!
    // Genuine 1x1 PNG bytes
    const sampleProofBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    const paymentRecord1 = await PaymentRecord.create({
      assignment: assign1._id,
      job: primaryJob._id,
      worker: worker1._id,
      employer: employer._id,
      amount: primaryJob.grossPay,
      currency: 'INR',
      basis: primaryJob.payBasis,
      status: PAYMENT_STATUSES.PAID,
      paymentMethod: 'UPI',
      providerReference: 'UPI-UTR-409182394812',
      verificationSource: 'worker_confirmed',
      workerConfirmedReceipt: true,
      workerConfirmedReceiptAt: new Date(),
      notes: 'Disbursed ₹850 via Google Pay immediately following banquet completion. Excellent guest service.',
      history: [
        {
          status: PAYMENT_STATUSES.PAID,
          note: 'Marked PAID with verified UPI UTR reference.',
          updatedBy: employer._id,
          timestamp: new Date()
        }
      ]
    });

    // Store proof in GridFS
    const proofDoc = await storePaymentProof({
      fileBuffer: sampleProofBuffer,
      originalName: 'gpay_wedding_catering_receipt.png',
      declaredMimeType: 'image/png',
      uploadedBy: employer._id,
      paymentId: paymentRecord1._id,
      jobId: primaryJob._id
    });

    paymentRecord1.proofs = [proofDoc];
    await paymentRecord1.save();
    console.log(`  ✓ Created Payment Record with GridFS proof: ₹${paymentRecord1.amount} (Ref: ${paymentRecord1.providerReference})`);

    // Worker 2: Hired, payment status DUE
    const worker2 = demoWorkers[1];
    const app2 = await Application.create({
      job: primaryJob._id,
      worker: worker2._id,
      employer: employer._id,
      status: APPLICATION_STATUSES.HIRED,
      appliedAt: new Date(Date.now() - 3600 * 20 * 1000),
      hiredAt: new Date()
    });

    const assign2 = await Assignment.create({
      job: primaryJob._id,
      worker: worker2._id,
      employer: employer._id,
      application: app2._id,
      agreedSchedule: {
        workDate: primaryJob.workDate,
        workEndDate: primaryJob.workEndDate,
        startTime: primaryJob.startTime,
        endTime: primaryJob.endTime,
        totalHours: primaryJob.totalHours
      },
      agreedPayment: {
        grossAmount: primaryJob.grossPay,
        amount: primaryJob.grossPay,
        currency: 'INR',
        basis: primaryJob.payBasis
      },
      status: ASSIGNMENT_STATUSES.CONFIRMED
    });

    await PaymentRecord.create({
      assignment: assign2._id,
      job: primaryJob._id,
      worker: worker2._id,
      employer: employer._id,
      amount: primaryJob.grossPay,
      currency: 'INR',
      basis: primaryJob.payBasis,
      status: PAYMENT_STATUSES.DUE,
      paymentMethod: 'UPI'
    });

    // Update filledCount on primary job
    primaryJob.filledCount = 2;
    await primaryJob.save();
  }

  console.log('\n[Seed Catering Jobs] SUMMARY:');
  console.log(`  Employer Email: ${employerEmail}`);
  console.log(`  Password:       ${rawPassword}`);
  console.log(`  Total Jobs:     ${createdJobs.length} published jobs`);
  console.log('  Job Categories: Wedding and catering support, Restaurant and hospitality, Event assistance, Warehouse and packing');
  console.log('  Locations:      Kawala Naka, Atigre (SGU), Tarabai Park, Station Road, Ichalkaranji, Shiroli MIDC');

  await disconnectDB();
  console.log('[Seed Catering Jobs] Database connection closed. Done!');
}

// Execute directly
seedCateringJobsForKolhapurEmployer()
  .then(() => {
    console.log('[Seed Finished Successfully]');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seed Error]:', err);
    process.exit(1);
  });

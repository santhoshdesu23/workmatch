import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Job } from '../src/models/Job.js';
import { User } from '../src/models/User.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Identifiers for known original seed demo jobs in New York
const DISPOSABLE_NYC_SEED_TITLES = [
  'Banquet Guest Check-in & Registration Assistant',
  'Gala Dinner Plated Service & Table Prep',
  'E-Commerce Peak Fulfillment & Box Packing',
  'Weekend Pop-up Store Floor & Stock Support',
  'Museum Exhibition Opening Night Usher & Host'
];

export async function backupAndCleanupJobs(options = { dryRun: false }) {
  console.log('[Cleanup] Starting safe job backup & targeted cleanup...');
  await connectDB();

  // 1. Fetch all current jobs to inspect
  const allJobs = await Job.find({}).lean();
  console.log(`[Cleanup] Found ${allJobs.length} total job(s) in the database.`);

  // 2. Identify demo employers
  const demoUsers = await User.find({
    email: { $in: ['employer@workmatch.demo', 'employer2@workmatch.demo', 'admin@workmatch.demo'] }
  }).select('_id email name').lean();
  const demoUserIds = new Set(demoUsers.map(u => u._id.toString()));

  // 3. Identify disposable NYC demo jobs
  const disposableJobs = [];
  const preservedJobs = [];

  for (const job of allJobs) {
    const isDemoEmployer = job.employer && demoUserIds.has(job.employer.toString());
    const isNycTitle = DISPOSABLE_NYC_SEED_TITLES.includes(job.title);
    const hasNycLocation = typeof job.locationName === 'string' &&
      (job.locationName.includes('New York') ||
       job.locationName.includes('Brooklyn') ||
       job.locationName.includes('NY 100') ||
       job.locationName.includes('NY 102') ||
       job.locationName.includes('NY 112'));

    if ((isNycTitle || hasNycLocation) && (isDemoEmployer || job.isDemo)) {
      disposableJobs.push(job);
    } else {
      preservedJobs.push(job);
    }
  }

  console.log(`[Cleanup] Identified ${disposableJobs.length} disposable NYC demo job(s).`);
  console.log(`[Cleanup] Preserved ${preservedJobs.length} job(s) (genuine/non-NYC records).`);

  // 4. Create local backup before any modification
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `jobs_backup_${timestamp}.json`);

  const backupData = {
    createdAt: new Date().toISOString(),
    totalJobsInDb: allJobs.length,
    disposableCount: disposableJobs.length,
    preservedCount: preservedJobs.length,
    disposableJobs,
    preservedJobs
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`[Cleanup] Successfully backed up all job records to: ${backupFilePath}`);

  if (options.dryRun) {
    console.log('[Cleanup] DRY RUN mode enabled. No records were deleted.');
    return {
      backupFilePath,
      disposableCount: disposableJobs.length,
      preservedCount: preservedJobs.length,
      deletedCount: 0
    };
  }

  if (disposableJobs.length === 0) {
    console.log('[Cleanup] No disposable NYC demo jobs found. Database is already clean (idempotent).');
    return {
      backupFilePath,
      disposableCount: 0,
      preservedCount: preservedJobs.length,
      deletedCount: 0
    };
  }

  // 5. Targeted deletion using exact IDs of disposable records
  const disposableJobIds = disposableJobs.map(j => j._id);

  // Backup associated demo applications and assignments if any
  const relatedApps = await Application.find({ job: { $in: disposableJobIds } }).lean();
  const relatedAssignments = await Assignment.find({ job: { $in: disposableJobIds } }).lean();
  const relatedPayments = await PaymentRecord.find({ job: { $in: disposableJobIds } }).lean();

  const relatedBackupPath = path.join(backupDir, `related_records_backup_${timestamp}.json`);
  fs.writeFileSync(relatedBackupPath, JSON.stringify({
    applications: relatedApps,
    assignments: relatedAssignments,
    payments: relatedPayments
  }, null, 2), 'utf-8');
  console.log(`[Cleanup] Backed up ${relatedApps.length} related applications, ${relatedAssignments.length} assignments to: ${relatedBackupPath}`);

  // Delete only records explicitly referencing the disposable demo jobs
  await Application.deleteMany({ job: { $in: disposableJobIds } });
  await Assignment.deleteMany({ job: { $in: disposableJobIds } });
  await PaymentRecord.deleteMany({ job: { $in: disposableJobIds } });
  const deleteResult = await Job.deleteMany({ _id: { $in: disposableJobIds } });

  console.log(`[Cleanup] Safely removed ${deleteResult.deletedCount} disposable NYC demo job(s).`);

  return {
    backupFilePath,
    relatedBackupPath,
    disposableCount: disposableJobs.length,
    preservedCount: preservedJobs.length,
    deletedCount: deleteResult.deletedCount
  };
}

// Direct execution from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDryRun = process.argv.includes('--dry-run');
  backupAndCleanupJobs({ dryRun: isDryRun })
    .then(async (result) => {
      console.log('[Cleanup] Finished with result:', result);
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Cleanup] Error:', err);
      await disconnectDB();
      process.exit(1);
    });
}

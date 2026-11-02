import { MATCH_WEIGHTS } from '../config/constants.js';
import {
  isJobOpenForApplications,
  isJobApplicationDeadlinePassed,
  isJobWorkEnded,
  isJobWorkOngoing,
  getEffectiveJobStatus,
  extractCalendarDateParts
} from '../utils/scheduleUtils.js';

export const REQUIREMENT_TYPES = {
  HARD: 'HARD',
  SOFT: 'SOFT'
};

export const PROVENANCE_SOURCES = {
  UI_FILTER: 'UI_FILTER',
  NLP_QUERY: 'NLP_QUERY',
  WORKER_PROFILE: 'WORKER_PROFILE',
  SEARCH_KEYWORD: 'SEARCH_KEYWORD',
  SAFETY_CONDITION: 'SAFETY_CONDITION',
  EMPLOYER_MANDATORY: 'EMPLOYER_MANDATORY'
};

export const MATCH_TYPES = {
  EXACT: 'exact',
  STRONG: 'strong',
  PARTIAL: 'partial'
};

export const SKILL_ALIASES = {
  server: ['waiter', 'waitress', 'food server', 'steward', 'table service'],
  waiter: ['server', 'waitress', 'food server', 'steward'],
  waitress: ['server', 'waiter', 'food server', 'steward'],
  cashier: ['billing', 'counter staff', 'billing executive', 'cash desk', 'pos operator'],
  billing: ['cashier', 'counter staff', 'billing executive', 'pos operator'],
  packing: ['packaging', 'packer', 'box packing', 'order packing'],
  packaging: ['packing', 'packer', 'box packing', 'order packing'],
  packer: ['packing', 'packaging', 'box packing'],
  cleaning: ['housekeeping', 'janitorial', 'sweeper', 'cleaner', 'sanitization'],
  cleaner: ['cleaning', 'housekeeping', 'janitorial', 'sweeper'],
  housekeeping: ['cleaning', 'cleaner', 'janitorial'],
  cook: ['chef', 'cooking', 'kitchen helper', 'food preparation'],
  chef: ['cook', 'cooking', 'head chef'],
  cooking: ['cook', 'chef', 'food preparation'],
  driver: ['driving', 'chauffeur', 'delivery driver', 'cab driver'],
  driving: ['driver', 'chauffeur'],
  delivery: ['dispatch', 'courier', 'delivery executive', 'delivery driver', 'logistics assistant'],
  data_entry: ['data entry', 'typing', 'data operator', 'back office', 'computer operator', 'excel'],
  typing: ['data entry', 'computer operator'],
  bartender: ['bar tender', 'mixologist'],
  carpenter: ['carpentry', 'woodwork', 'woodworking'],
  carpentry: ['carpenter', 'woodwork']
};

export const RELATED_CATEGORIES = {
  'Event assistance': ['Wedding and catering support', 'Tutoring and event staffing', 'Restaurant and hospitality'],
  'Wedding and catering support': ['Event assistance', 'Restaurant and hospitality'],
  'Restaurant and hospitality': ['Wedding and catering support', 'Cleaning and maintenance', 'Event assistance'],
  'Retail and store assistance': ['Warehouse and packing', 'Data entry and office assistance'],
  'Warehouse and packing': ['Retail and store assistance', 'Delivery and logistics'],
  'Delivery and logistics': ['Warehouse and packing'],
  'Cleaning and maintenance': ['Restaurant and hospitality', 'Warehouse and packing'],
  'Data entry and office assistance': ['Retail and store assistance', 'Tutoring and event staffing'],
  'Tutoring and event staffing': ['Event assistance', 'Data entry and office assistance']
};

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const distance = calculateDistanceKmPrecise(lat1, lon1, lat2, lon2);
  return distance === null ? null : Math.round(distance * 10) / 10;
}

/** Calculates unrounded great-circle distance in kilometers for boundary checks. */
export function calculateDistanceKmPrecise(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    lat1 === undefined || lon1 === undefined ||
    lat2 === undefined || lon2 === undefined ||
    isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2) ||
    nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90 ||
    nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180 ||
    (nLat1 === 0 && nLon1 === 0) ||
    (nLat2 === 0 && nLon2 === 0)
  ) {
    return null;
  }

  const R = 6371; // Earth radius in kilometers
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalizes and sanitizes an array of skill strings.
 * Filters out non-strings, null, undefined, empty/whitespace-only items.
 * Trims surrounding whitespace and deduplicates case-insensitively.
 */
export function sanitizeSkills(skills) {
  if (!skills || !Array.isArray(skills)) return [];
  const seen = new Set();
  const result = [];

  for (const s of skills) {
    if (typeof s === 'string') {
      const trimmed = s.trim();
      if (trimmed.length > 0) {
        const lower = trimmed.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          result.push(trimmed);
        }
      }
    }
  }

  return result;
}

/**
 * Normalizes text for skill comparison
 */
export function normalizeSkill(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Compares two skill strings using exact, alias-based, or whole-token word boundary matching.
 * Strictly prevents false substring matches like "car" matching "carpenter" or "bar" matching "bartender".
 */
export function areSkillsMatching(skillA, skillB) {
  const normA = normalizeSkill(skillA);
  const normB = normalizeSkill(skillB);
  if (!normA || !normB) return false;

  // 1. Exact normalized match
  if (normA === normB) return true;

  // 2. Alias mapping lookup
  const checkAlias = (base, target) => {
    const key = base.replace(/\s+/g, '_');
    const aliases = SKILL_ALIASES[key] || SKILL_ALIASES[base] || [];
    return aliases.some((al) => normalizeSkill(al) === target);
  };
  if (checkAlias(normA, normB) || checkAlias(normB, normA)) return true;

  // 3. Whole-token word boundary match (only when one is a multi-word phrase containing the other as a whole word)
  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensB = normB.split(/\s+/).filter(Boolean);

  if (tokensA.length > 1 && tokensB.length === 1) {
    if (tokensA.includes(normB) || tokensA.some((t) => checkAlias(t, normB))) {
      return true;
    }
  }
  if (tokensB.length > 1 && tokensA.length === 1) {
    if (tokensB.includes(normA) || tokensB.some((t) => checkAlias(t, normA))) {
      return true;
    }
  }

  // Cross-token alias match
  for (const tA of tokensA) {
    for (const tB of tokensB) {
      if (checkAlias(tA, tB) || checkAlias(tB, tA)) return true;
    }
  }

  return false;
}

/**
 * Calculates effective job duration in hours without arbitrary 8-hour assumptions.
 */
export function calculateJobHours(job) {
  if (!job) return 8;
  if (job.totalHours !== undefined && job.totalHours !== null && Number(job.totalHours) > 0) {
    return Number(job.totalHours);
  }
  if (job.startTime && job.endTime) {
    const sParts = String(job.startTime).split(':').map(Number);
    const eParts = String(job.endTime).split(':').map(Number);
    if (!isNaN(sParts[0]) && !isNaN(eParts[0])) {
      let startMins = sParts[0] * 60 + (sParts[1] || 0);
      let endMins = eParts[0] * 60 + (eParts[1] || 0);
      let diffMins = endMins - startMins;
      if (diffMins <= 0) {
        // Overnight shift
        diffMins += 24 * 60;
      }
      const breakMins = Number(job.breakDurationMinutes) || 0;
      const netMins = Math.max(30, diffMins - breakMins);
      return Math.round((netMins / 60) * 10) / 10;
    }
  }
  return 8;
}

/**
 * Derives shift timing window ('morning', 'afternoon', 'evening', 'night') from start time string.
 */
export function getShiftTimingFromStartTime(startTime) {
  if (!startTime || typeof startTime !== 'string') return null;
  const hour = parseInt(startTime.split(':')[0], 10);
  if (isNaN(hour)) return null;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Evaluates skill matching for a candidate against required and optional skills.
 */
export function evaluateSkillsScore(workerSkills = [], requiredSkills = [], optionalSkills = []) {
  const safeRequired = sanitizeSkills(requiredSkills);
  const safeWorker = sanitizeSkills(workerSkills);
  const safeOptional = sanitizeSkills(optionalSkills);

  if (safeRequired.length === 0 && safeOptional.length === 0) {
    return {
      score: 1.0,
      matchedSkills: [],
      missingSkills: [],
      missingOptionalSkills: [],
      explanation: 'No specific prerequisite skills required for this job.'
    };
  }

  if (safeWorker.length === 0) {
    return {
      score: 0.0,
      matchedSkills: [],
      missingSkills: safeRequired,
      missingOptionalSkills: safeOptional,
      explanation: 'Add your skills to your profile to improve matching accuracy.'
    };
  }

  const matched = [];
  const missing = [];

  for (const req of safeRequired) {
    const hasMatch = safeWorker.some((w) => areSkillsMatching(w, req));
    if (hasMatch) {
      matched.push(req);
    } else {
      missing.push(req);
    }
  }

  const missingOptional = [];
  for (const opt of safeOptional) {
    const hasMatch = safeWorker.some((w) => areSkillsMatching(w, opt));
    if (hasMatch) {
      if (!matched.includes(opt)) matched.push(opt);
    } else {
      missingOptional.push(opt);
    }
  }

  const reqScore = safeRequired.length > 0 ? matched.filter((m) => safeRequired.includes(m)).length / safeRequired.length : 1.0;
  const optScore = safeOptional.length > 0 ? (safeOptional.length - missingOptional.length) / safeOptional.length : 1.0;

  const score = safeOptional.length > 0 && safeRequired.length > 0
    ? reqScore * 0.85 + optScore * 0.15
    : reqScore;

  const explanation = safeRequired.length > 0
    ? `${matched.filter((m) => safeRequired.includes(m)).length} of ${safeRequired.length} required skill${
        safeRequired.length === 1 ? '' : 's'
      } match your profile.`
    : `${matched.length} optional skill${matched.length === 1 ? '' : 's'} match your profile.`;

  return {
    score: Math.round(score * 100) / 100,
    matchedSkills: matched,
    missingSkills: missing,
    missingOptionalSkills: missingOptional,
    explanation
  };
}

/**
 * Evaluates location compatibility and tracks distance reliability
 */
export function evaluateLocationScore(workerLocation, jobLocation, travelRadiusKm = 25) {
  const radius = Number(travelRadiusKm) > 0 ? Number(travelRadiusKm) : 25;

  if (
    !workerLocation?.coordinates ||
    !jobLocation?.coordinates ||
    !Array.isArray(workerLocation.coordinates) ||
    !Array.isArray(jobLocation.coordinates) ||
    workerLocation.coordinates.length < 2 ||
    jobLocation.coordinates.length < 2
  ) {
    return {
      score: 0.5,
      distanceKm: null,
      distanceReliability: 'unknown',
      explanation: 'Distance unknown (coordinates not calibrated). Location compatibility estimated.'
    };
  }

  const [wLon, wLat] = workerLocation.coordinates;
  const [jLon, jLat] = jobLocation.coordinates;
  const distance = calculateDistanceKm(wLat, wLon, jLat, jLon);

  if (distance === null) {
    return {
      score: 0.5,
      distanceKm: null,
      distanceReliability: 'unknown',
      explanation: 'Distance unknown: could not be calculated from coordinates.'
    };
  }

  if (distance <= radius) {
    const score = Math.max(0.7, 1.0 - (0.3 * distance) / radius);
    return {
      score: Math.round(score * 100) / 100,
      distanceKm: distance,
      distanceReliability: 'exact',
      explanation: `Located ~${distance} km away, comfortably within your ${radius} km travel radius.`
    };
  } else {
    if (distance > Math.max(100, radius * 3)) {
      return {
        score: 0.0,
        distanceKm: distance,
        distanceReliability: 'exact',
        explanation: `Located ~${distance} km away, far outside your ${radius} km travel radius (different region/overseas).`
      };
    }
    const excess = distance - radius;
    const score = Math.max(0.0, 0.65 - (0.65 * excess) / (radius * 2));
    return {
      score: Math.round(score * 100) / 100,
      distanceKm: distance,
      distanceReliability: 'exact',
      explanation: `Located ~${distance} km away, exceeding your preferred ${radius} km radius.`
    };
  }
}

/**
 * Evaluates availability compatibility
 */
export function evaluateAvailabilityScore(workerAvailability, jobDate, jobStartTime) {
  if (!workerAvailability || !workerAvailability.isAvailable) {
    return {
      score: 0.2,
      explanation: 'Your profile is currently marked as unavailable for new shifts.'
    };
  }

  if (!jobDate) {
    return {
      score: 0.5,
      explanation: 'Job work date unspecified.'
    };
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const workDateObj = new Date(jobDate);
  if (isNaN(workDateObj.getTime())) {
    return {
      score: 0.5,
      explanation: 'Job schedule date is pending confirmation.'
    };
  }

  const dayName = daysOfWeek[workDateObj.getUTCDay()];
  const workerDays = Array.isArray(workerAvailability.days) ? workerAvailability.days : [];
  const dayMatches = workerDays.length === 0 || workerDays.includes(dayName);

  const slot = getShiftTimingFromStartTime(jobStartTime) || 'morning';
  const capitalizedSlot = slot.charAt(0).toUpperCase() + slot.slice(1);

  const workerSlots = Array.isArray(workerAvailability.timeSlots) ? workerAvailability.timeSlots : [];
  const slotMatches = workerSlots.length === 0 || workerSlots.some((s) => s.toLowerCase() === slot.toLowerCase());

  if (dayMatches && slotMatches) {
    return {
      score: 1.0,
      explanation: `Aligns with your declared availability for ${dayName} (${capitalizedSlot} shift).`
    };
  } else if (dayMatches) {
    return {
      score: 0.7,
      explanation: `Matches your available day (${dayName}), though you usually prefer other time slots.`
    };
  } else {
    return {
      score: 0.3,
      explanation: `Job is scheduled on ${dayName}, which is outside your typical available days.`
    };
  }
}

/**
 * Evaluates payment compatibility using actual job duration
 */
export function evaluatePaymentScore(expectedPay, jobGrossPay, jobPayBasis, jobHours = 1) {
  const pay = Number(jobGrossPay) || 0;
  const hours = Number(jobHours) > 0 ? Number(jobHours) : 1;

  if (!expectedPay || (!expectedPay.min && !expectedPay.max)) {
    return {
      score: 0.8,
      explanation: 'Fits general compensation norms (no specific rate constraint provided).'
    };
  }

  let effectiveJobHourly = pay;
  if (jobPayBasis === 'daily' || jobPayBasis === 'shift' || jobPayBasis === 'task') {
    effectiveJobHourly = hours > 0 ? pay / hours : pay / 8;
  }

  let effectiveExpectedHourly = Number(expectedPay.min) || 0;
  if (expectedPay.basis === 'daily' || expectedPay.basis === 'shift') {
    effectiveExpectedHourly = effectiveExpectedHourly / 8;
  }

  if (effectiveExpectedHourly <= 0) {
    return {
      score: 1.0,
      explanation: `Offered rate of ₹${pay} (${jobPayBasis || 'hourly'}) matches your compensation criteria.`
    };
  }

  if (effectiveJobHourly >= effectiveExpectedHourly) {
    return {
      score: 1.0,
      explanation: `Offered pay (₹${pay} / ${jobPayBasis || 'hourly'}) meets or exceeds your minimum requirement.`
    };
  } else {
    const ratio = effectiveJobHourly / effectiveExpectedHourly;
    const score = Math.max(0.2, Math.min(0.99, ratio));
    return {
      score: Math.round(score * 100) / 100,
      explanation: `Offered rate (₹${pay} / ${jobPayBasis || 'hourly'}) is slightly below your target rate.`
    };
  }
}

/**
 * Evaluates category and experience compatibility with related categories
 */
export function evaluateCategoryScore(preferredCategories = [], jobCategory = '', experienceSummary = '') {
  if (!jobCategory || typeof jobCategory !== 'string' || !jobCategory.trim()) {
    return {
      score: 0.5,
      explanation: 'General temporary work opportunity.'
    };
  }

  const trimmedCat = jobCategory.trim();
  const safePreferred = Array.isArray(preferredCategories) ? preferredCategories : [];
  const matchedCat = safePreferred.some(
    (c) => typeof c === 'string' && c.trim().toLowerCase() === trimmedCat.toLowerCase()
  );

  if (matchedCat) {
    return {
      score: 1.0,
      explanation: `Direct match with your preferred category "${trimmedCat}".`
    };
  }

  if (safePreferred.length === 0) {
    return {
      score: 0.7,
      explanation: `Job in "${trimmedCat}". Open category preferences recorded.`
    };
  }

  // Check related categories
  const isRelated = safePreferred.some((pref) => {
    const related = RELATED_CATEGORIES[pref] || [];
    return related.some((rel) => rel.toLowerCase() === trimmedCat.toLowerCase());
  });

  if (isRelated) {
    return {
      score: 0.8,
      explanation: `Job in "${trimmedCat}", closely related to your preferred categories.`
    };
  }

  return {
    score: 0.4,
    explanation: `Job is in "${trimmedCat}", outside your preferred primary categories.`
  };
}

/**
 * Calculates data completeness percentage of worker profile
 */
export function calculateProfileCompleteness(profile) {
  if (!profile) return 0;
  let filled = 0;
  let total = 6;

  if (sanitizeSkills(profile?.skills).length > 0) filled++;
  if (profile.bio && profile.bio.trim().length > 10) filled++;
  if (profile.preferredCategories && profile.preferredCategories.length > 0) filled++;
  if (profile.preferredLocationName || (profile.location?.coordinates && profile.location.coordinates[0] !== 0)) filled++;
  if (profile.availability?.days && profile.availability.days.length > 0) filled++;
  if (profile.expectedPay?.min > 0 || profile.expectedPay?.max > 0) filled++;

  return Math.round((filled / total) * 100);
}

/**
 * Main explainable matching engine for single job evaluation
 */
export function computeJobMatch(workerProfile, job) {
  const safeJob = job || {};
  const jobHours = calculateJobHours(safeJob);
  const skillsRes = evaluateSkillsScore(workerProfile?.skills, safeJob.requiredSkills, safeJob.optionalSkills);
  const locationRes = evaluateLocationScore(workerProfile?.location, safeJob.location, workerProfile?.travelRadiusKm || 25);
  const availRes = evaluateAvailabilityScore(workerProfile?.availability, safeJob.workDate, safeJob.startTime);
  const payRes = evaluatePaymentScore(workerProfile?.expectedPay, safeJob.grossPay, safeJob.payBasis, jobHours);
  const catRes = evaluateCategoryScore(workerProfile?.preferredCategories, safeJob.category, workerProfile?.experienceSummary);

  const rawScore =
    MATCH_WEIGHTS.SKILLS * skillsRes.score +
    MATCH_WEIGHTS.LOCATION * locationRes.score +
    MATCH_WEIGHTS.AVAILABILITY * availRes.score +
    MATCH_WEIGHTS.PAYMENT * payRes.score +
    MATCH_WEIGHTS.CATEGORY_EXPERIENCE * catRes.score;

  const matchScore = Math.min(100, Math.max(0, Math.round(rawScore * 100)));
  const completeness = calculateProfileCompleteness(workerProfile);

  const explanations = [
    skillsRes.explanation,
    locationRes.explanation,
    availRes.explanation,
    payRes.explanation,
    catRes.explanation
  ];

  const warnings = [];
  if (sanitizeSkills(workerProfile?.skills).length === 0) {
    warnings.push('No skills declared in worker profile; matches are limited.');
  }
  if (workerProfile?.availability && !workerProfile.availability.isAvailable) {
    warnings.push('Your profile is marked unavailable.');
  }
  if (!workerProfile?.location?.coordinates || (workerProfile.location.coordinates[0] === 0 && workerProfile.location.coordinates[1] === 0)) {
    warnings.push('Worker location is approximate or not set; distance score estimated.');
  }
  if (safeJob.ageRestriction && safeJob.ageRestriction.includes('18+')) {
    warnings.push('Candidate must meet minimum 18+ age requirement.');
  }

  return {
    matchScore,
    weights: MATCH_WEIGHTS,
    componentScores: {
      skills: Math.round(skillsRes.score * 100),
      location: Math.round(locationRes.score * 100),
      availability: Math.round(availRes.score * 100),
      payment: Math.round(payRes.score * 100),
      categoryExperience: Math.round(catRes.score * 100)
    },
    matchedSkills: skillsRes.matchedSkills,
    missingSkills: skillsRes.missingSkills,
    missingOptionalSkills: skillsRes.missingOptionalSkills || [],
    distanceKm: locationRes.distanceKm,
    distanceReliability: locationRes.distanceReliability,
    dataCompleteness: completeness,
    explanations,
    warnings,
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * Classifies a job match for a worker into EXACT, STRONG, or PARTIAL.
 * Enforces strict hard requirements: if ANY hard requirement or employer-defined mandatory requirement
 * is violated, the job is NOT eligible for ANY match tier (cannot be partial match).
 */
export function classifyJobMatch({
  job,
  workerProfile = null,
  filters = {},
  now = new Date()
}) {
  const safeJob = job || {};
  const rejectionReasons = [];

  // ==========================================
  // 1. HARD REQUIREMENTS: SAFETY & STATUS
  // ==========================================
  if (safeJob.status !== 'OPEN') {
    rejectionReasons.push('Job status is not OPEN');
  }

  const openings = Number(safeJob.openings) || 0;
  const filled = Number(safeJob.filledCount) || 0;
  if (openings > 0 && filled >= openings) {
    rejectionReasons.push('All openings for this job are filled');
  }

  if (isJobApplicationDeadlinePassed(safeJob, now)) {
    rejectionReasons.push('Application deadline has passed');
  }

  if (isJobWorkEnded(safeJob, now)) {
    rejectionReasons.push('Scheduled work has already ended');
  }

  // ==========================================
  // 2. HARD REQUIREMENTS: EXPLICIT UI / NLP FILTERS
  // ==========================================
  // A. Category Filter
  if (filters.category && typeof filters.category === 'string' && filters.category.trim()) {
    const filterCat = filters.category.trim().toLowerCase();
    const jobCat = String(safeJob.category || '').trim().toLowerCase();
    if (filterCat !== jobCat) {
      rejectionReasons.push(`Category mismatch: required "${filters.category}", job is "${safeJob.category}"`);
    }
  }

  // B. Pay Filters (minPay, maxPay, payBasis)
  if (filters.minPay !== undefined && filters.minPay !== null && filters.minPay !== '') {
    const minPayNum = Number(filters.minPay);
    if (!isNaN(minPayNum) && Number(safeJob.grossPay) < minPayNum) {
      rejectionReasons.push(`Offered pay (₹${safeJob.grossPay}) is less than required minimum (₹${minPayNum})`);
    }
  }

  if (filters.maxPay !== undefined && filters.maxPay !== null && filters.maxPay !== '') {
    const maxPayNum = Number(filters.maxPay);
    if (!isNaN(maxPayNum) && Number(safeJob.grossPay) > maxPayNum) {
      rejectionReasons.push(`Offered pay (₹${safeJob.grossPay}) exceeds requested maximum (₹${maxPayNum})`);
    }
  }

  if (filters.payBasis && typeof filters.payBasis === 'string' && filters.payBasis.trim()) {
    const filterBasis = filters.payBasis.trim().toLowerCase();
    const jobBasis = String(safeJob.payBasis || '').trim().toLowerCase();
    if (filterBasis !== jobBasis) {
      rejectionReasons.push(`Payment basis mismatch: requested "${filters.payBasis}", job is "${safeJob.payBasis}"`);
    }
  }

  // C. Date Filter (Single date or date range)
  if (filters.workDate) {
    const filterParts = extractCalendarDateParts(filters.workDate);
    const jobParts = extractCalendarDateParts(safeJob.workDate);
    if (filterParts && jobParts) {
      const isDateMatch =
        filterParts.year === jobParts.year &&
        filterParts.monthIndex === jobParts.monthIndex &&
        filterParts.day === jobParts.day;

      if (filters.workDateTo) {
        const filterToParts = extractCalendarDateParts(filters.workDateTo);
        if (filterToParts) {
          const filterStartDate = new Date(filterParts.year, filterParts.monthIndex, filterParts.day);
          const filterEndDate = new Date(filterToParts.year, filterToParts.monthIndex, filterToParts.day);
          const jobDate = new Date(jobParts.year, jobParts.monthIndex, jobParts.day);
          if (jobDate < filterStartDate || jobDate > filterEndDate) {
            rejectionReasons.push(`Job date falls outside requested date range`);
          }
        } else if (!isDateMatch) {
          rejectionReasons.push(`Job date does not match requested date`);
        }
      } else if (!isDateMatch) {
        rejectionReasons.push(`Job date does not match requested date`);
      }
    }
  }

  // D. Shift Timing Filter ('morning', 'afternoon', 'evening', 'night')
  if (filters.shiftTiming && typeof filters.shiftTiming === 'string' && filters.shiftTiming.trim()) {
    const requestedTiming = filters.shiftTiming.trim().toLowerCase();
    const jobTiming = getShiftTimingFromStartTime(safeJob.startTime);
    if (jobTiming && jobTiming !== requestedTiming) {
      rejectionReasons.push(`Shift timing mismatch: requested "${requestedTiming}", job is "${jobTiming}"`);
    }
  }

  // E. Explicit Distance Radius Filter
  let computedDistanceKm = null;
  let distanceReliability = 'unknown';

  const originLat = filters.originLat !== undefined ? filters.originLat : filters.lat;
  const originLng = filters.originLng !== undefined ? filters.originLng : filters.lng;

  const hasOriginCoords =
    originLat !== undefined && originLat !== null &&
    originLng !== undefined && originLng !== null &&
    !isNaN(Number(originLat)) && !isNaN(Number(originLng)) &&
    !(Number(originLat) === 0 && Number(originLng) === 0);

  const jobCoords = safeJob.location?.coordinates;
  const hasJobCoords =
    Array.isArray(jobCoords) && jobCoords.length >= 2 &&
    jobCoords[0] !== null && jobCoords[1] !== null &&
    !isNaN(Number(jobCoords[0])) && !isNaN(Number(jobCoords[1])) &&
    !(Number(jobCoords[0]) === 0 && Number(jobCoords[1]) === 0);

  if (hasOriginCoords && hasJobCoords) {
    computedDistanceKm = calculateDistanceKm(Number(originLat), Number(originLng), Number(jobCoords[1]), Number(jobCoords[0]));
    distanceReliability = 'exact';
  }

  if (filters.maxDistanceKm !== undefined && filters.maxDistanceKm !== null && filters.maxDistanceKm !== '') {
    const maxRadius = Number(filters.maxDistanceKm);
    if (!isNaN(maxRadius) && maxRadius > 0) {
      if (!hasJobCoords || !hasOriginCoords) {
        rejectionReasons.push('Distance cannot be determined for distance radius search');
      } else {
        const preciseDist = calculateDistanceKmPrecise(Number(originLat), Number(originLng), Number(jobCoords[1]), Number(jobCoords[0]));
        if (preciseDist === null || preciseDist > maxRadius) {
          rejectionReasons.push(`Job distance exceeds explicit radius of ${maxRadius} km`);
        }
      }
    }
  }

  // ==========================================
  // 3. HARD REQUIREMENTS: EMPLOYER MANDATORY REQUIRED SKILLS
  // ==========================================
  const employerRequiredSkills = sanitizeSkills(safeJob.requiredSkills);
  let matchedSkills = [];
  let missingRequiredSkills = [];
  let missingOptionalSkills = [];

  if (workerProfile) {
    const workerSkills = sanitizeSkills(workerProfile.skills);
    if (employerRequiredSkills.length > 0) {
      for (const reqSkill of employerRequiredSkills) {
        const matches = workerSkills.some((ws) => areSkillsMatching(ws, reqSkill));
        if (matches) {
          matchedSkills.push(reqSkill);
        } else {
          missingRequiredSkills.push(reqSkill);
        }
      }

      if (missingRequiredSkills.length > 0) {
        rejectionReasons.push(
          `Missing employer mandatory required skill(s): ${missingRequiredSkills.join(', ')}`
        );
      }
    }

    // Check optional skills
    const employerOptionalSkills = sanitizeSkills(safeJob.optionalSkills);
    for (const optSkill of employerOptionalSkills) {
      const matches = workerSkills.some((ws) => areSkillsMatching(ws, optSkill));
      if (matches) {
        if (!matchedSkills.includes(optSkill)) matchedSkills.push(optSkill);
      } else {
        missingOptionalSkills.push(optSkill);
      }
    }
  }

  // If ANY hard requirement was violated, the candidate is NOT eligible for ANY group
  if (rejectionReasons.length > 0) {
    return {
      eligible: false,
      rejectionReasons,
      matchType: null,
      matchScore: 0
    };
  }

  // ==========================================
  // 4. SOFT PREFERENCES & COMPATIBILITY EVALUATION
  // ==========================================
  const preferenceDifferences = [];
  const matchedRequirements = [];

  // Track matched hard criteria
  matchedRequirements.push('Job is open and accepting applications');
  matchedRequirements.push(`Shift schedule: ${safeJob.startTime} – ${safeJob.endTime}`);
  if (safeJob.grossPay) {
    matchedRequirements.push(`Compensation: ₹${safeJob.grossPay} (${safeJob.payBasis || 'hourly'})`);
  }
  if (matchedSkills.length > 0) {
    matchedRequirements.push(`Matched skills: ${matchedSkills.join(', ')}`);
  }

  if (workerProfile) {
    // A. Preferred Category (Soft Preference when no explicit filter set)
    if (!filters.category && Array.isArray(workerProfile.preferredCategories) && workerProfile.preferredCategories.length > 0) {
      const jobCat = String(safeJob.category || '').trim();
      const exactCatMatch = workerProfile.preferredCategories.some(
        (c) => c.toLowerCase() === jobCat.toLowerCase()
      );
      if (exactCatMatch) {
        matchedRequirements.push(`Direct match with preferred category "${jobCat}"`);
      } else {
        const isRelated = workerProfile.preferredCategories.some((pref) => {
          const related = RELATED_CATEGORIES[pref] || [];
          return related.some((rel) => rel.toLowerCase() === jobCat.toLowerCase());
        });
        if (isRelated) {
          preferenceDifferences.push(`Related category: "${jobCat}" (closely related to your profile preferences)`);
        } else {
          preferenceDifferences.push(`Different category: "${jobCat}" vs preferred "${workerProfile.preferredCategories.join(', ')}"`);
        }
      }
    }

    // B. Expected Pay (Soft Preference when no explicit minPay filter set)
    if (filters.minPay === undefined || filters.minPay === null || filters.minPay === '') {
      const jobHours = calculateJobHours(safeJob);
      const payRes = evaluatePaymentScore(workerProfile.expectedPay, safeJob.grossPay, safeJob.payBasis, jobHours);
      if (payRes.score < 1.0 && workerProfile.expectedPay?.min) {
        preferenceDifferences.push(`Offered pay (₹${safeJob.grossPay} / ${safeJob.payBasis || 'hourly'}) is below your profile target of ₹${workerProfile.expectedPay.min}`);
      } else if (workerProfile.expectedPay?.min) {
        matchedRequirements.push(`Pay satisfies your profile expectation`);
      }
    }

    // C. Travel Radius (Soft Preference when no explicit maxDistanceKm filter set)
    if (filters.maxDistanceKm === undefined || filters.maxDistanceKm === null || filters.maxDistanceKm === '') {
      const preferredRadius = Number(workerProfile.travelRadiusKm) > 0 ? Number(workerProfile.travelRadiusKm) : 25;
      const workerCoords = workerProfile.location?.coordinates;
      const workerHasCoords =
        Array.isArray(workerCoords) && workerCoords.length >= 2 &&
        !(Number(workerCoords[0]) === 0 && Number(workerCoords[1]) === 0);

      if (workerHasCoords && hasJobCoords) {
        const profileDist = calculateDistanceKm(
          Number(workerCoords[1]),
          Number(workerCoords[0]),
          Number(jobCoords[1]),
          Number(jobCoords[0])
        );
        if (computedDistanceKm === null) {
          computedDistanceKm = profileDist;
          distanceReliability = 'exact';
        }
        if (profileDist !== null && profileDist > preferredRadius) {
          if (profileDist <= preferredRadius * 1.5) {
            preferenceDifferences.push(`Slightly outside preferred travel radius (~${profileDist} km away vs ${preferredRadius} km preferred)`);
          } else {
            preferenceDifferences.push(`Located ~${profileDist} km away, exceeding your preferred ${preferredRadius} km radius`);
          }
        } else if (profileDist !== null) {
          matchedRequirements.push(`Located ~${profileDist} km away, within your ${preferredRadius} km travel radius`);
        }
      } else if (!hasJobCoords || !workerHasCoords) {
        distanceReliability = 'unknown';
        preferenceDifferences.push('Distance unknown (coordinates not calibrated)');
      }
    }

    // D. Availability (Soft Preference when no explicit workDate or shiftTiming filter set)
    if (!filters.workDate && !filters.shiftTiming && workerProfile.availability) {
      const availRes = evaluateAvailabilityScore(workerProfile.availability, safeJob.workDate, safeJob.startTime);
      if (availRes.score < 0.6) {
        preferenceDifferences.push(availRes.explanation);
      } else if (availRes.score < 1.0) {
        preferenceDifferences.push(availRes.explanation);
      } else {
        matchedRequirements.push(availRes.explanation);
      }
    }

    // E. Missing Optional Skills
    if (missingOptionalSkills.length > 0) {
      preferenceDifferences.push(`Missing ${missingOptionalSkills.length} optional skill(s): ${missingOptionalSkills.join(', ')}`);
    }
  }

  // ==========================================
  // 5. CLASSIFICATION: EXACT, STRONG, PARTIAL
  // ==========================================
  let matchType;
  const matchResult = workerProfile ? computeJobMatch(workerProfile, safeJob) : null;
  const baseScore = matchResult ? matchResult.matchScore : 90;

  if (preferenceDifferences.length === 0) {
    matchType = MATCH_TYPES.EXACT;
  } else if (preferenceDifferences.length === 1) {
    matchType = MATCH_TYPES.STRONG;
  } else {
    matchType = MATCH_TYPES.PARTIAL;
  }

  // Calibrate final score to match classification tier
  let finalScore = baseScore;
  if (matchType === MATCH_TYPES.EXACT) {
    finalScore = Math.max(85, Math.min(100, baseScore));
  } else if (matchType === MATCH_TYPES.STRONG) {
    finalScore = Math.min(84, Math.max(70, baseScore));
  } else {
    finalScore = Math.min(69, Math.max(40, baseScore));
  }

  const explanations = matchResult ? matchResult.explanations : [];

  return {
    eligible: true,
    matchType,
    matchScore: finalScore,
    matchedRequirements,
    matchedSkills,
    missingOptionalSkills,
    preferenceDifferences,
    distanceKm: computedDistanceKm,
    distanceReliability,
    explanations
  };
}

/**
 * Partitions a candidate list of jobs into exact, strong, and partial match buckets.
 * Supports showCloseMatches toggle (default: true).
 */
export function partitionMixedJobMatches(jobs = [], {
  workerProfile = null,
  filters = {},
  provenanceMap = {},
  showCloseMatches = true,
  now = new Date()
} = {}) {
  const exact = [];
  const strong = [];
  const partial = [];
  const appliedRequirements = [];

  // Track applied requirement provenance
  if (filters.category) {
    appliedRequirements.push({
      field: 'category',
      value: filters.category,
      type: REQUIREMENT_TYPES.HARD,
      source: provenanceMap.category || PROVENANCE_SOURCES.UI_FILTER
    });
  }
  if (filters.minPay) {
    appliedRequirements.push({
      field: 'minPay',
      value: Number(filters.minPay),
      type: REQUIREMENT_TYPES.HARD,
      source: provenanceMap.minPay || PROVENANCE_SOURCES.UI_FILTER
    });
  }
  if (filters.maxPay) {
    appliedRequirements.push({
      field: 'maxPay',
      value: Number(filters.maxPay),
      type: REQUIREMENT_TYPES.HARD,
      source: provenanceMap.maxPay || PROVENANCE_SOURCES.UI_FILTER
    });
  }
  if (filters.payBasis) {
    appliedRequirements.push({
      field: 'payBasis',
      value: filters.payBasis,
      type: REQUIREMENT_TYPES.HARD,
      source: provenanceMap.payBasis || PROVENANCE_SOURCES.UI_FILTER
    });
  }
  if (filters.workDate) {
    appliedRequirements.push({
      field: 'workDate',
      value: filters.workDate,
      type: REQUIREMENT_TYPES.HARD,
      source: provenanceMap.workDate || PROVENANCE_SOURCES.UI_FILTER
    });
  }
  if (filters.shiftTiming) {
    appliedRequirements.push({
      field: 'shiftTiming',
      value: filters.shiftTiming,
      type: REQUIREMENT_TYPES.HARD,
      source: provenanceMap.shiftTiming || PROVENANCE_SOURCES.UI_FILTER
    });
  }
  if (filters.maxDistanceKm) {
    appliedRequirements.push({
      field: 'maxDistanceKm',
      value: Number(filters.maxDistanceKm),
      type: REQUIREMENT_TYPES.HARD,
      source: provenanceMap.maxDistanceKm || PROVENANCE_SOURCES.UI_FILTER
    });
  }

  // System Safety Invariants
  appliedRequirements.push(
    { field: 'status', value: 'OPEN', type: REQUIREMENT_TYPES.HARD, source: PROVENANCE_SOURCES.SAFETY_CONDITION },
    { field: 'applicationDeadline', value: 'NOT_PASSED', type: REQUIREMENT_TYPES.HARD, source: PROVENANCE_SOURCES.SAFETY_CONDITION },
    { field: 'workSchedule', value: 'NOT_ENDED', type: REQUIREMENT_TYPES.HARD, source: PROVENANCE_SOURCES.SAFETY_CONDITION },
    { field: 'openingsRemaining', value: '>0', type: REQUIREMENT_TYPES.HARD, source: PROVENANCE_SOURCES.SAFETY_CONDITION }
  );

  // Soft Profile Preferences
  if (workerProfile?.preferredCategories?.length > 0 && !filters.category) {
    appliedRequirements.push({
      field: 'preferredCategories',
      value: workerProfile.preferredCategories,
      type: REQUIREMENT_TYPES.SOFT,
      source: PROVENANCE_SOURCES.WORKER_PROFILE
    });
  }
  if (workerProfile?.expectedPay?.min && !filters.minPay) {
    appliedRequirements.push({
      field: 'expectedPay',
      value: workerProfile.expectedPay.min,
      type: REQUIREMENT_TYPES.SOFT,
      source: PROVENANCE_SOURCES.WORKER_PROFILE
    });
  }
  if (workerProfile?.travelRadiusKm && !filters.maxDistanceKm) {
    appliedRequirements.push({
      field: 'travelRadiusKm',
      value: workerProfile.travelRadiusKm,
      type: REQUIREMENT_TYPES.SOFT,
      source: PROVENANCE_SOURCES.WORKER_PROFILE
    });
  }
  if (workerProfile?.availability && !filters.workDate) {
    appliedRequirements.push({
      field: 'availability',
      value: workerProfile.availability,
      type: REQUIREMENT_TYPES.SOFT,
      source: PROVENANCE_SOURCES.WORKER_PROFILE
    });
  }

  for (const job of jobs) {
    const classification = classifyJobMatch({
      job,
      workerProfile,
      filters,
      now
    });

    if (!classification.eligible) {
      continue;
    }

    const enhancedJob = {
      ...job,
      matchType: classification.matchType,
      matchScore: classification.matchScore,
      matchedRequirements: classification.matchedRequirements,
      matchedSkills: classification.matchedSkills,
      missingOptionalSkills: classification.missingOptionalSkills,
      preferenceDifferences: classification.preferenceDifferences,
      distanceKm: classification.distanceKm,
      distanceReliability: classification.distanceReliability,
      explanations: classification.explanations
    };

    if (classification.matchType === MATCH_TYPES.EXACT) {
      exact.push(enhancedJob);
    } else if (classification.matchType === MATCH_TYPES.STRONG) {
      strong.push(enhancedJob);
    } else if (classification.matchType === MATCH_TYPES.PARTIAL) {
      partial.push(enhancedJob);
    }
  }

  // Sort partitions by matchScore descending
  exact.sort((a, b) => b.matchScore - a.matchScore);
  strong.sort((a, b) => b.matchScore - a.matchScore);
  partial.sort((a, b) => b.matchScore - a.matchScore);

  const shouldIncludeClose = showCloseMatches !== false && showCloseMatches !== 'false';

  const finalStrong = shouldIncludeClose ? strong : [];
  const finalPartial = shouldIncludeClose ? partial : [];

  const counts = {
    exact: exact.length,
    strong: finalStrong.length,
    partial: finalPartial.length,
    total: exact.length + finalStrong.length + finalPartial.length
  };

  return {
    results: {
      exact,
      strong: finalStrong,
      partial: finalPartial
    },
    counts,
    appliedRequirements,
    evaluatedAt: now.toISOString()
  };
}

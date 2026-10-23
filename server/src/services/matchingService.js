import { MATCH_WEIGHTS } from '../config/constants.js';

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
function normalizeSkill(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

/**
 * Evaluates skill matching
 */
export function evaluateSkillsScore(workerSkills = [], requiredSkills = []) {
  const safeRequired = sanitizeSkills(requiredSkills);
  const safeWorker = sanitizeSkills(workerSkills);

  if (safeRequired.length === 0) {
    return {
      score: 1.0,
      matchedSkills: [],
      missingSkills: [],
      explanation: 'No specific prerequisite skills required for this job.'
    };
  }

  if (safeWorker.length === 0) {
    return {
      score: 0.0,
      matchedSkills: [],
      missingSkills: safeRequired,
      explanation: 'Add your skills to your profile to improve matching accuracy.'
    };
  }

  const normalizedWorkerSkills = safeWorker.map(normalizeSkill);
  const matched = [];
  const missing = [];

  for (const req of safeRequired) {
    const normReq = normalizeSkill(req);
    const hasMatch = normalizedWorkerSkills.some(
      (w) => w === normReq || (w.length >= 3 && normReq.includes(w)) || (normReq.length >= 3 && w.includes(normReq))
    );
    if (hasMatch) {
      matched.push(req);
    } else {
      missing.push(req);
    }
  }

  const score = safeRequired.length > 0 ? matched.length / safeRequired.length : 1.0;
  const explanation = `${matched.length} of ${safeRequired.length} required skill${
    safeRequired.length === 1 ? '' : 's'
  } match your profile.`;

  return {
    score,
    matchedSkills: matched,
    missingSkills: missing,
    explanation
  };
}

/**
 * Evaluates location compatibility
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
      explanation: 'Distance could not be calculated from coordinates.'
    };
  }

  if (distance <= radius) {
    // Linear scaling within travel radius from 1.0 down to 0.7
    const score = Math.max(0.7, 1.0 - (0.3 * distance) / radius);
    return {
      score: Math.round(score * 100) / 100,
      distanceKm: distance,
      explanation: `Located ~${distance} km away, comfortably within your ${radius} km travel radius.`
    };
  } else {
    // If distance is far outside acceptable travel radius (> 3x radius or > 100 km), score drops to 0
    if (distance > Math.max(100, radius * 3)) {
      return {
        score: 0.0,
        distanceKm: distance,
        explanation: `Located ~${distance} km away, far outside your ${radius} km travel radius (different region/overseas).`
      };
    }
    const excess = distance - radius;
    const score = Math.max(0.0, 0.65 - (0.65 * excess) / (radius * 2));
    return {
      score: Math.round(score * 100) / 100,
      distanceKm: distance,
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

  // Time slot estimation
  let slot = 'Morning';
  const hour = parseInt(String(jobStartTime || '9').split(':')[0] || '9', 10);
  if (hour >= 12 && hour < 17) slot = 'Afternoon';
  else if (hour >= 17) slot = 'Evening';

  const workerSlots = Array.isArray(workerAvailability.timeSlots) ? workerAvailability.timeSlots : [];
  const slotMatches = workerSlots.length === 0 || workerSlots.includes(slot);

  if (dayMatches && slotMatches) {
    return {
      score: 1.0,
      explanation: `Aligns with your declared availability for ${dayName} (${slot} shift).`
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
 * Evaluates payment compatibility
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
  if (jobPayBasis === 'daily' || jobPayBasis === 'shift') {
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
      score,
      explanation: `Offered rate (₹${pay} / ${jobPayBasis || 'hourly'}) is slightly below your target rate.`
    };
  }
}

/**
 * Evaluates category and experience compatibility
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
 * Main explainable matching engine
 */
export function computeJobMatch(workerProfile, job) {
  const safeJob = job || {};
  const skillsRes = evaluateSkillsScore(workerProfile?.skills, safeJob.requiredSkills);
  const locationRes = evaluateLocationScore(workerProfile?.location, safeJob.location, workerProfile?.travelRadiusKm || 25);
  const availRes = evaluateAvailabilityScore(workerProfile?.availability, safeJob.workDate, safeJob.startTime);
  const payRes = evaluatePaymentScore(workerProfile?.expectedPay, safeJob.grossPay, safeJob.payBasis, safeJob.totalHours);
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
    distanceKm: locationRes.distanceKm,
    dataCompleteness: completeness,
    explanations,
    warnings,
    evaluatedAt: new Date().toISOString()
  };
}

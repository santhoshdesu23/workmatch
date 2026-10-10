import { MATCH_WEIGHTS } from '../config/constants.js';

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 === undefined || lon1 === undefined ||
    lat2 === undefined || lon2 === undefined ||
    (lat1 === 0 && lon1 === 0) ||
    (lat2 === 0 && lon2 === 0)
  ) {
    return null;
  }

  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Normalizes text for skill comparison
 */
function normalizeSkill(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

/**
 * Evaluates skill matching
 */
export function evaluateSkillsScore(workerSkills = [], requiredSkills = []) {
  if (!requiredSkills || requiredSkills.length === 0) {
    return {
      score: 1.0,
      matchedSkills: [],
      missingSkills: [],
      explanation: 'No specific prerequisite skills required for this job.'
    };
  }

  if (!workerSkills || workerSkills.length === 0) {
    return {
      score: 0.1, // Minimum floor for no skills declared
      matchedSkills: [],
      missingSkills: requiredSkills,
      explanation: 'Add your skills to your profile to improve matching accuracy.'
    };
  }

  const normalizedWorkerSkills = workerSkills.map(normalizeSkill);
  const matched = [];
  const missing = [];

  for (const req of requiredSkills) {
    const normReq = normalizeSkill(req);
    const hasMatch = normalizedWorkerSkills.some(
      (w) => w === normReq || w.includes(normReq) || normReq.includes(w)
    );
    if (hasMatch) {
      matched.push(req);
    } else {
      missing.push(req);
    }
  }

  const score = matched.length / requiredSkills.length;
  const explanation = `${matched.length} of ${requiredSkills.length} required skill${
    requiredSkills.length === 1 ? '' : 's'
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
  if (
    !workerLocation?.coordinates ||
    !jobLocation?.coordinates ||
    (workerLocation.coordinates[0] === 0 && workerLocation.coordinates[1] === 0) ||
    (jobLocation.coordinates[0] === 0 && jobLocation.coordinates[1] === 0)
  ) {
    return {
      score: 0.5,
      distanceKm: null,
      explanation: 'Distance unknown (approximate or uncalibrated coordinates). Location compatibility estimated.'
    };
  }

  const [wLon, wLat] = workerLocation.coordinates;
  const [jLon, jLat] = jobLocation.coordinates;
  const distance = calculateDistanceKm(wLat, wLon, jLat, jLon);

  if (distance === null) {
    return {
      score: 0.5,
      distanceKm: null,
      explanation: 'Distance could not be calculated.'
    };
  }

  if (distance <= travelRadiusKm) {
    // Linear scaling within travel radius from 1.0 down to 0.7
    const score = Math.max(0.7, 1.0 - (0.3 * distance) / travelRadiusKm);
    return {
      score,
      distanceKm: distance,
      explanation: `Located ~${distance} km away, comfortably within your ${travelRadiusKm} km travel radius.`
    };
  } else {
    // Outside travel radius: degraded score
    const excess = distance - travelRadiusKm;
    const score = Math.max(0.1, 0.7 - (0.6 * excess) / travelRadiusKm);
    return {
      score,
      distanceKm: distance,
      explanation: `Located ~${distance} km away, exceeding your preferred ${travelRadiusKm} km radius.`
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

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const workDateObj = new Date(jobDate);
  const dayName = daysOfWeek[workDateObj.getUTCDay()];

  const workerDays = workerAvailability.days || [];
  const dayMatches = workerDays.length === 0 || workerDays.includes(dayName);

  // Time slot estimation
  let slot = 'Morning';
  const hour = parseInt(jobStartTime?.split(':')[0] || '9', 10);
  if (hour >= 12 && hour < 17) slot = 'Afternoon';
  else if (hour >= 17) slot = 'Evening';

  const workerSlots = workerAvailability.timeSlots || [];
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
  if (!expectedPay || (!expectedPay.min && !expectedPay.max)) {
    return {
      score: 0.8,
      explanation: 'Fits general compensation norms (no specific rate constraint provided).'
    };
  }

  // Normalize job rate to hourly equivalent for standard comparison if feasible
  let effectiveJobHourly = jobGrossPay;
  if (jobPayBasis === 'daily' || jobPayBasis === 'shift') {
    effectiveJobHourly = jobHours > 0 ? jobGrossPay / jobHours : jobGrossPay / 8;
  }

  let effectiveExpectedHourly = expectedPay.min || 0;
  if (expectedPay.basis === 'daily' || expectedPay.basis === 'shift') {
    effectiveExpectedHourly = effectiveExpectedHourly / 8;
  }

  if (effectiveExpectedHourly <= 0) {
    return {
      score: 1.0,
      explanation: `Offered rate of $${jobGrossPay} (${jobPayBasis}) matches your compensation criteria.`
    };
  }

  if (effectiveJobHourly >= effectiveExpectedHourly) {
    return {
      score: 1.0,
      explanation: `Offered pay ($${jobGrossPay} / ${jobPayBasis}) meets or exceeds your minimum requirement.`
    };
  } else {
    const ratio = effectiveJobHourly / effectiveExpectedHourly;
    const score = Math.max(0.2, ratio);
    return {
      score,
      explanation: `Offered rate ($${jobGrossPay} / ${jobPayBasis}) is slightly below your target rate.`
    };
  }
}

/**
 * Evaluates category and experience compatibility
 */
export function evaluateCategoryScore(preferredCategories = [], jobCategory, experienceSummary = '') {
  let score = 0.5;
  const matchedCat = preferredCategories.some(
    (c) => c.toLowerCase() === jobCategory.toLowerCase()
  );

  if (matchedCat) {
    score = 1.0;
    return {
      score,
      explanation: `Direct match with your preferred category "${jobCategory}".`
    };
  }

  if (preferredCategories.length === 0) {
    return {
      score: 0.7,
      explanation: `Job in "${jobCategory}". Open category preferences recorded.`
    };
  }

  return {
    score: 0.4,
    explanation: `Job is in "${jobCategory}", outside your preferred primary categories.`
  };
}

/**
 * Calculates data completeness percentage of worker profile
 */
export function calculateProfileCompleteness(profile) {
  if (!profile) return 0;
  let filled = 0;
  let total = 6;

  if (profile.skills && profile.skills.length > 0) filled++;
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
  const skillsRes = evaluateSkillsScore(workerProfile?.skills, job.requiredSkills);
  const locationRes = evaluateLocationScore(workerProfile?.location, job.location, workerProfile?.travelRadiusKm || 25);
  const availRes = evaluateAvailabilityScore(workerProfile?.availability, job.workDate, job.startTime);
  const payRes = evaluatePaymentScore(workerProfile?.expectedPay, job.grossPay, job.payBasis, job.totalHours);
  const catRes = evaluateCategoryScore(workerProfile?.preferredCategories, job.category, workerProfile?.experienceSummary);

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
  if (workerProfile?.availability && !workerProfile.availability.isAvailable) {
    warnings.push('Your profile is marked unavailable.');
  }
  if (!workerProfile?.location?.coordinates || (workerProfile.location.coordinates[0] === 0 && workerProfile.location.coordinates[1] === 0)) {
    warnings.push('Worker location is approximate or not set; distance score estimated.');
  }
  if (job.ageRestriction && job.ageRestriction.includes('18+')) {
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

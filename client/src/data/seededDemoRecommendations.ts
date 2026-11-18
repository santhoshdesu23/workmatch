import { Job, MixedMatchResults, MixedMatchCounts } from '../types';

const now = Date.now();
const oneDayMs = 24 * 60 * 60 * 1000;
const nowIso = new Date().toISOString();

const defaultWeights = {
  SKILLS: 0.35,
  LOCATION: 0.25,
  AVAILABILITY: 0.15,
  PAYMENT: 0.15,
  CATEGORY_EXPERIENCE: 0.10
};

export const SEEDED_DEMO_MATCHES: Job[] = [
  {
    _id: 'demo-catering-royal-banquet-01',
    seedId: 'demo-catering-royal-banquet-01',
    isDemo: true,
    title: 'Royal Wedding Banquet Catering & Buffet Servers',
    description: 'Professional banquet and catering attendants needed for a 500-guest luxury wedding reception. Responsibilities include guest greeting, buffet food replenishment, live counter assistance, table water service, and maintaining spotless dining presentation. Complete dinner provided on site.',
    category: 'Wedding and catering support',
    locationName: 'Sayaji Hotel & Banquet Lawns, Kawala Naka, Kolhapur',
    locality: 'Kawala Naka',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: {
      type: 'Point',
      coordinates: [74.2433, 16.7049]
    },
    workDate: new Date(now + oneDayMs).toISOString(),
    workEndDate: new Date(now + oneDayMs).toISOString(),
    startTime: '16:30',
    endTime: '23:30',
    breakDurationMinutes: 30,
    totalHours: 6.5,
    openings: 6,
    filledCount: 2,
    grossPay: 850,
    payBasis: 'shift',
    currency: 'INR',
    paymentMethod: 'UPI / Direct Bank Transfer',
    paymentTiming: 'Same day upon shift completion',
    requiredSkills: ['Catering Service', 'Buffet Management', 'Table Setup', 'Hygiene Standards'],
    experienceRequirement: 'Basic catering experience preferred; briefing provided at shift start',
    dressCode: 'Crisp black trousers, white shirt, comfortable black non-slip shoes',
    physicalRequirements: 'Standing, moving between banquet tables, tray carrying up to 10kg',
    ageRestriction: '18+',
    applicationDeadline: new Date(now + oneDayMs - 4 * 60 * 60 * 1000).toISOString(),
    cancellationPolicy: 'Notice required 12 hours prior to shift commencement',
    attendanceRadiusMeters: 200,
    coordinatesConfirmed: true,
    detailsConfirmed: true,
    status: 'OPEN',
    createdAt: nowIso,
    updatedAt: nowIso,
    employer: {
      _id: 'emp-kolhapur-logistics',
      name: 'Kolhapur Premium Events, Catering & Logistics',
      email: 'kolhapur.logistics@workmatch.demo',
      verificationStatus: 'verified'
    },
    employerProfile: {
      businessName: 'Kolhapur Premium Events & Grand Catering',
      verificationStatus: 'verified',
      rating: { average: 4.9, count: 38 },
      businessAddress: 'Station Road, Shahupuri, Kolhapur 416001'
    },
    distanceKm: 2.4,
    matchType: 'exact',
    matchData: {
      matchScore: 96,
      weights: defaultWeights,
      componentScores: {
        skills: 100,
        location: 95,
        availability: 95,
        payment: 94,
        categoryExperience: 98
      },
      matchedSkills: ['Catering Service', 'Buffet Management', 'Table Setup', 'Hygiene Standards'],
      missingSkills: [],
      distanceKm: 2.4,
      dataCompleteness: 100,
      warnings: [],
      evaluatedAt: nowIso,
      explanations: [
        '100% skill match for your banquet, table setup, and catering skills',
        'Within 2.4 km of your primary Kolhapur work area',
        'Shift compensation (₹850 / shift) satisfies your expected pay terms',
        'Verified premium employer with 4.9★ platform rating'
      ]
    }
  },
  {
    _id: 'demo-catering-live-counter-02',
    seedId: 'demo-catering-live-counter-02',
    isDemo: true,
    title: 'Live Counter Chef & Food Prep Assistant',
    description: 'Assist senior chefs at live chaat, dosa, and dessert counters during an evening sangeet ceremony. Refill fresh ingredients, prepare appetizer servings, ensure counter hygiene, and assist with guest plate presentation with warm hospitality.',
    category: 'Wedding and catering support',
    locationName: 'Sanjay Ghodawat Institute Banquet Hall, NH166, Atigre, Kolhapur',
    locality: 'Atigre',
    city: 'Hatkanangle',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: {
      type: 'Point',
      coordinates: [74.3720, 16.7410]
    },
    workDate: new Date(now + 2 * oneDayMs).toISOString(),
    workEndDate: new Date(now + 2 * oneDayMs).toISOString(),
    startTime: '16:00',
    endTime: '22:30',
    breakDurationMinutes: 30,
    totalHours: 6.0,
    openings: 4,
    filledCount: 1,
    grossPay: 125,
    payBasis: 'hourly',
    currency: 'INR',
    paymentMethod: 'UPI / Direct Bank Transfer',
    paymentTiming: 'Within 12 hours of shift completion',
    requiredSkills: ['Food Prep', 'Counter Assistance', 'Customer Hospitality', 'Speed Service'],
    experienceRequirement: 'Prior restaurant or catering experience desirable',
    dressCode: 'Clean white shirt or t-shirt, dark trousers, chef cap provided on site',
    physicalRequirements: 'Standing during live counter service, quick hand-eye coordination',
    ageRestriction: '18+',
    applicationDeadline: new Date(now + 2 * oneDayMs - 4 * 60 * 60 * 1000).toISOString(),
    cancellationPolicy: 'Notice required 12 hours prior',
    attendanceRadiusMeters: 200,
    coordinatesConfirmed: true,
    detailsConfirmed: true,
    status: 'OPEN',
    createdAt: nowIso,
    updatedAt: nowIso,
    employer: {
      _id: 'emp-kolhapur-logistics',
      name: 'Kolhapur Premium Events, Catering & Logistics',
      email: 'kolhapur.logistics@workmatch.demo',
      verificationStatus: 'verified'
    },
    employerProfile: {
      businessName: 'Kolhapur Premium Events & Grand Catering',
      verificationStatus: 'verified',
      rating: { average: 4.9, count: 38 },
      businessAddress: 'NH166, Atigre, Kolhapur 416118'
    },
    distanceKm: 4.1,
    matchType: 'exact',
    matchData: {
      matchScore: 94,
      weights: defaultWeights,
      componentScores: {
        skills: 96,
        location: 92,
        availability: 95,
        payment: 94,
        categoryExperience: 95
      },
      matchedSkills: ['Food Prep', 'Counter Assistance', 'Customer Hospitality'],
      missingSkills: [],
      distanceKm: 4.1,
      dataCompleteness: 100,
      warnings: [],
      evaluatedAt: nowIso,
      explanations: [
        'Perfect match for food prep and counter assistance competencies',
        'Convenient evening schedule matching your declared availability',
        'Reliable hourly compensation (₹125/hr) with instant digital payout'
      ]
    }
  },
  {
    _id: 'demo-catering-corporate-gala-03',
    seedId: 'demo-catering-corporate-gala-03',
    isDemo: true,
    title: 'Corporate Gala Dinner Hospitality Crew',
    description: 'Hospitality crew required for an evening corporate business summit and gala dinner. Responsibilities include tray-passing welcome mocktails, hors d’oeuvres service, buffet oversight, and ensuring corporate attendees receive prompt hospitality.',
    category: 'Restaurant and hospitality',
    locationName: 'Hotel Pearl Grand Ballroom, Tarabai Park, Kolhapur',
    locality: 'Tarabai Park',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: {
      type: 'Point',
      coordinates: [74.2355, 16.7112]
    },
    workDate: new Date(now + 3 * oneDayMs).toISOString(),
    workEndDate: new Date(now + 3 * oneDayMs).toISOString(),
    startTime: '17:30',
    endTime: '23:00',
    breakDurationMinutes: 30,
    totalHours: 5.0,
    openings: 5,
    filledCount: 2,
    grossPay: 800,
    payBasis: 'shift',
    currency: 'INR',
    paymentMethod: 'UPI',
    paymentTiming: 'End of shift upon sign-off',
    requiredSkills: ['Beverage Service', 'Guest Hospitality', 'Tray Service', 'Professional Demeanor'],
    experienceRequirement: 'Polite guest communication and neat presentation required',
    dressCode: 'Formal black trousers, black shoes; black aprons provided by hotel',
    physicalRequirements: 'Tray carrying and walking in banquet hall',
    ageRestriction: '18+',
    applicationDeadline: new Date(now + 3 * oneDayMs - 6 * 60 * 60 * 1000).toISOString(),
    cancellationPolicy: 'Notice required 12 hours prior',
    attendanceRadiusMeters: 200,
    coordinatesConfirmed: true,
    detailsConfirmed: true,
    status: 'OPEN',
    createdAt: nowIso,
    updatedAt: nowIso,
    employer: {
      _id: 'emp-pearl-hospitality',
      name: 'Hotel Pearl Hospitality Group',
      email: 'events@hotelpearl.demo',
      verificationStatus: 'verified'
    },
    employerProfile: {
      businessName: 'Hotel Pearl Grand Banquets',
      verificationStatus: 'verified',
      rating: { average: 4.8, count: 24 },
      businessAddress: 'Tarabai Park, Kolhapur 416003'
    },
    distanceKm: 3.2,
    matchType: 'strong',
    preferenceDifferences: ['Slightly earlier check-in than your standard preference'],
    matchData: {
      matchScore: 88,
      weights: defaultWeights,
      componentScores: {
        skills: 88,
        location: 90,
        availability: 90,
        payment: 88,
        categoryExperience: 92
      },
      matchedSkills: ['Beverage Service', 'Guest Hospitality', 'Tray Service'],
      missingSkills: ['Cocktail Bar Service'],
      distanceKm: 3.2,
      dataCompleteness: 95,
      warnings: [],
      evaluatedAt: nowIso,
      explanations: [
        'Strong hospitality and table service alignment with your experience',
        'Generous shift rate of ₹800 for 5 hours of work',
        'Close venue located in Tarabai Park (3.2 km away)'
      ]
    }
  },
  {
    _id: 'demo-warehouse-logistics-04',
    seedId: 'demo-warehouse-logistics-04',
    isDemo: true,
    title: 'Warehouse Logistics & Order Packing Assistant',
    description: 'Urgent packing and barcode scanning support needed for morning e-commerce dispatch. Responsibilities include sorting incoming regional parcels, bubble wrapping fragile items, packing dispatch boxes, and printing shipping manifests.',
    category: 'Warehouse and packing',
    locationName: 'Shiroli MIDC Logistics & Fulfillment Center, Kolhapur',
    locality: 'Shiroli MIDC',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: {
      type: 'Point',
      coordinates: [74.2810, 16.7450]
    },
    workDate: new Date(now + oneDayMs).toISOString(),
    workEndDate: new Date(now + oneDayMs).toISOString(),
    startTime: '08:30',
    endTime: '16:30',
    breakDurationMinutes: 60,
    totalHours: 7.0,
    openings: 8,
    filledCount: 3,
    grossPay: 110,
    payBasis: 'hourly',
    currency: 'INR',
    paymentMethod: 'UPI / Direct Bank Transfer',
    paymentTiming: 'Same day upon shift completion',
    requiredSkills: ['Order Packing', 'Barcode Scanning', 'Inventory Sorting', 'Box Taping'],
    experienceRequirement: 'No prior experience required; 15-minute onboarding provided',
    dressCode: 'Comfortable casual clothes and closed-toe sports shoes',
    physicalRequirements: 'Standing, packing parcels up to 10kg, barcode scanning',
    ageRestriction: '18+',
    applicationDeadline: new Date(now + oneDayMs - 2 * 60 * 60 * 1000).toISOString(),
    cancellationPolicy: 'Notice required 6 hours prior',
    attendanceRadiusMeters: 200,
    coordinatesConfirmed: true,
    detailsConfirmed: true,
    status: 'OPEN',
    createdAt: nowIso,
    updatedAt: nowIso,
    employer: {
      _id: 'emp-kolhapur-logistics',
      name: 'Kolhapur Premium Events, Catering & Logistics',
      email: 'kolhapur.logistics@workmatch.demo',
      verificationStatus: 'verified'
    },
    employerProfile: {
      businessName: 'Shiroli Express Parcel Hub',
      verificationStatus: 'verified',
      rating: { average: 4.7, count: 52 },
      businessAddress: 'Plot B-14, Shiroli MIDC, Kolhapur 416122'
    },
    distanceKm: 5.8,
    matchType: 'strong',
    preferenceDifferences: ['Morning shift starting at 08:30 AM'],
    matchData: {
      matchScore: 85,
      weights: defaultWeights,
      componentScores: {
        skills: 85,
        location: 84,
        availability: 90,
        payment: 85,
        categoryExperience: 90
      },
      matchedSkills: ['Order Packing', 'Inventory Sorting'],
      missingSkills: ['Forklift Operation'],
      distanceKm: 5.8,
      dataCompleteness: 95,
      warnings: [],
      evaluatedAt: nowIso,
      explanations: [
        'Reliable daytime fulfillment shift with clear hourly pay (₹110/hr)',
        'Great match for active workers comfortable with warehouse logistics',
        'Fast checkout and guaranteed same-day payment'
      ]
    }
  },
  {
    _id: 'demo-event-usher-expo-05',
    seedId: 'demo-event-usher-expo-05',
    isDemo: true,
    title: 'South Maharashtra Industrial Expo Event Usher & Host',
    description: 'Welcome registered trade delegates, scan QR code entry badges on tablet scanners, distribute event directories, and direct attendees to seminar halls during the South Maharashtra Tech & Industrial Expo.',
    category: 'Event assistance',
    locationName: 'Mahalaxmi Lawns & Convention Ground, Kolhapur',
    locality: 'Ruikar Colony',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: {
      type: 'Point',
      coordinates: [74.2510, 16.7130]
    },
    workDate: new Date(now + 4 * oneDayMs).toISOString(),
    workEndDate: new Date(now + 4 * oneDayMs).toISOString(),
    startTime: '09:30',
    endTime: '17:00',
    breakDurationMinutes: 45,
    totalHours: 6.75,
    openings: 6,
    filledCount: 2,
    grossPay: 750,
    payBasis: 'shift',
    currency: 'INR',
    paymentMethod: 'UPI',
    paymentTiming: 'End of shift upon supervisor verification',
    requiredSkills: ['Guest Greeting', 'Crowd Guidance', 'Badge Scanning', 'Punctuality'],
    experienceRequirement: 'Friendly communication and basic smartphone usage',
    dressCode: 'Smart casual attire; event lanyard and polo shirt provided',
    physicalRequirements: 'Standing and walking in exhibition pavilion',
    ageRestriction: '18+',
    applicationDeadline: new Date(now + 4 * oneDayMs - 12 * 60 * 60 * 1000).toISOString(),
    cancellationPolicy: 'Notice required 12 hours prior',
    attendanceRadiusMeters: 200,
    coordinatesConfirmed: true,
    detailsConfirmed: true,
    status: 'OPEN',
    createdAt: nowIso,
    updatedAt: nowIso,
    employer: {
      _id: 'emp-kolhapur-expo',
      name: 'Kolhapur Exhibition & Trade Association',
      email: 'contact@kolhapurexpo.demo',
      verificationStatus: 'verified'
    },
    employerProfile: {
      businessName: 'Maharashtra Trade Shows & Conventions',
      verificationStatus: 'verified',
      rating: { average: 4.9, count: 19 },
      businessAddress: 'Ruikar Colony, Kolhapur 416005'
    },
    distanceKm: 6.5,
    matchType: 'partial',
    preferenceDifferences: ['Travel distance is ~6.5 km from city centre'],
    matchData: {
      matchScore: 74,
      weights: defaultWeights,
      componentScores: {
        skills: 75,
        location: 74,
        availability: 85,
        payment: 76,
        categoryExperience: 82
      },
      matchedSkills: ['Guest Greeting', 'Punctuality'],
      missingSkills: ['Multi-lingual translation'],
      distanceKm: 6.5,
      dataCompleteness: 90,
      warnings: [],
      evaluatedAt: nowIso,
      explanations: [
        'Matches general event hosting and guest greeting competencies',
        'Full-day shift at prime exhibition convention center',
        'Includes lunch box and branded event apparel'
      ]
    }
  }
];

export const SEEDED_DEMO_MIXED_RESULTS: MixedMatchResults = {
  exact: SEEDED_DEMO_MATCHES.filter((j) => j.matchType === 'exact'),
  strong: SEEDED_DEMO_MATCHES.filter((j) => j.matchType === 'strong'),
  partial: SEEDED_DEMO_MATCHES.filter((j) => j.matchType === 'partial')
};

export const SEEDED_DEMO_MATCH_COUNTS: MixedMatchCounts = {
  exact: SEEDED_DEMO_MIXED_RESULTS.exact.length,
  strong: SEEDED_DEMO_MIXED_RESULTS.strong.length,
  partial: SEEDED_DEMO_MIXED_RESULTS.partial.length,
  total: SEEDED_DEMO_MATCHES.length
};

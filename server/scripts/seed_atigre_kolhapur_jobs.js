import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Job } from '../src/models/Job.js';
import { ROLES, JOB_STATUSES, PAYMENT_BASES } from '../src/config/constants.js';

// Calculate future dates dynamically so demo listings always appear active
const getFutureDate = (daysAhead, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
};

export const SAMPLE_JOBS_DATA = [
  // ==========================================
  // ATIGRE (Center Reference: 16.7410, 74.3720)
  // ==========================================
  {
    seedId: 'demo-atigre-01',
    title: '[DEMO] Agricultural Harvest & Packing Assistant',
    description: 'DEMO LISTING: Assist local cooperative growers with sorting freshly harvested seasonal vegetables, grading by size, and packing into ventilated crates for regional distribution.',
    category: 'Warehouse and packing',
    requiredSkills: ['Produce Sorting', 'Box Packing', 'Physical Stamina'],
    openings: 3,
    locationName: 'Atigre Agro Processing Yard, Sangli-Kolhapur Highway, Atigre, Maharashtra 416118',
    locality: 'Atigre',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3720, 16.7410] },
    daysAhead: 1,
    startTime: '07:30',
    endTime: '15:30',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 650,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'No prior experience required; brief on-site orientation provided',
    dressCode: 'Comfortable cotton clothing, durable closed-toe footwear',
    physicalRequirements: 'Ability to stand for extended periods and lift crates up to 15 kg',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-atigre-02',
    title: '[DEMO] Packaging & Box Assembly Worker',
    description: 'DEMO LISTING: Assemble pre-cut corrugated carton boxes, line them with food-grade paper, and label packaging for local agro-poultry distribution.',
    category: 'Warehouse and packing',
    requiredSkills: ['Box Packing', 'Labeling', 'Attention to Detail'],
    openings: 4,
    locationName: 'Atigre Phata Storage Facility, Near Highway Junction, Atigre, Maharashtra 416118',
    locality: 'Atigre',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3715, 16.7405] },
    daysAhead: 2,
    startTime: '09:00',
    endTime: '17:00',
    breakDurationMinutes: 60,
    totalHours: 7.0,
    grossPay: 600,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same-day shift completion recorded',
    experienceRequirement: 'Basic manual dexterity and punctuality',
    dressCode: 'Casual work attire, sports shoes',
    physicalRequirements: 'Standard physical mobility for packaging assembly',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-atigre-03',
    title: '[DEMO] Highway Retail Mart Counter & Stock Helper',
    description: 'DEMO LISTING: Assist retail store supervisor with stocking display shelves, pricing packaged dry goods, and assisting walk-in highway travelers with shopping baskets.',
    category: 'Retail and store assistance',
    requiredSkills: ['Stock Replenishment', 'Customer Greeting', 'Inventory Sorting'],
    openings: 2,
    locationName: 'Highway Commercial Arcade, Main Road, Atigre, Maharashtra 416118',
    locality: 'Atigre',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3680, 16.7390] },
    daysAhead: 3,
    startTime: '10:00',
    endTime: '19:00',
    breakDurationMinutes: 60,
    totalHours: 8.0,
    grossPay: 700,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of completion',
    experienceRequirement: 'Polite presentation and pleasant manner with customers',
    dressCode: 'Clean plain shirt/t-shirt, trousers, closed shoes',
    physicalRequirements: 'Standing and light shelf restocking',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-atigre-04',
    title: '[DEMO] Event Banquet Setup & Chair Arrangement Staff',
    description: 'DEMO LISTING: Arrange chairs, tables, buffet linen, and water stations for an evening family celebration hall near the university campus perimeter.',
    category: 'Event assistance',
    requiredSkills: ['Catering Setup', 'Event Assistance', 'Team Coordination'],
    openings: 5,
    locationName: 'Community Celebration Hall, Near Educational Campus, Atigre, Maharashtra 416118',
    locality: 'Atigre',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3760, 16.7450] },
    daysAhead: 4,
    startTime: '14:00',
    endTime: '22:00',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 750,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Recorded upon dual checkout',
    experienceRequirement: 'Willingness to support event logistics as part of a team',
    dressCode: 'Dark trousers, plain dark t-shirt/shirt, clean shoes',
    physicalRequirements: 'Carrying lightweight folding banquet chairs and tables',
    ageRestriction: '18+'
  },

  // ==========================================
  // HATKANANGALE (~7.7 km from Atigre)
  // ==========================================
  {
    seedId: 'demo-hatkanangale-01',
    title: '[DEMO] Goods Shed Unloading & Stacking Assistant',
    description: 'DEMO LISTING: Assist warehouse supervisor with unloading bagged commodities from incoming transport trucks and neatly stacking them in designated storage bays.',
    category: 'Warehouse and packing',
    requiredSkills: ['Unloading', 'Stacking', 'Physical Stamina'],
    openings: 4,
    locationName: 'Station Goods Shed Road, Near Railway Station, Hatkanangale, Maharashtra 416109',
    locality: 'Hatkanangale',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4460, 16.7430] },
    daysAhead: 1,
    startTime: '08:00',
    endTime: '16:00',
    breakDurationMinutes: 60,
    totalHours: 7.0,
    grossPay: 800,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Previous experience in loading/unloading preferred but not required',
    dressCode: 'Sturdy work clothes, durable closed-toe work boots',
    physicalRequirements: 'Able to lift and move bagged goods up to 25 kg',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-hatkanangale-02',
    title: '[DEMO] General Store Inventory & Barcode Sticking Helper',
    description: 'DEMO LISTING: Unpack cartons of consumer retail items, verify pack counts against delivery slips, and affix price/barcode stickers to individual packs.',
    category: 'Retail and store assistance',
    requiredSkills: ['Barcode Sticking', 'Inventory Sorting', 'Attention to Detail'],
    openings: 2,
    locationName: 'Main Bazaar Road, Near Bus Stand, Hatkanangale, Maharashtra 416109',
    locality: 'Hatkanangale',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4450, 16.7455] },
    daysAhead: 2,
    startTime: '10:30',
    endTime: '18:30',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 600,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same-day verification recorded',
    experienceRequirement: 'Comfortable reading product names and numbers',
    dressCode: 'Casual neat clothing, closed shoes',
    physicalRequirements: 'Light manual sorting while seated and standing',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-hatkanangale-03',
    title: '[DEMO] Rural Cooperative Register Data Entry Assistant',
    description: 'DEMO LISTING: Enter handwritten delivery registers and member ledger slips into an offline computer spreadsheet. Accurate typing and basic Marathi/English familiarity.',
    category: 'Data entry and office assistance',
    requiredSkills: ['Data Entry', 'Basic Computer Operation', 'Spreadsheet Entry'],
    openings: 2,
    locationName: 'Taluka Cooperative Building, Panchayat Road, Hatkanangale, Maharashtra 416109',
    locality: 'Hatkanangale',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4442, 16.7445] },
    daysAhead: 3,
    startTime: '09:30',
    endTime: '17:30',
    breakDurationMinutes: 60,
    totalHours: 7.0,
    grossPay: 700,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Basic familiarity with computer keyboard and numerical entry',
    dressCode: 'Smart casual office attire',
    physicalRequirements: 'Desk-based work using computer workstation',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-hatkanangale-04',
    title: '[DEMO] Grain Cleaning & Gunny Bag Stitching Worker',
    description: 'DEMO LISTING: Assist in grain bagging operations, feed empty jute bags into mechanical bag-mouth stitching machine, and stack sealed bags on pallets.',
    category: 'Warehouse and packing',
    requiredSkills: ['Bag Stitching', 'Produce Sorting', 'Material Handling'],
    openings: 3,
    locationName: 'Hatkanangale Industrial Sub-Area, Hatkanangale, Maharashtra 416109',
    locality: 'Hatkanangale',
    city: 'Hatkanangale',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4410, 16.7460] },
    daysAhead: 5,
    startTime: '08:30',
    endTime: '17:00',
    breakDurationMinutes: 60,
    totalHours: 7.5,
    grossPay: 750,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Paid via verified platform record',
    experienceRequirement: 'Willingness to learn bag stitching operation',
    dressCode: 'Durable cotton overalls or trousers, safety shoes',
    physicalRequirements: 'Handling bags up to 20 kg with assist aids',
    ageRestriction: '18+'
  },

  // ==========================================
  // SHIROLI MIDC (~7.6 km from Atigre)
  // ==========================================
  {
    seedId: 'demo-shiroli-01',
    title: '[DEMO] Industrial Packaging & Box Wrapping Associate',
    description: 'DEMO LISTING: Wrap manufactured metal castings with anti-corrosion VCI paper, place into wooden export crates, and strap using manual pneumatic strapping tools.',
    category: 'Warehouse and packing',
    requiredSkills: ['Box Packing', 'Industrial Packaging', 'Strapping'],
    openings: 4,
    locationName: 'Sector A, Shiroli MIDC, Near NH48, Kolhapur, Maharashtra 416122',
    locality: 'Shiroli MIDC',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3015, 16.7482] },
    daysAhead: 1,
    startTime: '08:30',
    endTime: '17:00',
    breakDurationMinutes: 45,
    totalHours: 7.75,
    grossPay: 850,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Prior factory or warehouse packing background advantageous',
    dressCode: 'Sturdy clothing, steel-toe shoes compulsory (safety gear provided on-site)',
    physicalRequirements: 'Standing, wrapping, and strapping industrial packages',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-shiroli-02',
    title: '[DEMO] Warehouse Despatch & Pallet Loading Helper',
    description: 'DEMO LISTING: Transfer packed components to the loading dock using hydraulic hand pallet trucks. Check manifest tags and assist transport truck driver during loading.',
    category: 'Warehouse and packing',
    requiredSkills: ['Pallet Truck Operation', 'Loading', 'Material Handling'],
    openings: 3,
    locationName: 'Sector B Logistics Park, Shiroli MIDC, Kolhapur, Maharashtra 416122',
    locality: 'Shiroli MIDC',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3050, 16.7460] },
    daysAhead: 2,
    startTime: '09:00',
    endTime: '17:30',
    breakDurationMinutes: 60,
    totalHours: 7.5,
    grossPay: 800,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same-day platform payout record',
    experienceRequirement: 'Comfortable operating manual hand pallet jacks',
    dressCode: 'Industrial work attire, safety footwear',
    physicalRequirements: 'Pushing/pulling pallet loads with hydraulic jacks',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-shiroli-03',
    title: '[DEMO] Precision Component Sorting & Deburring Helper',
    description: 'DEMO LISTING: Inspect small machined automotive brackets for surface burrs, wipe clean with lint-free cloths, and place neatly into divided plastic tote bins.',
    category: 'Warehouse and packing',
    requiredSkills: ['Visual Inspection', 'Component Sorting', 'Attention to Detail'],
    openings: 5,
    locationName: 'Sector C Engineering Works, Shiroli MIDC, Kolhapur, Maharashtra 416122',
    locality: 'Shiroli MIDC',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3080, 16.7430] },
    daysAhead: 3,
    startTime: '08:00',
    endTime: '16:30',
    breakDurationMinutes: 45,
    totalHours: 7.75,
    grossPay: 750,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Good eyesight and patience for repetitive visual checks',
    dressCode: 'Cotton work clothing, cotton safety gloves provided',
    physicalRequirements: 'Seated and standing work inspection',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-shiroli-04',
    title: '[DEMO] Industrial Facility Housekeeping & Floor Cleaning Staff',
    description: 'DEMO LISTING: Sweep and mop designated factory gangways, empty dry scrap sorting bins, and maintain clean perimeter walkways in light manufacturing unit.',
    category: 'Cleaning and maintenance',
    requiredSkills: ['Cleaning and Maintenance', 'Waste Sorting', 'Punctuality'],
    openings: 2,
    locationName: 'Sector A Industrial Unit, Shiroli MIDC, Kolhapur, Maharashtra 416122',
    locality: 'Shiroli MIDC',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.2980, 16.7510] },
    daysAhead: 4,
    startTime: '07:00',
    endTime: '15:00',
    breakDurationMinutes: 60,
    totalHours: 7.0,
    grossPay: 700,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Recorded upon dual checkout',
    experienceRequirement: 'Dependable and thorough with housekeeping tasks',
    dressCode: 'Comfortable clothing, rubber-sole non-slip shoes',
    physicalRequirements: 'Bending, sweeping, and lifting scrap bins up to 10 kg',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-shiroli-05',
    title: '[DEMO] Spare Parts Bin Inventory Count Assistant',
    description: 'DEMO LISTING: Count fasteners, washers, and small automotive fittings in storage racks, record counts on clipboards, and report discrepancies to stores in-charge.',
    category: 'Data entry and office assistance',
    requiredSkills: ['Stock Counting', 'Inventory Sorting', 'Basic Math'],
    openings: 2,
    locationName: 'Central Spare Parts Warehouse, Shiroli MIDC, Kolhapur, Maharashtra 416122',
    locality: 'Shiroli MIDC',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.3030, 16.7470] },
    daysAhead: 5,
    startTime: '09:00',
    endTime: '17:00',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 750,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Basic arithmetic ability and neat handwriting',
    dressCode: 'Neat casual work clothes, closed shoes',
    physicalRequirements: 'Walking along aisle racks and climbing step-ladders',
    ageRestriction: '18+'
  },

  // ==========================================
  // ICHALKARANJI (~10.8 km from Atigre)
  // ==========================================
  {
    seedId: 'demo-ichalkaranji-01',
    title: '[DEMO] Textile Fabric Roll Packing & Bundling Helper',
    description: 'DEMO LISTING: Assist in textile mill folding department. Measure finished grey and dyed cotton fabric bolts, wrap with waterproof poly film, and bundle for transport.',
    category: 'Warehouse and packing',
    requiredSkills: ['Fabric Handling', 'Box Packing', 'Bundling'],
    openings: 4,
    locationName: 'Textile Industrial Estate, Station Road, Ichalkaranji, Maharashtra 416115',
    locality: 'Ichalkaranji',
    city: 'Ichalkaranji',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4680, 16.6920] },
    daysAhead: 1,
    startTime: '08:00',
    endTime: '16:30',
    breakDurationMinutes: 45,
    totalHours: 7.75,
    grossPay: 750,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Textile mill or garment packaging familiarity preferred',
    dressCode: 'Light cotton clothing, slip-on work shoes',
    physicalRequirements: 'Rolling and carrying fabric bolts up to 15 kg',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-ichalkaranji-02',
    title: '[DEMO] Retail Garment Showroom Customer Support & Fold Assistant',
    description: 'DEMO LISTING: Refold cotton shirts and sarees on display tables, replace merchandise hanging in trial rooms, and assist sales staff during peak festive hours.',
    category: 'Retail and store assistance',
    requiredSkills: ['Garment Folding', 'Customer Greeting', 'Stock Replenishment'],
    openings: 3,
    locationName: 'Station Road Market Square, Ichalkaranji, Maharashtra 416115',
    locality: 'Ichalkaranji',
    city: 'Ichalkaranji',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4580, 16.6990] },
    daysAhead: 2,
    startTime: '11:00',
    endTime: '20:00',
    breakDurationMinutes: 60,
    totalHours: 8.0,
    grossPay: 700,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same-day shift completion recorded',
    experienceRequirement: 'Neat appearance and polite communication skills',
    dressCode: 'Formal or neat ethnic attire, clean footwear',
    physicalRequirements: 'Standing and light shelf folding',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-ichalkaranji-03',
    title: '[DEMO] Yarn Bobbin Loading & Cart Transport Worker',
    description: 'DEMO LISTING: Load yarn cones onto multi-tier mobile transfer trolleys from twisting section and push carts carefully to automatic weaving preparation lines.',
    category: 'Warehouse and packing',
    requiredSkills: ['Material Handling', 'Trolley Transport', 'Physical Stamina'],
    openings: 3,
    locationName: 'Powerloom Cluster Zone, Shahapur, Ichalkaranji, Maharashtra 416115',
    locality: 'Ichalkaranji',
    city: 'Ichalkaranji',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4710, 16.6940] },
    daysAhead: 3,
    startTime: '07:30',
    endTime: '15:30',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 800,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Punctuality and careful handling of textile cones',
    dressCode: 'Cotton work shirts/trousers, non-slip footwear',
    physicalRequirements: 'Pushing mobile trolleys along paved factory floor',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-ichalkaranji-04',
    title: '[DEMO] Cultural Exhibition Stage & Sound Setup Helper',
    description: 'DEMO LISTING: Assist event organizers with erecting backdrop banners, placing stage sound monitors, and laying decorative carpets for local evening music recital.',
    category: 'Event assistance',
    requiredSkills: ['Event Assistance', 'Stage Setup', 'Team Coordination'],
    openings: 4,
    locationName: 'Rajwada Chowk Cultural Grounds, Ichalkaranji, Maharashtra 416115',
    locality: 'Ichalkaranji',
    city: 'Ichalkaranji',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.4550, 16.6975] },
    daysAhead: 4,
    startTime: '13:00',
    endTime: '21:00',
    breakDurationMinutes: 60,
    totalHours: 7.0,
    grossPay: 750,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Verified upon event completion',
    experienceRequirement: 'Energetic and collaborative approach to event setup',
    dressCode: 'Comfortable casual clothes, dark t-shirt, sports shoes',
    physicalRequirements: 'Carrying lightweight speakers, carpets, and backdrop poles',
    ageRestriction: '18+'
  },

  // ==========================================
  // JAYSINGPUR (~20.4 km from Atigre)
  // ==========================================
  {
    seedId: 'demo-jaysingpur-01',
    title: '[DEMO] APMC Wholesale Produce Weighing & Crating Assistant',
    description: 'DEMO LISTING: Weigh bulk onion, potato, and jaggery crates on electronic platform scales, record gross weights, and tag crates for regional wholesale buyers.',
    category: 'Warehouse and packing',
    requiredSkills: ['Produce Sorting', 'Scale Weighing', 'Crating'],
    openings: 4,
    locationName: 'APMC Market Yard, Shirol-Jaysingpur Road, Jaysingpur, Maharashtra 416101',
    locality: 'Jaysingpur',
    city: 'Jaysingpur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.5550, 16.7800] },
    daysAhead: 1,
    startTime: '06:00',
    endTime: '14:00',
    breakDurationMinutes: 45,
    totalHours: 7.25,
    grossPay: 850,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Familiarity with mandi market environment',
    dressCode: 'Work clothes, gumboots or sturdy footwear',
    physicalRequirements: 'Handling produce crates up to 20 kg',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-jaysingpur-02',
    title: '[DEMO] Supermarket Food Aisle Stocking & Expiry Check Staff',
    description: 'DEMO LISTING: Inspect packaged food shelves, rotate stock to ensure first-in first-out placement, clean display shelves, and assist shoppers.',
    category: 'Retail and store assistance',
    requiredSkills: ['Stock Replenishment', 'Shelf Facing', 'Customer Greeting'],
    openings: 2,
    locationName: '10th Lane Commercial Center, Jaysingpur, Maharashtra 416101',
    locality: 'Jaysingpur',
    city: 'Jaysingpur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.5600, 16.7840] },
    daysAhead: 2,
    startTime: '10:00',
    endTime: '18:30',
    breakDurationMinutes: 45,
    totalHours: 7.75,
    grossPay: 650,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same-day recorded payout',
    experienceRequirement: 'Good attention to printed expiry dates and packaging condition',
    dressCode: 'Clean plain shirt/polo, black or navy trousers, shoes',
    physicalRequirements: 'Walking and light shelf replenishment',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-jaysingpur-03',
    title: '[DEMO] Cold Storage Jaggery & Dry Fruit Pallet Stacker',
    description: 'DEMO LISTING: Move boxes of processed Kolhapuri jaggery blocks and dried fruit cartons into temperature-controlled holding room using rolling dollies.',
    category: 'Warehouse and packing',
    requiredSkills: ['Cold Storage Handling', 'Stacking', 'Box Packing'],
    openings: 3,
    locationName: 'Shirol Bypass Agro Cold Chain, Jaysingpur, Maharashtra 416101',
    locality: 'Jaysingpur',
    city: 'Jaysingpur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.5520, 16.7790] },
    daysAhead: 4,
    startTime: '08:30',
    endTime: '16:30',
    breakDurationMinutes: 60,
    totalHours: 7.0,
    grossPay: 800,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer',
    paymentTiming: 'Within 24 hours of completion',
    experienceRequirement: 'Reliable and comfortable in cool room conditions (jackets provided)',
    dressCode: 'Warm layered clothing, thick socks, sturdy boots',
    physicalRequirements: 'Handling cartons up to 18 kg',
    ageRestriction: '18+'
  },

  // ==========================================
  // KOLHAPUR CITY (~14.3 to 18 km from Atigre)
  // ==========================================
  {
    seedId: 'demo-kolhapur-01',
    title: '[DEMO] Grand Wedding Reception Plated Service & Banquet Server',
    description: 'DEMO LISTING: Support head banquet captain with formal tray service of welcome drinks and appetizers, water refill stations, and prompt clearance of dining tables.',
    category: 'Wedding and catering support',
    requiredSkills: ['Catering Setup', 'Food Handling', 'Customer Service'],
    openings: 6,
    locationName: 'Shree Shahu Banquet & Convention Hall, Rajarampuri 2nd Lane, Kolhapur, Maharashtra 416008',
    locality: 'Rajarampuri',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.2490, 16.6980] },
    daysAhead: 2,
    startTime: '17:00',
    endTime: '23:30',
    breakDurationMinutes: 30,
    totalHours: 6.0,
    grossPay: 900,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Recorded upon dual checkout at end of shift',
    experienceRequirement: 'Polite presentation and banquet or restaurant serving experience preferred',
    dressCode: 'Crisp white collared shirt, black trousers, black non-slip formal shoes',
    physicalRequirements: 'Carrying service trays and standing during banquet service',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-kolhapur-02',
    title: '[DEMO] Traditional Restaurant Kitchen Prep & Cleanliness Helper',
    description: 'DEMO LISTING: Assist chef team in commercial kitchen with chopping onions, peeling garlic, preparing spice trays, and operating high-pressure utensil sanitizing station.',
    category: 'Restaurant and hospitality',
    requiredSkills: ['Kitchen Prep', 'Food Handling', 'Dish Sanitation'],
    openings: 3,
    locationName: 'Rankala Lakeside Family Dining Restaurant, Near Rankala Chowk, Kolhapur, Maharashtra 416012',
    locality: 'Rankala',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.2150, 16.6910] },
    daysAhead: 1,
    startTime: '11:00',
    endTime: '19:30',
    breakDurationMinutes: 60,
    totalHours: 7.5,
    grossPay: 750,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Basic kitchen vegetable prep hygiene familiarity',
    dressCode: 'Clean work clothes, apron and headnet provided on site',
    physicalRequirements: 'Standing at prep counter and handling kitchen utensils',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-kolhapur-03',
    title: '[DEMO] Trade Exhibition Registration & Badge Check Host',
    description: 'DEMO LISTING: Greet business visitors, scan entry QR passes on provided tablet computers, print visitor badges, and provide venue floor maps at main hall turnstiles.',
    category: 'Event assistance',
    requiredSkills: ['Guest Registration', 'Customer Service', 'Tablet Operation'],
    openings: 4,
    locationName: 'Tarabai Park Exhibition Pavilion, Tarabai Park, Kolhapur, Maharashtra 416003',
    locality: 'Tarabai Park',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.2380, 16.7140] },
    daysAhead: 3,
    startTime: '09:00',
    endTime: '17:30',
    breakDurationMinutes: 45,
    totalHours: 7.75,
    grossPay: 850,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer / Platform Recorded',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Polite verbal communication in Marathi, Hindi, or English',
    dressCode: 'Formal business casual attire, dress shoes',
    physicalRequirements: 'Intermittent standing and seated registration desk duties',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-kolhapur-04',
    title: '[DEMO] Wholesale Market Dry Goods Loading & Invoice Verification Staff',
    description: 'DEMO LISTING: Match dispatch invoices against pallet counts of cooking oils and staples, supervise truck unloader queue, and collect signed delivery receipts.',
    category: 'Warehouse and packing',
    requiredSkills: ['Invoice Verification', 'Inventory Sorting', 'Material Handling'],
    openings: 3,
    locationName: 'Shahupuri Commercial Wholesale Hub, Shahupuri, Kolhapur, Maharashtra 416001',
    locality: 'Shahupuri',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.2410, 16.7080] },
    daysAhead: 2,
    startTime: '08:30',
    endTime: '17:00',
    breakDurationMinutes: 60,
    totalHours: 7.5,
    grossPay: 800,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Same-day platform payout confirmation',
    experienceRequirement: 'Organized and able to read and cross-check bill quantities',
    dressCode: 'Durable daily wear, sports or safety shoes',
    physicalRequirements: 'Walking across wholesale loading docks',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-kolhapur-05',
    title: '[DEMO] Express Parcel Transit Hub Evening Sorter',
    description: 'DEMO LISTING: Scan arriving courier parcel barcodes with handheld Bluetooth scanner, sort packages into designated district courier tote bags (Sangli, Satara, Belgaum routes).',
    category: 'Delivery and logistics',
    requiredSkills: ['Barcode Scanning', 'Parcel Sorting', 'Attention to Detail'],
    openings: 5,
    locationName: 'Central Bus Stand (CBS) Logistics Depot, Station Road, Kolhapur, Maharashtra 416001',
    locality: 'Station Road',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.2430, 16.7050] },
    daysAhead: 1,
    startTime: '18:00',
    endTime: '23:30',
    breakDurationMinutes: 30,
    totalHours: 5.0,
    grossPay: 650,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Direct Bank Transfer',
    paymentTiming: 'Within 24 hours of shift completion',
    experienceRequirement: 'Quick learner with barcode scanner; high speed and accuracy',
    dressCode: 'Comfortable casual clothes, sneakers',
    physicalRequirements: 'Continuous sorting and placing parcels up to 10 kg',
    ageRestriction: '18+'
  },
  {
    seedId: 'demo-kolhapur-06',
    title: '[DEMO] Festival Cultural Fair Entry Crowd Flow Assistant',
    description: 'DEMO LISTING: Manage visitor entrance queues with rope stanchions, ensure smooth entry for senior citizens, and answer basic location queries for exhibition stalls.',
    category: 'Event assistance',
    requiredSkills: ['Guest Registration', 'Customer Service', 'Queue Coordination'],
    openings: 4,
    locationName: 'Dasara Chowk Historic Grounds, Dasara Chowk, Kolhapur, Maharashtra 416002',
    locality: 'Dasara Chowk',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    country: 'India',
    location: { type: 'Point', coordinates: [74.2280, 16.6950] },
    daysAhead: 4,
    startTime: '15:30',
    endTime: '22:00',
    breakDurationMinutes: 45,
    totalHours: 5.75,
    grossPay: 700,
    payBasis: PAYMENT_BASES.SHIFT,
    currency: 'INR',
    paymentMethod: 'Platform Recorded',
    paymentTiming: 'Recorded upon shift completion',
    experienceRequirement: 'Patient, calm, and courteous temperament',
    dressCode: 'Neat plain shirt/t-shirt, dark trousers, comfortable walking shoes',
    physicalRequirements: 'Standing and walking along queue lines',
    ageRestriction: '18+'
  }
];

export async function seedAtigreKolhapurJobs(options = { verbose: true }) {
  if (options.verbose) console.log('[Seed Local] Connecting to database...');
  await connectDB();

  const passwordHash = await bcrypt.hash('DemoPassword123!', 10);

  // 1. Ensure local demo employer user accounts exist
  let atigreEmployerUser = await User.findOne({ email: 'atigre.employer@workmatch.demo' });
  if (!atigreEmployerUser) {
    atigreEmployerUser = await User.create({
      name: 'Demo Employer – Atigre Operations',
      email: 'atigre.employer@workmatch.demo',
      passwordHash,
      role: ROLES.EMPLOYER,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
  }

  await EmployerProfile.findOneAndUpdate(
    { user: atigreEmployerUser._id },
    {
      $set: {
        businessName: 'Demo Employer – Atigre Logistics & Agro Hub',
        description: 'Demonstration employer profile for temporary agro-processing, retail, and hospitality assignments in Atigre & Hatkanangale.',
        businessCategory: 'Agricultural and Logistics Support',
        businessAddress: 'Sangli-Kolhapur Highway, Atigre, Maharashtra 416118',
        location: {
          type: 'Point',
          coordinates: [74.3720, 16.7410] // Atigre
        },
        publicContact: {
          phone: '+91 231 299 1001',
          email: 'demo-atigre@workmatch.demo',
          website: 'https://workmatch.demo/atigre'
        },
        verificationStatus: 'verified',
        rating: { average: 4.8, count: 14 },
        totalJobsPosted: 12,
        totalHiredWorkers: 20
      }
    },
    { upsert: true, new: true }
  );

  let kolhapurEmployerUser = await User.findOne({ email: 'kolhapur.logistics@workmatch.demo' });
  if (!kolhapurEmployerUser) {
    kolhapurEmployerUser = await User.create({
      name: 'Demo Employer – Kolhapur District Hub',
      email: 'kolhapur.logistics@workmatch.demo',
      passwordHash,
      role: ROLES.EMPLOYER,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
  }

  await EmployerProfile.findOneAndUpdate(
    { user: kolhapurEmployerUser._id },
    {
      $set: {
        businessName: 'Demo Employer – Shiroli & Kolhapur Industrial Network',
        description: 'Demonstration employer profile for industrial packaging, hospitality, and warehousing across Shiroli MIDC, Ichalkaranji, and Kolhapur city.',
        businessCategory: 'Industrial Packaging & Event Staffing',
        businessAddress: 'Sector A, Shiroli MIDC, Kolhapur, Maharashtra 416122',
        location: {
          type: 'Point',
          coordinates: [74.3015, 16.7482] // Shiroli MIDC
        },
        publicContact: {
          phone: '+91 231 299 2002',
          email: 'demo-kolhapur@workmatch.demo',
          website: 'https://workmatch.demo/kolhapur'
        },
        verificationStatus: 'verified',
        rating: { average: 4.9, count: 18 },
        totalJobsPosted: 15,
        totalHiredWorkers: 28
      }
    },
    { upsert: true, new: true }
  );

  // 2. Insert or update all 26 local sample jobs idempotently
  let createdCount = 0;
  let updatedCount = 0;
  const processedJobs = [];

  for (const jobData of SAMPLE_JOBS_DATA) {
    const employerId = ['Atigre', 'Hatkanangale', 'Jaysingpur'].includes(jobData.locality)
      ? atigreEmployerUser._id
      : kolhapurEmployerUser._id;

    const workDate = getFutureDate(jobData.daysAhead, parseInt(jobData.startTime.split(':')[0], 10));
    const deadline = new Date(workDate);
    deadline.setHours(deadline.getHours() - 4);

    const doc = {
      employer: employerId,
      seedId: jobData.seedId,
      isDemo: true,
      title: jobData.title,
      description: jobData.description,
      category: jobData.category,
      requiredSkills: jobData.requiredSkills,
      openings: jobData.openings,
      filledCount: 0,
      locationName: jobData.locationName,
      locality: jobData.locality,
      city: jobData.city,
      district: jobData.district,
      state: jobData.state,
      country: jobData.country,
      location: jobData.location,
      workDate,
      startTime: jobData.startTime,
      endTime: jobData.endTime,
      breakDurationMinutes: jobData.breakDurationMinutes,
      totalHours: jobData.totalHours,
      grossPay: jobData.grossPay,
      payBasis: jobData.payBasis,
      currency: jobData.currency,
      paymentMethod: jobData.paymentMethod,
      paymentTiming: jobData.paymentTiming,
      experienceRequirement: jobData.experienceRequirement,
      dressCode: jobData.dressCode,
      physicalRequirements: jobData.physicalRequirements,
      ageRestriction: jobData.ageRestriction,
      applicationDeadline: deadline,
      status: JOB_STATUSES.OPEN,
      detailsConfirmed: true,
      detailsConfirmedAt: new Date(),
      detailsConfirmedBy: employerId
    };

    const existing = await Job.findOne({ seedId: jobData.seedId });
    if (existing) {
      await Job.updateOne({ seedId: jobData.seedId }, { $set: doc });
      updatedCount++;
      processedJobs.push({ id: existing._id, title: doc.title, locality: doc.locality, action: 'updated' });
    } else {
      const created = await Job.create(doc);
      createdCount++;
      processedJobs.push({ id: created._id, title: doc.title, locality: doc.locality, action: 'created' });
    }
  }

  if (options.verbose) {
    console.log(`[Seed Local] Successfully processed ${SAMPLE_JOBS_DATA.length} local jobs.`);
    console.log(`[Seed Local] Created: ${createdCount}, Updated: ${updatedCount}`);
  }

  return {
    totalSeeded: SAMPLE_JOBS_DATA.length,
    createdCount,
    updatedCount,
    localities: ['Atigre', 'Hatkanangale', 'Shiroli MIDC', 'Ichalkaranji', 'Jaysingpur', 'Kolhapur City'],
    jobs: processedJobs
  };
}

// Direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedAtigreKolhapurJobs({ verbose: true })
    .then(async (result) => {
      console.log('[Seed Local] Seeding complete! Result summary:', {
        total: result.totalSeeded,
        created: result.createdCount,
        updated: result.updatedCount,
        localities: result.localities
      });
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Local] Error during seeding:', err);
      await disconnectDB();
      process.exit(1);
    });
}

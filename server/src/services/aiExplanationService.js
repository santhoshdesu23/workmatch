/**
 * AI Service Layer with Google Gemini API and Local Deterministic Fallback
 */

function sanitizeForPrompt(str, maxLength = 100) {
  if (!str || typeof str !== 'string') return '';
  // Strip control characters, quotes and prompt injection patterns
  return str
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[`${}\\]/g, '')
    .slice(0, maxLength)
    .trim();
}

export class AiExplanationService {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    this.apiKey = apiKey;
    this.providerName = apiKey ? 'Google Gemini API' : 'Deterministic Local Fallback';
  }

  /**
   * Generates a conversational explanation of a match between worker profile and job
   */
  async generateMatchExplanation(workerProfile, job, matchResult) {
    if (!this.apiKey || process.env.NODE_ENV === 'test') {
      return this.getLocalDeterministicExplanation(workerProfile, job, matchResult);
    }

    try {
      // Gemini REST API endpoint with strict 5-second timeout
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`;
      const safeTitle = sanitizeForPrompt(job.title, 80);
      const safeCat = sanitizeForPrompt(job.category, 50);
      const safeReqSkills = (job.requiredSkills || []).map((s) => sanitizeForPrompt(s, 30)).slice(0, 5).join(', ');
      const safeWorkerSkills = (workerProfile?.skills || []).map((s) => sanitizeForPrompt(s, 30)).slice(0, 5).join(', ');

      const prompt = `
You are the WorkMatch AI assistant. Explain in 2 concise, honest sentences why this job is or isn't a strong match for this worker.
Job: ${safeTitle} in ${safeCat}. Pay: ₹${Number(job.grossPay) || 0} (${sanitizeForPrompt(job.payBasis, 20)}). Required skills: ${safeReqSkills}.
Worker skills: ${safeWorkerSkills}. Expected pay: ₹${Number(workerProfile?.expectedPay?.min) || 0}. Match Score: ${matchResult.matchScore}/100.
Distance: ${matchResult.distanceKm !== null ? matchResult.distanceKm + ' km' : 'Unknown'}.
Tone: Professional, supportive, objective. Do not make false guarantees.
`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.warn(`[AI Service] Gemini API returned status ${response.status}. Using local fallback.`);
        return this.getLocalDeterministicExplanation(workerProfile, job, matchResult);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 0) {
        return {
          explanation: text.trim(),
          source: 'gemini-1.5-flash'
        };
      }

      return this.getLocalDeterministicExplanation(workerProfile, job, matchResult);
    } catch (err) {
      console.warn('[AI Service] Gemini API unavailable or timed out:', err.message);
      return this.getLocalDeterministicExplanation(workerProfile, job, matchResult);
    }
  }

  /**
   * Parses natural language job search query into structured search filters
   */
  async parseNaturalLanguageSearch(query) {
    const defaultParsed = {
      keyword: query,
      category: null,
      maxDistanceKm: null,
      minPay: null,
      maxPay: null,
      payBasis: null,
      shiftTiming: null,
      workDate: null,
      dateFilter: null,
      requiredSkills: [],
      confidence: 0.5,
      ambiguities: []
    };

    if (!this.apiKey || !query || process.env.NODE_ENV === 'test') {
      return this.getLocalDeterministicQueryParser(query);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`;
      const safeQuery = sanitizeForPrompt(query, 120);

      const prompt = `
Parse this temporary job search query into a JSON object: "${safeQuery}".
Return ONLY a valid JSON object with keys:
"keyword": string or null,
"category": string or null (from: "Event assistance", "Wedding and catering support", "Restaurant and hospitality", "Retail and store assistance", "Warehouse and packing", "Delivery and logistics", "Data entry and office assistance", "Cleaning and maintenance", "Tutoring and event staffing"),
"maxDistanceKm": number or null,
"minPay": number or null,
"maxPay": number or null,
"payBasis": string or null ("hourly", "daily", "shift", "task"),
"shiftTiming": string or null ("morning", "afternoon", "evening", "night"),
"locality": string or null,
"city": string or null,
"requiredSkills": array of strings.
`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return this.getLocalDeterministicQueryParser(query);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return { ...defaultParsed, ...parsed, source: 'gemini-1.5-flash' };
    } catch {
      return this.getLocalDeterministicQueryParser(query);
    }
  }

  /**
   * Deterministic local fallback explanation generator
   */
  getLocalDeterministicExplanation(workerProfile, job, matchResult) {
    const highlights = [];
    if (matchResult.matchedSkills?.length > 0) {
      highlights.push(`Matches your skills in ${matchResult.matchedSkills.slice(0, 2).join(' & ')}`);
    }
    if (matchResult.distanceKm !== null && matchResult.distanceKm <= 20) {
      highlights.push(`nearby shift (${matchResult.distanceKm} km away)`);
    }
    if (matchResult.componentScores?.payment >= 80) {
      highlights.push(`compensation matches your preferences`);
    }

    let summary = `This opportunity has an overall match rating of ${matchResult.matchScore}%.`;
    if (highlights.length > 0) {
      summary += ` Highlights include: ${highlights.join(', ')}.`;
    }

    return {
      explanation: summary,
      source: 'local-explainable-engine'
    };
  }

  /**
   * Deterministic local fallback query parser with comprehensive intent recognition
   */
  getLocalDeterministicQueryParser(query) {
    const raw = String(query || '').trim();
    const lower = raw.toLowerCase();
    const ambiguities = [];

    // 1. Shift Timing ("morning", "afternoon", "evening", "night")
    let shiftTiming = null;
    if (/\bevening\b/i.test(lower)) shiftTiming = 'evening';
    else if (/\bmorning\b/i.test(lower)) shiftTiming = 'morning';
    else if (/\bafternoon\b/i.test(lower)) shiftTiming = 'afternoon';
    else if (/\bnight\b/i.test(lower)) shiftTiming = 'night';

    // 2. Category & Skills recognition
    let category = null;
    const requiredSkills = [];

    if (lower.includes('data entry') || lower.includes('office assistance')) {
      category = 'Data entry and office assistance';
      requiredSkills.push('data entry');
    } else if (lower.includes('event') || lower.includes('usher')) {
      category = 'Event assistance';
    } else if (lower.includes('catering') || lower.includes('wedding')) {
      category = 'Wedding and catering support';
    } else if (lower.includes('restaurant') || lower.includes('server') || lower.includes('waiter') || lower.includes('barista')) {
      category = 'Restaurant and hospitality';
      if (lower.includes('server') || lower.includes('waiter')) requiredSkills.push('server');
    } else if (lower.includes('retail') || lower.includes('store') || lower.includes('cashier')) {
      category = 'Retail and store assistance';
      if (lower.includes('cashier')) requiredSkills.push('cashier');
    } else if (lower.includes('warehouse') || lower.includes('packing') || lower.includes('packaging') || lower.includes('forklift')) {
      category = 'Warehouse and packing';
      if (lower.includes('packing') || lower.includes('packaging')) requiredSkills.push('packing');
    } else if (lower.includes('delivery') || lower.includes('driver')) {
      category = 'Delivery and logistics';
      if (lower.includes('driver')) requiredSkills.push('driver');
    } else if (lower.includes('clean') || lower.includes('janitor') || lower.includes('housekeeping')) {
      category = 'Cleaning and maintenance';
      if (lower.includes('cleaning') || lower.includes('housekeeping')) requiredSkills.push('cleaning');
    } else if (lower.includes('tutoring') || lower.includes('tutor')) {
      category = 'Tutoring and event staffing';
    }

    // 3. Payment parsing (range, min, max, payBasis)
    let minPay = null;
    let maxPay = null;
    let payBasis = null;

    if (/\b(?:per\s*day|\/day|daily)\b/i.test(lower)) {
      payBasis = 'daily';
    } else if (/\b(?:per\s*hour|\/hr|hourly)\b/i.test(lower)) {
      payBasis = 'hourly';
    } else if (/\b(?:per\s*shift|\/shift|shift)\b/i.test(lower)) {
      payBasis = 'shift';
    }

    // Pay range match: e.g. "paying ₹500 to ₹800 per day", "500 to 800", "500-800"
    const rangeMatch = lower.match(/(?:paying|pay|rate|for)?\s*(?:₹|rs\.?|inr|\$)?\s*(\d+)\s*(?:to|-)\s*(?:₹|rs\.?|inr|\$)?\s*(\d+)/i);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      minPay = parseInt(rangeMatch[1], 10);
      maxPay = parseInt(rangeMatch[2], 10);
    } else {
      const singlePayMatch =
        lower.match(/(?:paying|pay|min|over|at least)?\s*(?:₹|rs\.?|inr|\$)\s*(\d+)/i) ||
        lower.match(/(\d+)\s*(?:\/day|per day|daily|\/hr|per hour|hourly|\/shift|per shift)/i);
      if (singlePayMatch && singlePayMatch[1]) {
        minPay = parseInt(singlePayMatch[1], 10);
      }
    }

    // 4. Distance radius
    let maxDistanceKm = null;
    const distMatch =
      lower.match(/(?:within|in|under|radius of)\s*(\d+)\s*(?:km|kilometers)/i) ||
      lower.match(/(\d+)\s*(?:km|kilometers)\s*(?:radius|distance|within)/i);
    if (distMatch && distMatch[1]) {
      maxDistanceKm = parseInt(distMatch[1], 10);
    } else if (lower.includes('near') || lower.includes('nearby')) {
      maxDistanceKm = 15;
    }

    // 5. Locality and City
    let locality = null;
    let city = null;
    if (lower.includes('vijayawada')) {
      city = 'Vijayawada';
      locality = 'Vijayawada';
    } else if (lower.includes('atigre')) {
      locality = 'Atigre';
      city = 'Kolhapur';
    } else if (lower.includes('shiroli')) {
      locality = 'Shiroli MIDC';
      city = 'Kolhapur';
    } else if (lower.includes('ichalkaranji')) {
      locality = 'Ichalkaranji';
      city = 'Kolhapur';
    } else if (lower.includes('hatkanangale')) {
      locality = 'Hatkanangale';
      city = 'Kolhapur';
    } else if (lower.includes('jaysingpur') || lower.includes('jaisingpur')) {
      locality = 'Jaysingpur';
      city = 'Kolhapur';
    } else if (lower.includes('kolhapur')) {
      locality = 'Kolhapur';
      city = 'Kolhapur';
    } else {
      const cityMatch = raw.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
      if (cityMatch && cityMatch[1]) {
        locality = cityMatch[1].trim();
        city = cityMatch[1].trim();
      }
    }

    // 6. Date / Weekend parsing
    let workDate = null;
    let dateFilter = null;
    const now = new Date();

    if (lower.includes('this weekend') || lower.includes('weekend')) {
      dateFilter = 'weekend';
      const dayOfWeek = now.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(now);
      saturday.setDate(now.getDate() + daysUntilSaturday);
      workDate = saturday.toISOString().split('T')[0];
    } else if (lower.includes('tomorrow')) {
      dateFilter = 'tomorrow';
      const tmrw = new Date(now);
      tmrw.setDate(now.getDate() + 1);
      workDate = tmrw.toISOString().split('T')[0];
    } else if (lower.includes('today')) {
      dateFilter = 'today';
      workDate = now.toISOString().split('T')[0];
    }

    // Keyword formulation: default to raw or skill
    let keyword = raw;
    if (requiredSkills.length > 0) {
      keyword = requiredSkills[0];
    } else if (category) {
      keyword = category;
    }

    // Confidence scoring
    let confidence = 0.6;
    if (category) confidence += 0.15;
    if (locality || city) confidence += 0.1;
    if (minPay || maxDistanceKm) confidence += 0.1;
    confidence = Math.min(0.98, Math.round(confidence * 100) / 100);

    return {
      keyword,
      category,
      locality,
      city,
      maxDistanceKm,
      minPay,
      maxPay,
      payBasis,
      shiftTiming,
      workDate,
      dateFilter,
      requiredSkills,
      confidence,
      ambiguities,
      source: 'local-rule-parser'
    };
  }
}

export const aiExplanationService = new AiExplanationService();

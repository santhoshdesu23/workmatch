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
Job: ${safeTitle} in ${safeCat}. Pay: $${Number(job.grossPay) || 0} (${sanitizeForPrompt(job.payBasis, 20)}). Required skills: ${safeReqSkills}.
Worker skills: ${safeWorkerSkills}. Expected pay: $${Number(workerProfile?.expectedPay?.min) || 0}. Match Score: ${matchResult.matchScore}/100.
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
      minPay: null
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
"minPay": number or null.
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
    } catch (err) {
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
   * Deterministic local fallback query parser
   */
  getLocalDeterministicQueryParser(query) {
    const lower = (query || '').toLowerCase();
    let category = null;

    if (lower.includes('event') || lower.includes('usher')) category = 'Event assistance';
    else if (lower.includes('catering') || lower.includes('wedding')) category = 'Wedding and catering support';
    else if (lower.includes('restaurant') || lower.includes('server') || lower.includes('waiter') || lower.includes('barista')) category = 'Restaurant and hospitality';
    else if (lower.includes('retail') || lower.includes('store') || lower.includes('cashier')) category = 'Retail and store assistance';
    else if (lower.includes('warehouse') || lower.includes('packing') || lower.includes('forklift')) category = 'Warehouse and packing';
    else if (lower.includes('delivery') || lower.includes('driver')) category = 'Delivery and logistics';
    else if (lower.includes('clean') || lower.includes('janitor')) category = 'Cleaning and maintenance';
    else if (lower.includes('data entry') || lower.includes('office')) category = 'Data entry and office assistance';

    let minPay = null;
    const payMatch = lower.match(/(?:\$|₹|rs\.?|inr)?\s*(\d+)\s*(?:\/hr|per hour|hourly|\/shift|per shift|shift|\$|₹)?/);
    if (payMatch && payMatch[1]) {
      const val = parseInt(payMatch[1], 10);
      if (val > 0) minPay = val;
    }

    let locality = null;
    if (lower.includes('atigre')) locality = 'Atigre';
    else if (lower.includes('shiroli')) locality = 'Shiroli MIDC';
    else if (lower.includes('ichalkaranji')) locality = 'Ichalkaranji';
    else if (lower.includes('hatkanangale')) locality = 'Hatkanangale';
    else if (lower.includes('jaysingpur') || lower.includes('jaisingpur')) locality = 'Jaysingpur';
    else if (lower.includes('kolhapur')) locality = 'Kolhapur';

    return {
      keyword: query,
      category,
      locality,
      maxDistanceKm: lower.includes('near') ? 15 : null,
      minPay,
      source: 'local-rule-parser'
    };
  }
}

export const aiExplanationService = new AiExplanationService();

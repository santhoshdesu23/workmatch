/**
 * AI Service Layer with Google Gemini API and Local Deterministic Fallback
 */

export class AiExplanationService {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    this.apiKey = apiKey;
    this.providerName = apiKey ? 'Google Gemini API' : 'Deterministic Local Fallback';
  }

  /**
   * Generates a conversational explanation of a match between worker profile and job
   */
  async generateMatchExplanation(workerProfile, job, matchResult) {
    if (!this.apiKey) {
      return this.getLocalDeterministicExplanation(workerProfile, job, matchResult);
    }

    try {
      // Gemini REST API endpoint
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`;
      const prompt = `
You are the WorkMatch AI assistant. Explain in 2 concise, honest sentences why this job is or isn't a strong match for this worker.
Job: ${job.title} in ${job.category}. Pay: $${job.grossPay} (${job.payBasis}). Required skills: ${job.requiredSkills?.join(', ')}.
Worker skills: ${workerProfile?.skills?.join(', ')}. Expected pay: $${workerProfile?.expectedPay?.min || 0}. Match Score: ${matchResult.matchScore}/100.
Distance: ${matchResult.distanceKm !== null ? matchResult.distanceKm + ' km' : 'Unknown'}.
Tone: Professional, supportive, objective. Do not make false guarantees.
`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
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
      console.warn('[AI Service] Error contacting Gemini API:', err.message);
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

    if (!this.apiKey || !query) {
      return this.getLocalDeterministicQueryParser(query);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`;
      const prompt = `
Parse this temporary job search query into a JSON object: "${query}".
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
        })
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
    const payMatch = lower.match(/\$?(\d+)\s*(\/hr|per hour|hourly|\$)/);
    if (payMatch) {
      minPay = parseInt(payMatch[1], 10);
    }

    return {
      keyword: query,
      category,
      maxDistanceKm: lower.includes('near') ? 15 : null,
      minPay,
      source: 'local-rule-parser'
    };
  }
}

export const aiExplanationService = new AiExplanationService();

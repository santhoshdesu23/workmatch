# WorkMatch — Mixed Smart Matching Engine Implementation Report
**Exact Matches + Strong Matches + Partial Matches**

---

## 1. Architectural Summary

The WorkMatch Mixed Smart Matching Engine introduces a deterministic, multi-tier matching architecture that replaces single-score heuristic filtering with explainable match classifications. It partitions job candidates into three distinct tiers:
1. **Exact Matches**: Candidates that satisfy 100% of hard constraints and 100% of applicable worker preferences.
2. **Strong Matches**: Candidates that satisfy 100% of hard constraints and have very high relevance, with at most 1 minor preference difference (or 1 missing optional skill).
3. **Partial Matches**: Candidates that satisfy 100% of hard constraints while clearly presenting all soft trade-offs (e.g., lower compensation than profile expectation, shift on an alternative day).

### Cardinal Invariant
> **CRITICAL RULE**: A partial match must **NEVER** violate an explicit mandatory requirement or an employer-defined mandatory job requirement.
> Hard requirements are never relaxed to increase result counts. Any job that fails even one hard constraint is disqualified from exact, strong, and partial matches alike.

```
                           +---------------------------+
                           | Candidate Job Opportunities |
                           +---------------------------+
                                         |
                                         v
                     +---------------------------------------+
                     |  Hard Requirement Gating Layer       |
                     |  - Job Status = OPEN                 |
                     |  - Application Deadline Not Passed   |
                     |  - Work Schedule Not Ended           |
                     |  - Openings Remaining > 0            |
                     |  - Explicit UI/NLP Filters Matched   |
                     |  - Employer Required Skills Present  |
                     +---------------------------------------+
                                    /         \
                             Violated         Satisfied
                                  /             \
                                 v               v
                         +---------------+  +--------------------------------+
                         | Disqualified  |  |  Soft Preferences Evaluation   |
                         | (Not eligible)|  |  - Preferred Categories        |
                         +---------------+  |  - Expected Pay                |
                                            |  - Profile Travel Radius       |
                                            |  - Declared Available Days/Slots|
                                            |  - Optional Job Skills         |
                                            +--------------------------------+
                                                             |
                                            +----------------+----------------+
                                            |                |                |
                                     0 Differences     1 Difference      >=2 Differences
                                            |                |                |
                                            v                v                v
                                      [Exact Match]   [Strong Match]   [Partial Match]
```

---

## 2. Requirement Classification Table

| Dimension | Classification | Provenance Source | Enforcement / Gating Behavior |
| :--- | :--- | :--- | :--- |
| **Job Status & Openings** | `HARD` | `SAFETY_CONDITION` | Must be `OPEN` and `openings - filledCount > 0`. |
| **Application Deadline** | `HARD` | `SAFETY_CONDITION` | Must not have passed current reference timestamp. |
| **Work Schedule Status** | `HARD` | `SAFETY_CONDITION` | Scheduled shift end time must be in the future. |
| **Explicit Category Filter** | `HARD` | `UI_FILTER` / `NLP_QUERY` | Exact case-insensitive category match required. |
| **Explicit Pay Min / Max** | `HARD` | `UI_FILTER` / `NLP_QUERY` | `grossPay >= minPay` and `grossPay <= maxPay`. |
| **Explicit Pay Basis** | `HARD` | `UI_FILTER` / `NLP_QUERY` | Job basis must match requested basis (`hourly`, `daily`, `shift`). |
| **Explicit Work Date / Range**| `HARD` | `UI_FILTER` / `NLP_QUERY` | UTC calendar date or date range must contain job date. |
| **Explicit Shift Timing** | `HARD` | `UI_FILTER` / `NLP_QUERY` | Job start time window (`morning`, `afternoon`, `evening`, `night`). |
| **Explicit Distance Radius** | `HARD` | `UI_FILTER` / `NLP_QUERY` | Unrounded Haversine distance `<= maxDistanceKm`. Missing coordinates rejected. |
| **Employer Required Skills** | `HARD` | `EMPLOYER_MANDATORY` | Worker MUST possess all required skills (or canonical aliases). Missing mandatory skill -> hard rejection. |
| **Worker Preferred Categories**| `SOFT` | `WORKER_PROFILE` | Exact match = 0 diff; related category = 1 diff; unrelated = 2 diffs. |
| **Worker Expected Pay** | `SOFT` | `WORKER_PROFILE` | Effective hourly comparison. Below target = 1 diff. |
| **Worker Profile Travel Radius**| `SOFT` | `WORKER_PROFILE` | Within radius = 0 diff; `<= 1.5x` = 1 diff; `> 1.5x` = 2 diffs. |
| **Worker Availability (Days/Slots)**| `SOFT` | `WORKER_PROFILE` | Day outside preferred = 1 diff; slot mismatch = 1 diff. |
| **Optional Job Skills** | `SOFT` | `EMPLOYER_MANDATORY` | Missing optional skills recorded in `missingOptionalSkills`. |

---

## 3. Result Grouping Rules and Scoring Thresholds

```
Tier       Hard Constraints   Soft Differences   Score Range   Disclosed Differences
Exact      100% Satisfied     0 Differences      85 - 100%     None
Strong     100% Satisfied     1 Difference       70 - 84%      Exact trade-off highlighted
Partial    100% Satisfied     >= 2 Differences   40 - 69%      Every trade-off highlighted
```

- When `showCloseMatches: false`:
  - `results.exact`: all exact matches.
  - `results.strong`: `[]`
  - `results.partial`: `[]`
  - `counts`: `{ exact: N, strong: 0, partial: 0, total: N }`

---

## 4. Skill Matching & Canonical Aliases

### Substring Prevention Architecture
To prevent false-positive substring collisions (e.g. `"car"` matching `"carpenter"`, or `"bar"` matching `"bartender"`), skill matching uses **token-boundary whole-word matching** and an explicit bidirectional **canonical alias map**.

### Canonical Aliases Reference
| Canonical Domain | Equivalent Aliases |
| :--- | :--- |
| **server / waiter** | `waiter`, `waitress`, `food server`, `steward`, `table service` |
| **cashier / billing** | `cashier`, `billing`, `counter staff`, `billing executive`, `cash desk`, `pos operator` |
| **packing / packaging** | `packing`, `packaging`, `packer`, `box packing`, `order packing` |
| **cleaning / housekeeping**| `cleaning`, `housekeeping`, `janitorial`, `sweeper`, `cleaner`, `sanitization` |
| **cook / chef** | `cook`, `chef`, `cooking`, `kitchen helper`, `food preparation` |
| **driver / delivery** | `driver`, `driving`, `chauffeur`, `delivery driver`, `courier`, `dispatch` |
| **data entry** | `data entry`, `typing`, `data operator`, `back office`, `computer operator` |
| **bartender** | `bar tender`, `mixologist` *(Note: "bar" is not an alias)* |
| **carpenter** | `carpentry`, `woodwork`, `woodworking` *(Note: "car" is not an alias)* |

---

## 5. Location Distance Calculation & Reliability

- **Distance Metric**: Unrounded Haversine formula implemented in `calculateDistanceKmPrecise` for accurate boundary compliance (e.g., job exactly at 10.000 km boundary is included).
- **Coordinate Reliability**:
  - `distanceReliability: 'exact'` when both origin and destination have valid, non-zero GeoJSON `[lng, lat]` coordinates.
  - `distanceReliability: 'unknown'` when coordinates are missing, uncalibrated (`[0, 0]`), or null.
  - Unknown distance is transparently disclosed; no fabricated coordinates or simulated scores are generated.

---

## 6. Availability & Schedule Interval Matching

- **Calendar Date Consistency**: Multi-timezone normalization via `extractCalendarDateParts` prevents UTC-midnight drift across Indian Standard Time and global client zones.
- **Shift Interval Calculation**:
  - Automatically calculates shift duration from `startTime` and `endTime`.
  - Fully handles **overnight shifts** crossing midnight (e.g., `22:00` to `06:00` correctly evaluates to 8.0 hours).
- **Timing Windows**:
  - Morning: `05:00` to `11:59`
  - Afternoon: `12:00` to `16:59`
  - Evening: `17:00` to `20:59`
  - Night: `21:00` to `04:59`

---

## 7. Payment Normalization Logic

Jobs use diverse payment bases (`hourly`, `daily`, `shift`, `task`). The engine calculates the **effective hourly rate** using actual job hours (`calculateJobHours`), without arbitrary 8-hour assumptions:

$$\text{Effective Hourly Rate} = \begin{cases} \text{grossPay} & \text{if basis is hourly} \\ \frac{\text{grossPay}}{\text{totalHours}} & \text{if basis is daily, shift, or task} \end{cases}$$

---

## 8. Natural Language Search Parser Capabilities

Endpoint: `POST /api/recommendations/nl-search`

### Supported Queries & Fields
The engine supports complex conversational natural-language queries.
**Example Query**:
> *"Find evening data entry jobs in Vijayawada within 10 km, paying ₹500 to ₹800 per day this weekend."*

**Parsed Structured Result**:
```json
{
  "keyword": "data entry",
  "category": "Data entry and office assistance",
  "locality": "Vijayawada",
  "city": "Vijayawada",
  "maxDistanceKm": 10,
  "minPay": 500,
  "maxPay": 800,
  "payBasis": "daily",
  "shiftTiming": "evening",
  "dateFilter": "weekend",
  "workDate": "2026-11-07",
  "requiredSkills": ["data entry"],
  "confidence": 0.95,
  "ambiguities": [],
  "source": "local-rule-parser"
}
```

---

## 9. API Contracts

### `GET /api/jobs` and `GET /api/recommendations/jobs`
**Response Payload Schema**:
```json
{
  "success": true,
  "results": {
    "exact": [
      {
        "_id": "6ae8467835d71027362c744c",
        "title": "Banquet Hall Setup Assistant",
        "category": "Event assistance",
        "grossPay": 350,
        "payBasis": "hourly",
        "workDate": "2026-11-07T00:00:00.000Z",
        "startTime": "18:00",
        "endTime": "23:00",
        "matchType": "exact",
        "matchScore": 95,
        "matchedRequirements": ["Job is open and accepting applications", "Direct match with preferred category"],
        "matchedSkills": ["Server"],
        "missingOptionalSkills": [],
        "preferenceDifferences": [],
        "distanceKm": 1.2,
        "distanceReliability": "exact"
      }
    ],
    "strong": [],
    "partial": []
  },
  "counts": {
    "exact": 1,
    "strong": 0,
    "partial": 0,
    "total": 1
  },
  "appliedRequirements": [
    { "field": "category", "value": "Event assistance", "type": "HARD", "source": "UI_FILTER" },
    { "field": "status", "value": "OPEN", "type": "HARD", "source": "SAFETY_CONDITION" }
  ],
  "jobs": [ /* flattened paginated list for legacy consumers */ ],
  "recommendations": [ /* present on recommendations endpoint */ ],
  "total": 1,
  "evaluatedAt": "2026-11-02T08:30:00.000Z"
}
```

---

## 10. Frontend Implementation

### Pages Updated:
1. `client/src/pages/public/JobDiscoveryPage.tsx`
2. `client/src/pages/worker/WorkerRecommendationsPage.tsx`
3. `client/src/utils/jobSearchParams.js`
4. `client/src/utils/nlSearchUtils.js`
5. `client/src/types/index.ts`

### UI Enhancements:
- **Show close matches Switch**: Easily toggles inclusion of Strong and Partial matches.
- **Collapsible Tier Accordions**: Clean emerald, sky, and amber section headers with active item counts and one-click expand/collapse.
- **Tier Match Badges**:
  - Exact Match: `<Badge variant="emerald"><CheckCircle2 /> Exact Match</Badge>`
  - Strong Match: `<Badge variant="blue"><Sparkles /> Strong Match</Badge>`
  - Partial Match: `<Badge variant="amber">Partial Match</Badge>`
- **Preference Difference Chips**: Transparently highlights all divergence details on Strong and Partial cards (e.g. `• Offered rate is ₹50 below your profile target`, `• Slightly outside preferred travel radius (~18 km vs 15 km)`).

---

## 11. Test Coverage Summary (24 Scenarios)

The comprehensive regression suite in `server/tests/mixed_smart_matching.test.js` validates all 24 criteria:

| # | Verified Test Scenario | Result |
| :--- | :--- | :--- |
| 1 | Exact match satisfaction (all hard & soft constraints met) | PASS |
| 2 | Hard requirement rejection: category mismatch | PASS |
| 3 | Hard requirement rejection: minimum pay violated | PASS |
| 4 | Hard requirement rejection: maximum pay violated | PASS |
| 5 | Hard requirement rejection: distance radius exceeded | PASS |
| 6 | Hard requirement rejection: explicit date mismatch | PASS |
| 7 | Hard requirement rejection: employer mandatory skill missing | PASS |
| 8 | Hard requirement rejection: deadline passed or work ended | PASS |
| 9 | Hard requirement rejection: zero openings left (all filled) | PASS |
| 10 | Strong match with 1 missing optional skill | PASS |
| 11 | Strong match with minor distance excess (profile preference) | PASS |
| 12 | Strong match with related category (profile preference) | PASS |
| 13 | Partial match with multiple soft preference differences | PASS |
| 14 | Partial match with pay below profile expectation (no UI filter) | PASS |
| 15 | Partial match with day outside worker preferred days (no UI filter) | PASS |
| 16 | **Invariant check**: Partial match never contains hard requirement violations | PASS |
| 17 | Requirement provenance tracking across UI, NLP, Profile, Safety | PASS |
| 18 | Skill matching aliases without false substrings (car != carpenter, bar != bartender) | PASS |
| 19 | Payment normalization across bases using actual shift totalHours | PASS |
| 20 | Unknown distance marked as `distanceReliability: 'unknown'` | PASS |
| 21 | "Show close matches" parameter toggles strong and partial results | PASS |
| 22 | Natural language parser extracts shift timing, dates, payment range, skills | PASS |
| 23 | Backward compatibility: `jobs` and `recommendations` flat arrays preserved | PASS |
| 24 | Bounded candidate scoring in controllers | PASS |

---

## 12. Verification and Quality Gates

1. **Backend Tests**: 19 test files, 325 tests passed (`npm --prefix server test`).
2. **Frontend Tests**: 9 test suites, 34 tests passed (`npm --prefix client test`).
3. **Frontend Linter**: 0 errors across 77 files (`npm --prefix client run lint`).
4. **Production Build**: Complete Vite & TypeScript build succeeded with 0 errors (`npm --prefix client run build`).


# WorkMatch — AI-Powered Location-Based Temporary Employment Marketplace

> **"Find Work When You Need It."**  
> *Local Opportunities. Flexible Work. Trusted Connections.*

WorkMatch connects temporary workers (students, freelancers, part-time staff) with businesses, event organizers, caterers, banquet venues, retail stores, and logistics warehouses.

---

## 🌟 Key Principles & Value Proposition

1. **Voluntary Applications**: Workers always retain complete freedom to apply or decline. System notifications never autonomously apply or assign shifts.
2. **Human Hiring Authority**: Employers always make the final candidate selection and hiring decisions.
3. **Transparent Terms**: Every job clearly displays hourly/shift compensation, start & end times, meal breaks, exact work venue, requirements, and openings.
4. **Explainable AI Matching**: 5-factor deterministic matching engine (Skills 30%, Proximity 25%, Availability 20%, Pay 15%, Category 10%) with transparent component scoring and human-readable explanations.
5. **Verified Trust & Completion Integrity**: Dual-confirmation shift completion, authentic verified badges based on real document review, and zero fabricated ratings.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide React icons, Axios, Recharts (analytics), Leaflet + OpenStreetMap (geospatial shift map).
- **Backend**: Node.js, Express.js (ES modules), MongoDB / Mongoose, JWT authentication, bcryptjs password hashing, Zod validation, helmet, cors, express-rate-limit.
- **Database**: MongoDB Atlas with embedded in-memory MongoDB fallback (`mongodb-memory-server`) for zero-configuration local runs and automated tests.
- **AI/ML Engine**: Deterministic explainable scoring engine + optional Google Gemini API integration with automatic local fallback.
- **Testing**: Vitest & Supertest API integration test suite.

---

## 🚀 Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **npm**: v9+

### 2. Installation
Install dependencies in both backend and frontend:
```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### 3. Running Locally
You can run the backend and frontend in separate terminals:

**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
```
*The server starts at `http://localhost:5000` (auto-connects to in-memory MongoDB if no `MONGODB_URI` is provided).*

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
```
*The client starts at `http://localhost:5173` with proxying to the backend.*

---

## 👥 Demo Accounts (1-Click Instant Evaluation)

The application includes realistic, fictional demo data for immediate testing. On the `/login` screen or the top navigation bar, use the **1-Click Demo Buttons** or log in manually:

| Role | Email | Password | Details |
|---|---|---|---|
| **Worker (Alex Rivera)** | `worker@workmatch.demo` | `Password123!` | Hospitality & Banquet Server, 9 completed shifts, 4.9 rating |
| **Worker 2 (Jordan Taylor)** | `worker2@workmatch.demo` | `Password123!` | Warehouse & Retail Specialist, student schedule |
| **Employer (Apex Staffing)** | `employer@workmatch.demo` | `Password123!` | Event Banquet Operations, verified business badge |
| **Employer 2 (Metro Dispatch)** | `employer2@workmatch.demo` | `Password123!` | Warehouse Packaging Fulfillment |
| **Administrator** | `admin@workmatch.demo` | `AdminPass123!` | System moderation, reports, verifications & analytics |

To seed/reseed the database anytime:
```bash
cd server
npm run seed
```

---

## 🧪 Automated Testing

Run the automated test suite with Vitest and Supertest:
```bash
cd server
npm test
```
The test suite validates:
- API health check (`/api/health`)
- User registration, password hashing & duplicate email rejection
- Session retrieval and role enforcement
- Job creation, filtering, and voluntary applications
- Duplicate application prevention
- Capacity safeguards (preventing hiring beyond opening limits)
- Explainable AI 5-factor scoring engine math & Haversine distance calculations
- Fallback explanation generation without external API keys
- Server-side administrative authorization protection

---

## 🏗️ Production Build

To verify and build the client for production:
```bash
cd client
npm run build
```
Build output is emitted to `client/dist`.

---

## 🌐 API Endpoints Reference

### Health
- `GET /api/health` — Dedicated service health check

### Authentication
- `POST /api/auth/register` — Register worker or employer
- `POST /api/auth/login` — Login with credentials
- `GET /api/auth/me` — Authenticated session & profile
- `POST /api/auth/forgot-password` — Password recovery flow
- `POST /api/auth/reset-password` — Password update
- `POST /api/auth/verify-email` — Email verification confirmation

### Jobs Marketplace
- `GET /api/jobs` — Public search, category, location, and date filters
- `GET /api/jobs/:jobId` — Single job details & compatibility score
- `POST /api/jobs` — Employer creates job posting
- `PATCH /api/jobs/:jobId` — Employer updates job posting
- `POST /api/jobs/:jobId/cancel` — Cancel job posting and notify applicants
- `POST /api/jobs/:jobId/save` — Worker bookmarks job
- `DELETE /api/jobs/:jobId/save` — Worker removes bookmark

### Applications
- `POST /api/jobs/:jobId/apply` — Worker voluntary application
- `GET /api/applications/me` — Worker view of all submitted applications
- `GET /api/jobs/:jobId/applications` — Employer candidate review with AI match scores
- `PATCH /api/applications/:applicationId/status` — Shortlist, Offer, Hire, or Reject
- `POST /api/applications/:applicationId/withdraw` — Worker voluntary withdrawal
- `POST /api/applications/:applicationId/respond-to-offer` — Worker accepts or declines offer

### AI Recommendations
- `GET /api/recommendations/jobs` — Personalized 5-factor ranked shift matches
- `POST /api/recommendations/explain` — Conversational explanation (Gemini API or local engine)
- `POST /api/recommendations/nl-search` — Natural language search query parsing

### Shifts & Assignments
- `GET /api/assignments/me` — Shift schedule, attendance, and confirmed assignments
- `POST /api/assignments/:assignmentId/confirm-completion` — Dual checkout confirmation
- `PATCH /api/assignments/:assignmentId/status` — Update shift attendance status

### Payments
- `GET /api/payments/me` — Transparent earnings and payment history
- `PATCH /api/payments/:paymentId/status` — Employer records payment disbursement

### Reviews & Reports
- `POST /api/reviews` — Submit review for eligible completed shift
- `GET /api/reviews/:userId` — View user reviews
- `POST /api/reports` — Report incident or fraudulent listing to moderation

### Administration
- `GET /api/admin/dashboard` — Platform analytics, funnels, and counts
- `GET /api/admin/users` — User management and audit logs
- `PATCH /api/admin/users/:userId/status` — Suspend or activate user account
- `GET /api/admin/jobs` — Job moderation queue
- `GET /api/admin/reports` — Incident report moderation queue
- `PATCH /api/admin/reports/:reportId` — Resolve incident report
- `GET /api/admin/verifications` — Business and ID verification queue
- `PATCH /api/admin/verifications/:verificationId` — Approve or reject verification request

---

## 🚢 Deployment Guide

### Frontend Deployment (Vercel)
1. Set Framework Preset to **Vite**.
2. Root Directory: `client`.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Environment Variable: `VITE_API_URL=https://your-backend.onrender.com/api`.

### Backend Deployment (Render)
1. Create a **Web Service** on Render with Root Directory: `server`.
2. Build Command: `npm install`.
3. Start Command: `npm start`.
4. Environment Variables:
   - `PORT=5000` (or leave default, Render supplies `PORT`)
   - `NODE_ENV=production`
   - `MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/workmatch?retryWrites=true&w=majority`
   - `JWT_SECRET=<strong-random-production-secret>`
   - `CLIENT_URL=https://your-workmatch-frontend.vercel.app`
   - `GEMINI_API_KEY=<optional-gemini-key>`

---

## 🔒 Security & Data Integrity Highlights

- **Password Hashing**: Salting and hashing via `bcryptjs`.
- **JWT Protection**: Tokens verified on all protected worker, employer, and admin routes.
- **Role Enforcement**: Server-enforced authorization guards prevent unauthorized access regardless of client UI state.
- **Race Condition Prevention**: Atomic conditional operations on database openings (`filledCount: { $lt: openings }`) prevent overbooking.
- **Rate Limiting & Security Headers**: Helmet headers and Express rate limiting active on `/api`.
- **Zero Dark Patterns**: No auto-applications, no fabricated badges, and upfront disclosure of all shift details.

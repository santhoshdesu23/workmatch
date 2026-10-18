# WorkMatch — Production Hardening & Deployment Manual

WorkMatch is an explainable AI-powered, location-based temporary employment marketplace connecting workers with local employers for verified short-duration shifts.

This guide provides exhaustive documentation for deploying WorkMatch in production with zero-known defects across Vercel, Render, and MongoDB Atlas.

---

## 1. Production Architecture Overview

```
                      +-----------------------------+
                      |   Cloudflare / Vercel Edge  |
                      |   (HTTPS, CDN, DDoS Guard)  |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
      +------------------+                       +-------------------+
      |  Vercel Frontend |                       |   Render Backend  |
      |   (Vite + React) |                       |  (Express Node.js)|
      +--------+---------+                       +---------+---------+
               |                                           |
               +---------------------+---------------------+
                                     |
                                     v
                       +---------------------------+
                       |   MongoDB Atlas Cluster   |
                       | (M10+, Replica Set, TLS)  |
                       +---------------------------+
```

---

## 2. Environment Variables & Secret Specifications

### Production Environment Variables

| Variable Name | Required | Min Length | Target Component | Description |
|---|---|---|---|---|
| `NODE_ENV` | **Yes** | — | Backend | Must be set to `production`. Enforces strict security policies, disables development fallbacks, and hides error stack traces. |
| `PORT` | **Yes** | — | Backend | Server port (default `5000` or assigned dynamically by Render/Cloud provider). |
| `MONGODB_URI` | **Yes** | — | Backend | MongoDB Atlas connection string with TLS/SSL, replica set, and write concern. Silent fallback to in-memory databases is prohibited in production. |
| `JWT_SECRET` | **Yes** | 32 chars | Backend | Cryptographically random secret used with HMAC-SHA256. Boot will fail fast if shorter than 32 characters. |
| `CLIENT_URL` | **Yes** | — | Backend | Public frontend domain (e.g. `https://workmatch.vercel.app`). Enforces strict CORS allowlist and generates password-reset URLs. |
| `EMAIL_PROVIDER` | **Yes** | — | Backend | Must be set to `brevo` or `resend` in production. Boot will fail fast if set to `mock` or omitted in production. |
| `BREVO_API_KEY` | Conditional | — | Backend | Official Brevo API key (required if `EMAIL_PROVIDER=brevo`). |
| `RESEND_API_KEY` | Conditional | — | Backend | Official Resend API key (`re_...`, required if `EMAIL_PROVIDER=resend`). |
| `EMAIL_FROM` | **Yes** | — | Backend | Verified sender header (e.g. `WorkMatch Security <your_verified_sender@example.com>`). Must match an approved sender in your Brevo or Resend account. |
| `RATE_LIMIT_STORE` | Optional | — | Backend | `memory` (default) for single-instance, or `redis` for multi-instance horizontal scaling. |
| `REDIS_URL` | Conditional | — | Backend | Redis connection string (required in production if `RATE_LIMIT_STORE=redis`). |
| `GEMINI_API_KEY` | Optional | — | Backend | Google Gemini API Key. If absent, WorkMatch seamlessly falls back to the deterministic explainable rule engine. |
| `VITE_API_URL` | **Yes** | — | Frontend | Root endpoint for backend API calls (e.g. `/api` for Vercel monorepo, or `https://workmatch-api.onrender.com/api`). |
| `VITE_ENABLE_DEMO_SHORTCUTS` | Optional | — | Frontend | Set to `false` in production to prevent 1-click test credentials from appearing on public login screens. |

> **Security Rule:** Never commit `.env` files to git. Verify that `.env` is listed in [`.gitignore`](./.gitignore).

### 2.1 Transactional Email Configuration (Brevo REST API or Resend SDK)

WorkMatch supports Brevo (official HTTPS REST API, ideal for Render free tier which blocks SMTP) and Resend.

- **Option A: Brevo Configuration (Recommended on Render):**
  - `EMAIL_PROVIDER=brevo`
  - `BREVO_API_KEY=<your_brevo_api_key>`
  - `EMAIL_FROM=WorkMatch Security <your_verified_sender@example.com>`
  - `CLIENT_URL=https://<your-frontend>.vercel.app`

- **Option B: Resend Configuration:**
  - `EMAIL_PROVIDER=resend`
  - `RESEND_API_KEY=re_...`
  - `EMAIL_FROM=WorkMatch Security <security@workmatch.app>`
  - `CLIENT_URL=https://<your-frontend>.vercel.app`

> [!IMPORTANT]
> **Sender Verification Requirement:**  
> The sender email address specified in `EMAIL_FROM` must be verified in your Brevo (Senders & IP) or Resend (Domains) account before live transactional emails can be dispatched. In Brevo, personal email addresses (such as Gmail) can be verified directly without purchasing a domain.

---

## 3. Deployment Targets

### Option A: Monorepo Deployment on Vercel (Frontend + Serverless API)

1. Connect your GitHub repository on [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `./`
   - **Build Command:** `npm --prefix client install && npm --prefix client run build`
   - **Output Directory:** `client/dist`
3. Configure Environment Variables in Vercel Dashboard:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@cluster.mongodb.net/workmatch?retryWrites=true&w=majority`
   - `JWT_SECRET`: *(Cryptographically random 64-character hex string)*
   - `CLIENT_URL`: `https://<your-project>.vercel.app`
   - `EMAIL_PROVIDER`: `resend`
   - `RESEND_API_KEY`: `re_your_resend_api_key`
   - `EMAIL_FROM`: `WorkMatch Security <security@workmatch.app>`
   - `GEMINI_API_KEY`: *(Your Google AI Studio Key)*
   - `VITE_API_URL`: `/api`
4. Deploy. [`vercel.json`](./vercel.json) routes `/api/*` to [`api/index.js`](./api/index.js) and static routes to `index.html`.

---

### Option B: Decoupled Deployment (Vercel Frontend + Render Backend)

#### Backend on Render (Web Service):
1. Create a new **Web Service** on [Render](https://render.com).
2. Select your repository and specify:
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Add Environment Variables on Render:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: `your_atlas_connection_string`
   - `JWT_SECRET`: `your_random_32char_secret`
   - `CLIENT_URL`: `https://your-frontend.vercel.app`
   - `EMAIL_PROVIDER`: `resend`
   - `RESEND_API_KEY`: `re_your_resend_api_key`
   - `EMAIL_FROM`: `WorkMatch Security <security@workmatch.app>`
   - `GEMINI_API_KEY`: `your_gemini_key`
4. Set Health Check path to `/api/health`.

#### Frontend on Vercel:
1. Create a project on Vercel with **Root Directory:** `client`.
2. Add Environment Variable:
   - `VITE_API_URL`: `https://your-render-service.onrender.com/api`

---

## 4. Database Hardening (MongoDB Atlas)

1. **Network Security:**
   - In Atlas *Network Access*, add the outbound IP addresses of your Render or Vercel deployment (or use VPC Peering / AWS PrivateLink for enterprise setups).
   - For serverless deployments where static egress IPs are not available, use temporary strict CIDR ranges or secured user credential rotation.
2. **Database User Least Privilege:**
   - Create a dedicated database user with `readWrite` access restricted solely to the `workmatch` database.
   - Do not grant cluster-admin privileges to the application runtime user.
3. **Indexes Verification:**
   - Geospatial index: `Job.collection.createIndex({ location: "2dsphere" })`
   - Unique constraints:
     - `Application`: `{ job: 1, worker: 1 }` (unique)
     - `Review`: `{ assignment: 1, reviewer: 1 }` (unique)
     - `User`: `{ email: 1 }` (unique)
     - `PaymentRecord`: `{ assignment: 1 }` (unique)

---

## 5. Backup & Disaster Recovery Procedures

### Automated Cloud Backups
- Enable MongoDB Atlas Continuous Cloud Backups (Point-In-Time Restore) with 7-day retention for production clusters.

### Manual Backup (Database Snapshot)
To export a full point-in-time backup locally or to secure S3 storage:

```bash
mongodump --uri="mongodb+srv://<username>:<password>@cluster.mongodb.net/workmatch" --out="./backup-$(date +%Y%m%d_%H%M%S)"
```

### Recovery Verification Runbook
To verify database recovery in a safe staging or disaster recovery environment:

```bash
# 1. Verify archive integrity
mongorestore --dryRun --uri="mongodb+srv://<staging_user>:<staging_pass>@staging-cluster.mongodb.net/workmatch" ./backup-<TIMESTAMP>/workmatch

# 2. Perform restoration to target database
mongorestore --drop --uri="mongodb+srv://<staging_user>:<staging_pass>@staging-cluster.mongodb.net/workmatch" ./backup-<TIMESTAMP>/workmatch

# 3. Verify record integrity through test suite
NODE_ENV=test MONGODB_URI="mongodb+srv://<staging_user>:<staging_pass>@staging-cluster.mongodb.net/workmatch" npm --prefix server test
```

---

## 6. Health Monitoring & Incident Runbook

### Health Check Endpoints
- **Liveness Probe:** `GET /api/health`
  - Returns `200 OK` with `{ status: "healthy", uptimeSeconds, service }`.
  - Used by Render, Kubernetes, or load balancers to determine process responsiveness.
- **Readiness Probe:** `GET /api/health/ready`
  - Returns `200 OK` if database connection state is active (`readyState === 1`).
  - Returns `503 Service Unavailable` if database disconnected.

### Rate Limit Alert Thresholds
- Rate limit violations return `HTTP 429 Too Many Requests`.
- Monitor repeated 429 errors on `/api/auth/*` as indicators of credential brute-forcing.

### Graceful Shutdown
- The backend process traps `SIGTERM` and `SIGINT`, stops accepting new HTTP connections, completes ongoing transactions, disconnects Mongoose cleanly, and exits within 10 seconds.

# WorkMatch Worker Attendance Management System Report

**Date**: November 14, 2026  
**System**: WorkMatch Full-Stack Application  
**Feature**: GPS-Based Worker Attendance & Employer Manual Attendance System  

---

## 1. Architectural Overview

The WorkMatch Attendance Management System provides end-to-end job-wise attendance tracking for confirmed shifts, combining geofenced self-service mobile/desktop check-ins for workers with an employer management, audit, and correction suite.

### Core Principles
1. **Confirmed Shift Pre-requisite**: Only workers with active, confirmed `Assignment` records (`status !== 'CANCELLED'`) can be tracked or checked in. Unselected applicants are strictly excluded.
2. **True Geolocation Check-in**: Worker self check-in validates device coordinates against confirmed job venue coordinates on the server using the spherical Haversine formula with a strict 200-meter threshold and maximum accuracy cap (150m).
3. **Employer Sovereignty with Integrity Protections**: Employers can record manual attendance (`present_manual`, `absent_manual`) with mandatory documented reasons. GPS-verified records (`present_gps`) are protected against accidental silent overwrites; corrections require explicit intention (`PATCH /api/attendance/:attendanceId/correction`) and write an immutable audit trail.
4. **Single-Action Shift Model**: GPS check-in occurs once per job/shift. No continuous background GPS tracking or checkout geofencing is imposed, respecting worker device battery and privacy.
5. **No Paid Dependencies**: Geocoding and reverse geocoding leverage OpenStreetMap / Nominatim with aggressive local fallback caching and zero third-party billing requirements. Maps render via OpenStreetMap tiles in Leaflet.

---

## 2. Database Schema Design

### 2.1 `Attendance` Model (`server/src/models/Attendance.js`)

```javascript
{
  job: { type: ObjectId, ref: 'Job', required: true, index: true },
  worker: { type: ObjectId, ref: 'User', required: true, index: true },
  employer: { type: ObjectId, ref: 'User', required: true, index: true },
  assignment: { type: ObjectId, ref: 'Assignment', index: true },
  status: {
    type: String,
    enum: ['pending', 'present_gps', 'present_manual', 'absent_manual'],
    default: 'pending',
    required: true,
    index: true
  },
  method: {
    type: String,
    enum: ['GPS', 'MANUAL'],
    default: 'MANUAL'
  },
  checkInCoordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] } // [longitude, latitude]
  },
  accuracyMeters: { type: Number },
  distanceMeters: { type: Number },
  checkedInAt: { type: Date },
  markedBy: { type: ObjectId, ref: 'User' },
  reason: { type: String, trim: true },
  auditHistory: [
    {
      previousStatus: { type: String },
      newStatus: { type: String, required: true },
      changedBy: { type: ObjectId, ref: 'User', required: true },
      changedAt: { type: Date, default: Date.now },
      reason: { type: String, required: true },
      action: { type: String, default: 'STATUS_CHANGE' }
    }
  ]
}
```

- **Compound Unique Index**: `{ job: 1, worker: 1 }` prevents race conditions and duplicate attendance documents for the same worker on the same job.

### 2.2 Additions to `Job` Model (`server/src/models/Job.js`)

- `attendanceRadiusMeters`: Number, default `200` (configurable per job, validated positive).
- `coordinatesConfirmed`: Boolean, default `false` (flagged `true` when employer verifies location on the interactive map).

---

## 3. API Endpoints and Documentation

All endpoints are mounted under `/api/attendance` and `/api/location` with JWT authentication and role authorization.

### 3.1 Attendance Endpoints (`/api/attendance`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/api/attendance/check-in` | `WORKER` | Validates device GPS against job venue; marks `present_gps` within 200m. |
| `GET` | `/api/attendance/my-history` | `WORKER` | Retrieves worker's confirmed shifts and attendance status. |
| `GET` | `/api/attendance/job/:jobId/my-status` | `WORKER` | Retrieves worker's attendance record for a specific job. |
| `GET` | `/api/attendance/employer/jobs` | `EMPLOYER` | Retrieves summary of employer's active/past jobs with attendance metrics. |
| `GET` | `/api/attendance/job/:jobId` | `EMPLOYER` | Fetches confirmed worker attendance roster for a specific job with counts. |
| `POST` | `/api/attendance/job/:jobId/worker/:workerId/manual` | `EMPLOYER` | Manually marks worker `present_manual` or `absent_manual` with reason. |
| `PATCH` | `/api/attendance/:attendanceId/correction` | `EMPLOYER` | Explicit correction of an existing attendance status with audit entry. |
| `GET` | `/api/attendance/:attendanceId/audit` | `EMPLOYER` | Returns the complete audit history timeline for an attendance record. |

### 3.2 Geocoding Endpoints (`/api/location`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/location/geocode?q=...` | Authenticated | Proxies Nominatim OpenStreetMap queries with local preset fallbacks. |
| `GET` | `/api/location/reverse?lat=...&lng=...` | Authenticated | Reverse geocodes coordinates to a human-readable display address. |

---

## 4. GPS Geofencing Validation Logic

Worker check-in executes strict multi-point verification:

1. **Assignment Verification**: Confirms that an active, non-cancelled `Assignment` exists linking the worker and the job.
2. **Device Accuracy Filtering**: Checks `accuracyMeters <= 150`. If the device GPS reports an accuracy circle exceeding 150m, check-in is rejected with `GPS_INACCURATE` to prevent spoofing or cell-tower triangulations.
3. **Haversine Distance Computation**:
   $$\Delta\text{lat} = \text{lat}_2 - \text{lat}_1, \quad \Delta\text{lng} = \text{lng}_2 - \text{lng}_1$$
   $$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lng}}{2}\right)$$
   $$c = 2 \cdot \text{atan2}(\sqrt{a}, \sqrt{1-a})$$
   $$d = R \cdot c \quad (R = 6,371,000 \text{ m})$$
4. **Geofence Threshold**: Requires $d \le 200 \text{ meters}$. If $d > 200\text{m}$, returns HTTP 400 with `GEOFENCE_EXCEEDED` alongside the calculated distance and job radius.
5. **Duplicate Prevention**: If an attendance record already exists with status `present_gps` or `present_manual`, rejects duplicate check-ins with HTTP 400 `ALREADY_CHECKED_IN`.
6. **Server Timestamps**: `checkedInAt` is unconditionally stamped with `new Date()` on the server, ignoring device clocks.

---

## 5. Employer Manual Attendance & Explicit Correction Flow

1. **Initial Marking**:
   - Employer selects "Mark Present" or "Mark Absent".
   - Employer must provide a mandatory reason explaining the mark (e.g., "Worker arrived on site without smartphone", "Worker did not show up").
   - System updates record to `present_manual` or `absent_manual` and pushes an entry to `auditHistory`.
2. **Accidental Overwrite Protection**:
   - If an employer attempts to mark a worker whose status is already `present_gps`, the standard manual endpoint rejects the request with HTTP 409 (`REQUIRES_EXPLICIT_CORRECTION`).
3. **Explicit Correction**:
   - To correct a GPS-verified record or modify an existing status, the employer must use the dedicated correction dialog (`PATCH /api/attendance/:attendanceId/correction`).
   - The correction endpoint records `previousStatus`, `newStatus`, `changedBy`, `changedAt`, and the mandatory `reason` in `auditHistory`.
   - The full audit log can be inspected at any time via the "Audit History" modal.

---

## 6. Files Created and Modified

### Backend Files Created
- `server/src/models/Attendance.js`: Attendance Mongoose schema with audit history and compound indexing.
- `server/src/controllers/attendanceController.js`: Full business logic for worker check-in, employer roster views, manual marks, and corrections.
- `server/src/routes/attendanceRoutes.js`: Authenticated Express routes for attendance.
- `server/src/controllers/locationController.js`: Geocoding and reverse geocoding controllers.
- `server/src/routes/locationRoutes.js`: Geocoding route definitions.
- `server/tests/worker_attendance_gps.test.js`: 15 integration tests verifying geofencing, duplicate checks, unselected worker rejection, and overwrite protection.

### Backend Files Modified
- `server/src/config/constants.js`: Added `ATTENDANCE_STATUSES`, `ATTENDANCE_METHODS`, and `ATTENDANCE_RADIUS_METERS`.
- `server/src/models/Job.js`: Added `attendanceRadiusMeters` and `coordinatesConfirmed`.
- `server/src/controllers/jobsController.js`: Persisted attendance configuration during job creation and updates.
- `server/src/routes/index.js`: Mounted `/api/attendance` and `/api/location`.

### Frontend Files Created
- `client/src/components/common/LocationPicker.tsx`: Map-based location picker with search, autocomplete, draggable marker, and 200m geofence circle preview.
- `client/src/pages/employer/EmployerAttendancePage.tsx`: Employer overview of jobs with worker attendance breakdown.
- `client/src/pages/employer/JobAttendanceDetailPage.tsx`: Detailed worker roster with live status badges, manual mark modal, correction modal, and audit history viewer.
- `client/src/pages/worker/WorkerAttendancePage.tsx`: Worker shift attendance dashboard with instant GPS check-in modal.

### Frontend Files Modified
- `client/src/types/index.ts`: Added attendance interfaces, types, and updated `Job`.
- `client/src/App.tsx`: Registered `/employer/attendance`, `/employer/attendance/:jobId`, and `/worker/attendance` routes.
- `client/src/components/layouts/EmployerLayout.tsx`: Added "Worker Attendance" sidebar link.
- `client/src/components/layouts/WorkerLayout.tsx`: Added "Shift Attendance" sidebar link.
- `client/src/components/common/Navbar.tsx`: Added workspace-aware navigation items.
- `client/src/pages/employer/CreateJobPage.tsx`: Integrated interactive `LocationPicker` into Step 2.
- `client/src/pages/worker/WorkerAssignmentsPage.tsx`: Added quick-action link to GPS attendance.
- `client/src/pages/employer/EmployerAssignmentsPage.tsx`: Added quick-action link to job attendance.

---

## 7. Test Execution Results

### 7.1 Backend Attendance Test Suite
```
PASS tests/worker_attendance_gps.test.js
  Worker GPS Attendance & Employer Attendance Management
    POST /api/attendance/check-in (GPS Check-in)
      ✓ should successfully check in within 200 meters (present_gps) (45 ms)
      ✓ should reject check-in if worker is outside 200 meters (22 ms)
      ✓ should reject check-in with poor GPS accuracy (>150m) (16 ms)
      ✓ should reject duplicate check-in if worker is already present (18 ms)
      ✓ should reject check-in if worker has no confirmed assignment for this job (15 ms)
      ✓ should reject check-in if user is an employer (12 ms)
    GET /api/attendance/job/:jobId (Employer Job Attendance View)
      ✓ should list only confirmed workers and include attendance status (24 ms)
      ✓ should prevent unauthorized employer from viewing attendance (15 ms)
    POST /api/attendance/job/:jobId/worker/:workerId/manual (Employer Manual Attendance)
      ✓ should allow employer to manually mark worker present with reason (22 ms)
      ✓ should allow employer to manually mark worker absent with reason (19 ms)
      ✓ should reject manual mark without mandatory reason (14 ms)
      ✓ should block manual overwrite of present_gps without correction intent (21 ms)
    PATCH /api/attendance/:attendanceId/correction (Explicit Correction Flow)
      ✓ should allow employer to explicitly correct attendance with audit entry (25 ms)
      ✓ should reject correction without mandatory reason (14 ms)
    GET /api/attendance/my-history (Worker Shift History)
      ✓ should return worker attendance history for confirmed shifts (20 ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        1.45 s
```

### 7.2 Full Server Test Suite
- **Suites**: 21 passed, 21 total
- **Tests**: 350 passed, 350 total
- **Result**: Zero regressions across auth, matching, assignments, reviews, notifications, payments, and dual-role switching.

### 7.3 Frontend Client Suite & Build
- **Client Tests**: 34 passed, 34 total.
- **Client Build**: `tsc -b && vite build` completed with 0 errors.

---

## 8. Map & Geocoding Configuration

- **Map Tiles**: Rendered via OpenStreetMap standard tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
- **Geocoding & Reverse Geocoding**: Powered by Nominatim (`https://nominatim.openstreetmap.org/`).
  - Strict compliant `User-Agent: WorkMatch-App/1.0` header sent on all requests.
  - Rate-limited to respect OpenStreetMap usage policies.
  - Embedded local preset coordinates for primary hubs (Atigre, Kolhapur, Vijayawada, BKC, etc.) ensuring continuous local offline development capability without network latency.
- **No Paid API Keys**: No Google Maps API keys or third-party paid subscriptions are required.

---

## 9. Honest Assessment of Browser GPS Limitations

While the system provides robust server-side validation, browser-based geolocation has inherent physical limitations:
1. **Device Mock Locations & Spoofing**: Browser `navigator.geolocation` relies on the host OS. Rooted Android devices, developer tools, or specialized browser extensions can mock coordinate data.
   - *Mitigation in WorkMatch*: Server validates accuracy circles (`accuracyMeters <= 150`), enforces employer manual review with audit logs, and requires explicit assignment binding.
2. **Indoor / High-Rise Drift**: Urban canyons or indoor warehouses can degrade GPS accuracy up to 200–500 meters.
   - *Mitigation in WorkMatch*: The employer can immediately utilize the Manual Attendance feature (`present_manual`) with an audited justification ("Worker on site; indoor GPS signal degraded") without interrupting the shift.
3. **HTTPS Requirement**: The Geolocation API is strictly restricted to secure contexts (`https://` or `localhost`). In production environments without valid SSL/TLS certificates, browser GPS calls will be blocked by modern browsers.

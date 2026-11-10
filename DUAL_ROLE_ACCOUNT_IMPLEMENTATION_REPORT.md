# WorkMatch — Permanent Dual-Role Account & Workspace Switching
## Architectural & Implementation Report

**Date:** November 9, 2026  
**Repository:** `santhoshdesu23/workmatch`  
**Author:** WorkMatch Engineering  

---

## 1. Executive Summary

We have completed the architectural design, implementation, and rigorous automated verification of the **Permanent Dual-Role Account and Seamless Workspace Switching** system for WorkMatch.

A single user account can now hold and operate as both a **Worker** and an **Employer** concurrently under a single email address, password, and MongoDB User record. The user can switch active workspaces on the fly without logging out, losing shift applications, active assignments, employer postings, ratings, TrustTrack verification records, or wallet balances.

---

## 2. Architecture & Data Model

### 2.1 User Model (`server/src/models/User.js`)
- **`roles`**: Array of strings (`['worker', 'employer', 'admin']`), defaulting to `[this.role]`.
- **`activeRole`**: String (`'worker' | 'employer' | 'admin'`), representing the user's active workspace session.
- **`role`**: Retained and dynamically synchronized with `activeRole` to maintain 100% backward compatibility with legacy endpoints and third-party consumers.
- **`pre('validate')` & `post('init')` Hooks**: Guarantee that legacy records missing `roles` or `activeRole` are automatically initialized, and any updates to `role` are synchronized atomically.

### 2.2 Independent Profile Records
- Worker profile data lives exclusively in `WorkerProfile` (`user: ObjectId, unique: true`).
- Employer profile data lives exclusively in `EmployerProfile` (`user: ObjectId, unique: true`).
- Neither profile is ever deleted, overwritten, or modified when switching workspaces or activating a second role.

---

## 3. Backend Endpoints & Security

### 3.1 Workspace Activation & Switching Endpoints
1. **`POST /api/auth/enable-employer`**:
   - Validates business name.
   - Atomically adds `'employer'` to `user.roles` via `$addToSet`.
   - Creates or links `EmployerProfile` for the authenticated user (idempotent).
   - Sets `activeRole = 'employer'`.
   - Returns a fresh signed JWT and populated user object.
2. **`POST /api/auth/enable-worker`**:
   - Atomically adds `'worker'` to `user.roles`.
   - Creates or links `WorkerProfile` for the authenticated user (idempotent).
   - Sets `activeRole = 'worker'`.
   - Returns a fresh signed JWT and populated user object.
3. **`PATCH /api/auth/active-role`**:
   - Validates that the requested role is present in `user.roles`.
   - **Security Invariant**: Strictly rejects escalation to `'admin'` unless the account already possesses administrator credentials (`HTTP 403`).
   - Persists `activeRole` and synchronizes legacy `role`.
   - Signs and issues an updated JWT reflecting the new active workspace.

### 3.2 Role-Based Middleware (`server/src/middleware/authMiddleware.js`)
- `requireRole(...roles)` checks the user's set of enabled roles (`user.roles`), `user.role`, and `user.activeRole`.
- Dual-role users can access both worker endpoints (e.g. `/api/workers/me`) and employer endpoints (e.g. `/api/employers/me`) regardless of their current active workspace.

### 3.3 Dynamic Controller Contexts
- `getMyApplications` (`applicationsController.js`): Uses `req.query.role || req.user.activeRole || req.user.role` to return worker applications or employer applicants.
- `getMyAssignments` (`assignmentsController.js`): Uses active workspace to return worker shifts or employer contractor assignments.
- `getMyPayments` (`paymentsController.js`): Uses active workspace to display earned worker payouts or employer outgoing wage transfers.
- `getJobs` & `getJobRecommendations`: Checks `user.roles.includes('worker')` to load `WorkerProfile` and compute AI match scores even when browsing across workspaces.

---

## 4. Frontend Workspace Switching & UX

### 4.1 Type System & Context (`client/src/types/index.ts`, `AuthContext.tsx`)
- Updated `User` interface to declare `roles?: Role[]`, `activeRole?: Role`, `workerProfile?: WorkerProfile | null`, and `employerProfile?: EmployerProfile | null`.
- Extended `AuthContext` with:
  - `switchRole(role: Role): Promise<User>`
  - `enableEmployer(data): Promise<User>`
  - `enableWorker(data): Promise<User>`
- Automatically synchronizes local storage tokens upon role transition.

### 4.2 Top Navigation Switcher (`client/src/components/common/Navbar.tsx`)
- **Quick Toggle Segmented Pill**: Desktop navbar renders an instant `[Worker] | [Employer]` segmented toggle for dual-role users.
- **User Dropdown Switcher**: Includes an explicit "SWITCH WORKSPACE" card with checkmarks indicating the active workspace.
- **Mobile Drawer Quick Toggle**: Mobile drawer provides one-touch switching between "Worker Hub" and "Employer Hub".
- **Dynamic CTAs**: Single-role workers see a subtle "+ Hire Workers" / "Become an Employer" CTA; single-role employers see "+ Find Work" / "Activate Worker Role".

### 4.3 Protected Route Authorization (`client/src/components/layouts/ProtectedRoute.tsx`)
- Inspects `user.roles` instead of strictly checking single `user.role`.
- Allows dual-role users immediate seamless navigation between `/worker/*` and `/employer/*` routes without false authorization redirects.

### 4.4 Profile Onboarding Cards
- **`WorkerProfilePage.tsx`**: Features a dedicated "Workspaces & Roles" section before account settings. If employer role is not active, offers an expandable onboarding form (Business Name, Category, Address) to activate it instantly.
- **`EmployerProfilePage.tsx`**: Features a dedicated "Workspaces & Roles" section allowing one-click activation of worker capability.

---

## 5. Verification & Test Coverage

### 5.1 Automated Regression Test Suite (`server/tests/dual_role_workspace.test.js`)
10 targeted vitest tests verifying:
- Worker enabling employer workspace with business details.
- Business name validation and sanitization.
- Idempotency on repeated activation calls.
- Employer enabling worker workspace.
- Seamless bidirectional workspace switching (`activeRole`).
- Rejection of roles not enabled on the user account (`HTTP 400/403`).
- Security invariant preventing privilege escalation to `'admin'` (`HTTP 403`).
- Dual-role route access under `requireRole` middleware.
- Backward compatibility with legacy database records.
- Login payload returning `roles`, `activeRole`, and populated profiles.

### 5.2 Overall Test & Quality Results
| Test Suite / Tool | Command | Result |
| :--- | :--- | :--- |
| **Server Vitest Suite** | `npm --prefix server test` | **20 passed (20 test files), 335 passed (335 tests), 0 failed** |
| **Client Test Suite** | `npm --prefix client test` | **9 suites passed, 34 passed (34 tests), 0 failed** |
| **Client Linter** | `npm --prefix client run lint` | **0 errors (43 warnings for standard hook dependencies, 0 blockers)** |
| **Client Production Build** | `npm --prefix client run build` | **`tsc -b && vite build` succeeded in 6.15s with 0 errors** |

---

## 6. Conclusion

Dual-role account capabilities and workspace switching are fully implemented, verified, and backward-compatible. Users can seamlessly engage as both shift-seekers and employers from one unified login.


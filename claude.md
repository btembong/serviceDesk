# UBFinance ServiceDesk — Master Specification

---

## Product Name
UBFinance ServiceDesk
A secure, intelligent ticketing hub for banking support.

---

## Overview
UBFinance ServiceDesk is a multi-channel ticketing platform designed for banking institutions.
It handles account verification, customer enquiries, PIN resets, card services, and more with camera-enabled KYC and full compliance logging.

---

## User Roles

- **Customer** — submits tickets, uploads KYC documents, tracks ticket status
- **Agent** — reviews and actions tickets, approves/rejects/escalates
- **Admin** — full system oversight, analytics, user management, configuration
- **System** — automated actions (OTP expiry, SLA timers, audit logging)

Admin bootstrap: the first admin account is created via a one-time CLI seed script (`npm run seed:admin`) that runs at initial deployment. Subsequent admin accounts are created only by existing admins from the admin dashboard.

---

## Ticket Categories & Services

### 1. Account Verification & KYC
- Account number + account name validation
- ID card upload (OCR + fraud detection)
- Live selfie capture with liveness detection (blink prompt)
- Telephone (old/new) verification
- Email (old/new) verification
- Supporting documents (utility bill, proof of residence)
- Audit trail + compliance logging

### 2. PIN & Credential Reset
- PIN reset (with KYC + OTP)
- Mobile/email reset (old vs new contact validation)
- Multi-factor authentication enforcement
- Platform password reset via email link (token expires in 15 minutes)

### 3. Transaction Issues
- Failed transfers / duplicate debits
- Unauthorized transactions (fraud alerts — auto-flagged urgent)
- Reversal requests

### 4. Card Services
- Lost/stolen card replacement
- Card activation/deactivation
- Card limit adjustments
- Transaction disputes

### 5. Loan & Credit
- Loan application enquiries
- Repayment issues
- Credit score disputes

### 6. Digital Banking
- Mobile app login issues
- Internet banking password reset
- Device re-registration (new phone setup)

### 7. Customer Information Updates
- Change of address
- Change of phone/email
- Update next-of-kin details

### 8. Complaints & Feedback
- Service dissatisfaction
- Branch experience feedback
- Suggestions for improvement

---

## Architecture

- **Frontend:** Next.js 14 (App Router), Tailwind CSS — responsive, mobile-first
- **Components:** shadcn/ui (Radix UI + Tailwind, components owned in codebase)
- **Icons:** Lucide React
- **Backend:** Node.js + Express 4.x — REST API
- **ORM:** Prisma
- **Database:** Neon (serverless PostgreSQL) — tickets, users, audit logs
- **Cache:** Upstash Redis (serverless) — OTP codes, session tokens, rate limit counters
- **Auth:** JWT (access token 15min, refresh token 7 days) + role-based middleware
- **Storage:** Local encrypted volume (AES-256); swappable for S3-compatible store
- **Email:** Resend API + React Email templates
- **SMS:** Twilio (optional — falls back to email-only if key not set)
- **AI Services:**
  - Face recognition — AWS Rekognition (mocked for dev, production-ready interface)
  - OCR — Tesseract.js (local) with Google Vision as production upgrade
- **Deployment:** Vercel (frontend) + Render (backend)

---

## API Route Structure

### Auth
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- POST /auth/refresh-token
- POST /auth/forgot-password
- POST /auth/reset-password

### Tickets
- POST   /tickets/create
- GET    /tickets/:id
- PATCH  /tickets/:id
- GET    /tickets/user/:id
- GET    /tickets/admin
- POST   /tickets/:id/reopen
- POST   /tickets/:id/merge

### KYC
- POST /kyc/upload-selfie
- POST /kyc/upload-id
- POST /kyc/verify

### PIN
- POST /pin/reset

### Notifications
- GET   /notifications/:userId
- PATCH /notifications/:id/read

---

## Database Tables

| Table | Purpose |
|---|---|
| users | Customers, agents, admins with roles and login state |
| tickets | Every support ticket with status, priority, category |
| ticket_comments | Agent/customer notes on a ticket |
| kyc_records | ID upload path, selfie path, OCR result, face match score |
| otp_codes | Temporary OTP codes linked to user + action, expire in 5 min |
| audit_logs | Immutable record of every action: who, what, when |
| notifications | In-app alerts per user with read/unread state |
| password_reset_tokens | One-time tokens for platform password recovery, expire 15 min |

---

## Security & Compliance

### Authentication
- JWT access tokens expire in 15 minutes; refresh tokens expire in 7 days
- Account locks after 5 consecutive failed login attempts; unlocks after 30 minutes or by admin
- All passwords hashed with bcrypt (salt rounds: 12)
- Platform password reset via email link (expires 15 minutes, single use)

### KYC Security
- Liveness detection enforced on selfie capture (user prompted to blink)
- Accepted ID types: National ID, Passport, Driver’s License — customer selects type before upload
- ID expiry date extracted by OCR and validated — expired documents rejected automatically
- If AI confidence score is below 80%, ticket is flagged for mandatory manual agent review
- File uploads: accepted types jpg/png/pdf only, max size 5MB, virus scan before storage
- KYC images auto-deleted from storage 24 hours after verification decision is recorded

### Rate Limiting
- Login attempts: max 5 per 15 minutes per IP
- Ticket creation: max 10 tickets per customer per day
- KYC upload: max 3 attempts per ticket
- OTP requests: max 3 per 10 minutes per user

### Input & Data Security
- All free-text fields sanitized (DOMPurify on frontend, express-validator on backend)
- Parameterized queries only via Prisma (no raw SQL with user input)
- File type validated by magic bytes, not just file extension
- TLS enforced in transit, AES-256 at rest

### GDPR Compliance
- Consent checkbox required at registration — stored with timestamp and IP
- Customers can request full data export from their dashboard
- Customers can request account deletion — soft delete with 30-day retention then purge
- KYC images deleted 24 hours after verification
- Closed tickets retained for 7 years (banking regulatory requirement) then auto-purged
- No card numbers ever stored by this platform (PCI DSS scope is minimal)

### Audit Logging
- Every action logged: ticket create/update/close, KYC upload/verify, login/logout, admin actions
- Audit logs are append-only — no update or delete routes exist for audit_logs table
- Logs include: user_id, action, entity_type, entity_id, ip_address, timestamp

---

## Ticket Workflow Rules

### Assignment
- On creation, tickets are placed in an unassigned queue
- Agents manually claim tickets from the queue (pull model)
- Admins can force-assign any ticket to any agent

### Priority
- Default priority: Normal
- Auto-escalated to Urgent: unauthorized transactions, fraud reports, PIN reset failures
- Agents can manually raise priority to High or Urgent with a required reason note

### SLA Timers
- Urgent tickets: first agent response within 1 hour
- Normal tickets: first agent response within 24 hours
- If SLA is breached, ticket auto-escalates and admin is notified

### Status Lifecycle
```
Open → In Review → Resolved
             ↓
         Escalated → In Review → Resolved
             ↓
          Rejected
```
- Customers can reopen a Resolved ticket once within 7 days of resolution
- Reopened ticket re-enters In Review with original ticket history preserved
- Agents can merge duplicate tickets — one becomes primary, other links to it

### Out of Hours
- If no agents are online, ticket is accepted and customer receives auto-response:
  “Your ticket has been received. Our agents are currently offline. You will be contacted within the next business day.”

---

## KYC Verification Flow

```
Customer selects ID type (National ID / Passport / Driver’s License)
        ↓
Customer uploads ID card image
        ↓
OCR extracts: name, DOB, ID number, expiry date
        ↓
Expiry date checked → if expired, reject with message
        ↓
Customer prompted to blink (liveness check)
        ↓
Customer captures selfie
        ↓
Face match: selfie vs ID photo
        ↓
Confidence >= 80% → Auto-verified
Confidence 60-79% → Flagged for manual agent review
Confidence < 60%  → Auto-rejected, customer can retry (max 3 attempts)
```

---

## Notification Rules

- Ticket created → email + SMS to customer
- Ticket status change → email + SMS to customer
- SLA breach → email to admin + assigned agent
- KYC result → email to customer
- If SMS fails → fallback to email only, log the failure
- Customers can set notification preference: both / email only / SMS only

---

## UX Flow

1. Customer logs in (or registers with GDPR consent)
2. Dashboard — open tickets, create new ticket button, notification bell
3. Select ticket category → fill required fields
4. KYC step (if required by category): select ID type → upload ID → blink → selfie
5. Submit → “Your ticket is being reviewed”
6. Agent reviews → approves / rejects / escalates
7. Customer notified via email/SMS
8. Customer can track status in real time from dashboard
9. On resolution, customer can re-open once within 7 days if unsatisfied

---

## Extra Features

- AI-powered FAQ assistant (deflect common questions before ticket creation)
- Priority routing (fraud/PIN reset auto-flagged urgent)
- Analytics dashboard (ticket trends, resolution times, category breakdown)
- Gamified agent performance (badges for fast resolutions, leaderboard)
- Draft saving — ticket form progress saved locally so interruptions don’t lose data

---

## Build Order

```
Phase 1 — Foundation
  - PostgreSQL schema via Prisma
  - Express server setup
  - Auth: register, login, JWT, refresh, password reset

Phase 2 — Core Ticket System
  - Ticket CRUD API
  - Role-based middleware
  - Audit logging middleware

Phase 3 — KYC Pipeline
  - File upload API (Multer + validation)
  - OCR integration (Tesseract.js)
  - Face match integration (mocked, production-ready interface)
  - Liveness detection prompt

Phase 4 — Frontend
  - Next.js setup + Tailwind
  - Auth pages (login, register, forgot password)
  - Customer dashboard + ticket creation wizard
  - KYC flow (camera capture + upload)
  - Ticket status tracker

Phase 5 — Agent & Admin
  - Agent dashboard (queue, claim, action)
  - Admin dashboard (analytics, user management)
  - SLA timer enforcement

Phase 6 — Notifications & Polish
  - Email (Nodemailer) + SMS (Twilio) integration
  - Notification preferences
  - FAQ assistant (basic keyword matching)
  - Draft saving
```

---

## Out of Scope (Phase 1)
- Real bank core system integration (account number validation is simulated)
- Real AWS Rekognition calls (mocked with correct interface for easy swap)
- Production cloud deployment configs (provided but not executed)
- Multi-language / i18n support (English only for now)
- Full accessibility audit (basic semantic HTML, ARIA labels where obvious)

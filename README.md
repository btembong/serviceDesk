# UBFinance ServiceDesk

A secure, intelligent ticketing platform for banking support.

---

## Project Structure

```
servicedesk/
├── backend/      Express API (Node.js + Prisma + Neon PostgreSQL)
└── frontend/     Next.js 14 App Router (Tailwind + shadcn/ui)
```

---

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in .env with your Neon DATABASE_URL, JWT secrets, Resend key, etc.

npm install
npx prisma db push       # push schema to Neon
npm run db:seed          # create admin, agent, demo customer
npm run dev              # runs on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Set NEXT_PUBLIC_API_URL=http://localhost:5000

npm install
npm run dev              # runs on http://localhost:3000
```

---

## Seed Accounts

| Role     | Email                  | Password       |
|----------|------------------------|----------------|
| Admin    | admin@ubfinance.com    | Admin@123!     |
| Agent    | agent@ubfinance.com    | Agent@123!     |
| Customer | customer@demo.com      | Customer@123!  |

---

## Key Features

- JWT auth with refresh tokens, account lockout, GDPR consent
- 8 ticket categories with SLA timers and priority routing
- KYC pipeline: ID upload → OCR → liveness detection → face match
- Agent queue with claim, resolve, escalate, reject, merge
- Admin dashboard with analytics charts (Recharts)
- Email notifications via Resend
- Audit log on every state-changing action
- Neon PostgreSQL + Upstash Redis

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | Next.js 14, Tailwind, shadcn/ui   |
| Icons      | Lucide React                      |
| Backend    | Node.js, Express 4, Prisma        |
| Database   | Neon (PostgreSQL)                 |
| Cache      | Upstash Redis                     |
| Email      | Resend                            |
| SMS        | Twilio (optional)                 |
| OCR        | Tesseract.js                      |
| Face Match | Mocked (AWS Rekognition interface)|
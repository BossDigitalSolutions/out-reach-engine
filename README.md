# OutreachEngine

A full-stack lead scraping and automated email outreach platform for selling website design services.

## Features

- **Lead Scraper** — Search businesses by industry & location using Google Places API
- **AI Email Generator** — Generate personalized cold emails using Claude (Anthropic)
- **Email Scheduling** — Schedule campaigns with daily send limits and warm-up mode
- **CRM Pipeline** — Track leads through stages (New → Contacted → Converted)
- **Demo Link Manager** — Match industry-specific demo sites to leads automatically
- **Email Templates** — Save industry templates to guide AI generation
- **Analytics Dashboard** — Track open rates, reply rates, conversions

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **APIs**: Google Places, Anthropic Claude, SendGrid

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or a hosted service like Supabase, Railway, Neon)

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret for JWT tokens (generate with `openssl rand -hex 64`) |
| `GOOGLE_PLACES_API_KEY` | Google Places API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `SENDGRID_API_KEY` | SendGrid API key |
| `SERVER_URL` | Your server's public URL (for unsubscribe links) |

> **Note**: API keys can also be configured per-user in the Settings page of the app.

### 3. Set Up Database

```bash
cd server

# Push schema to database
npm run db:push

# Or run migrations (recommended for production)
npm run db:migrate
```

### 4. Run the App

**Development** (run both in separate terminals):

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and create your account.

### 5. SendGrid Webhook (optional, for email tracking)

To track opens, clicks, and bounces, configure SendGrid's Event Webhook:

1. Go to SendGrid → Settings → Mail Settings → Event Webhook
2. Set the HTTP POST URL to: `https://yourdomain.com/api/emails/webhook`
3. Select: Opens, Clicks, Bounces, Dropped

## Usage

### Quick Start

1. **Add API Keys** — Go to Settings and add your Google Places, Anthropic, and SendGrid keys
2. **Add Demo Links** — Go to Demo Links and add demo websites tagged by industry
3. **Scrape Leads** — Go to Scraper, search by industry + location, select leads, and save them
4. **Add Emails** — Go to Leads, click on a lead without an email, and add their email manually
5. **Generate Emails** — Select leads in the Leads table → Generate Emails
6. **Review & Schedule** — Preview the generated emails, edit if needed, then schedule them

### Email Address Note

Google Places API does not return email addresses. After scraping, you'll need to:
- Visit the business website to find their contact email
- Use a tool like Hunter.io to find emails
- Add emails manually via the lead edit dialog

### Warm-up Mode

Enable warm-up mode in Settings to gradually increase send volume:
- Day 1: 2 emails
- Day 2: 4 emails
- Day 3: 6 emails
- Continues doubling until it reaches your daily limit

This helps build your sender reputation and avoid spam filters when starting a new sending domain.

## Production Deployment

### Environment Variables

Make sure to set in production:
- `NODE_ENV=production`
- `JWT_SECRET` — Use a strong random value
- `SERVER_URL` — Your actual domain (e.g., `https://outreachengine.yourdomain.com`)
- `CLIENT_URL` — Your frontend URL

### Build

```bash
# Build server
cd server
npm run build

# Build client
cd ../client
npm run build
```

The client build outputs to `client/dist/`. Serve it with a static file server or CDN.

## Project Structure

```
OutreachEngine/
├── server/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── src/
│       ├── index.ts           # Express app entry
│       ├── middleware/
│       │   └── auth.ts        # JWT authentication
│       ├── routes/
│       │   ├── auth.ts        # Login/register
│       │   ├── leads.ts       # Lead CRUD
│       │   ├── scraper.ts     # Google Places scraping
│       │   ├── emails.ts      # Email generation & sending
│       │   ├── templates.ts   # Email templates
│       │   ├── demos.ts       # Demo links
│       │   ├── analytics.ts   # Analytics data
│       │   └── settings.ts    # User settings
│       └── services/
│           ├── googlePlaces.ts # Google Places API
│           ├── claude.ts       # Anthropic Claude API
│           ├── sendgrid.ts     # SendGrid email sending
│           └── scheduler.ts    # Email send scheduler
├── client/
│   └── src/
│       ├── pages/             # Page components
│       ├── components/        # Shared components
│       ├── contexts/          # React contexts
│       └── lib/               # API client & utilities
└── .env.example
```

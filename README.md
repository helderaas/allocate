# Allocate

Automated expense allocation for multi-division QuickBooks Online companies.

## Stack
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Postgres database + auth)
- **Vercel** (hosting)
- **Intuit QBO API** (OAuth 2.0)

## Local development

### 1. Clone and install
```bash
git clone https://github.com/helderaas/allocate.git
cd allocate
npm install
```

### 2. Environment variables
```bash
cp .env.local.example .env.local
```
Fill in your values from:
- Intuit Developer Dashboard → your app → Keys & OAuth
- Supabase project → Settings → API

### 3. Database
Run the migration in `supabase/migrations/001_initial_schema.sql`
against your Supabase project via the SQL editor.

### 4. Run locally
```bash
npm run dev
```
Open http://localhost:3000

## Deployment
Push to GitHub → Vercel auto-deploys.
Add environment variables in Vercel project settings.

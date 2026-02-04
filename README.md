# ADIMAGENDO Participant App

Web app for ADIMAGENDO study participants: checklists, symptom diary, surveys, documents, and study updates.

## Stack

- **Next.js 16** (App Router, React 19)
- **TypeScript**
- **Tailwind CSS**
- **Prisma 6** + SQLite (prototype; can switch to PostgreSQL for production)
- **NextAuth v5** (credentials)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd adimagendo
npm install
```

### 2. Environment variables

Copy the example env and set values:

```bash
cp .env.example .env
```

The example `.env` uses **SQLite** (`DATABASE_URL="file:./dev.db"`), so no database server is needed. Required:

- **DATABASE_URL** – Default `file:./dev.db` (SQLite; file is created in `prisma/` on first `db push`).
- **AUTH_SECRET** – Random string for session encryption, e.g. `openssl rand -base64 32`.
- **AUTH_URL** – App URL, e.g. `http://localhost:3000` (dev) or your Vercel URL (prod).

Optional (for later):

- **EMAIL_*** – For notifications and contact form
- **GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET** – For “Add to Google Calendar”

### 3. Database

With `DATABASE_URL` in `.env` (default SQLite):

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

This creates `prisma/dev.db` and seeds checklist/survey templates.

- `db push` – Pushes the schema to the DB (no migrations).
- `db:seed` – Inserts checklist and survey templates.

For migrations instead of push:

```bash
npx prisma migrate dev --name init
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register a new account, then sign in to use the dashboard.

## Deploy to Railway (SQLite – lightweight prototype)

Railway runs your app in a container with a persistent volume, so you can keep using SQLite.

1. **Push the repo to GitHub** (if you haven’t already).

2. **Create a Railway project**
   - Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
   - **New Project** → **Deploy from GitHub repo** → select `adimagendo`.

3. **Add a volume** (so the SQLite file persists across deploys)
   - In your Railway project, click **+ New** → **Volume**.
   - Mount path: `/data`.
   - Attach the volume to your service (the app).

4. **Set environment variables** (in the service → **Variables**)
   - **DATABASE_URL** = `file:/data/dev.db` (so the DB lives on the volume).
   - **AUTH_SECRET** = run `openssl rand -base64 32` and paste the result.
   - **AUTH_URL** = your app URL, e.g. `https://adimagendo-production-xxxx.up.railway.app` (you can copy this from Railway after the first deploy and then update the variable).

5. **Deploy**
   - Railway will run `npm install`, `prisma generate`, `next build`, then on start `prisma db push` and `next start`. The schema is applied automatically on each start.

6. **Seed the database once** (checklist and survey templates)
   - Install the [Railway CLI](https://docs.railway.app/develop/cli) and run:
     ```bash
     railway link
     railway run npm run db:seed
     ```
   - Or in the Railway dashboard: your service → **Settings** → run a one-off command: `npm run db:seed`.

7. **Share the app**
   - Use the **Generate Domain** button (or the URL Railway gives you) and share that link so others can try the prototype.

---

## Deploy to Vercel (PostgreSQL or Turso)

1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com), import the GitHub repo.
3. Add environment variables:
   - **DATABASE_URL** – Use a hosted database (e.g. Neon, Supabase for PostgreSQL; or Turso for SQLite-compatible). SQLite files do not work on Vercel serverless.
   - **AUTH_SECRET** – Generate with `openssl rand -base64 32`.
   - **AUTH_URL** – Your Vercel app URL, e.g. `https://adimagendo.vercel.app`.
4. Deploy. After the first deploy, run `npx prisma db push` and `npm run db:seed` against the production `DATABASE_URL`.

## Scripts

| Script        | Description              |
|---------------|--------------------------|
| `npm run dev` | Start dev server         |
| `npm run build` | Production build      |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB    |
| `npm run db:seed` | Seed checklist/survey templates |

## Features (current)

- **Auth** – Register, login (credentials), sign out.
- **Dashboard** – Progress, upcoming appointments, quick actions, recent symptoms.
- **Checklist** – Study requirements with due dates and links (e.g. book scan).
- **Placeholder pages** – Symptoms, absences, surveys, documents, contact, news (structure only; to be implemented).

## Roadmap

- Symptom diary (calendar + daily log)
- Absence tracking
- QoL survey flow (3/6/9/12 months)
- Document upload (report cards) and referral inbox
- Notifications (email + in-app)
- Google Calendar “Add to calendar”
- Contact form and news CMS

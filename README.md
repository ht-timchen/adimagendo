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

Optional:

- **EMAIL_DELIVERY_MODE** – Staff invite/reset: `manual` (temporary password in admin UI) or `smtp` (email when SMTP is configured). If unset: SMTP vars present ⇒ email; otherwise ⇒ manual. **Railway pilot:** use `manual`.
- **EMAIL_SERVER_*** – SMTP settings; only used when `EMAIL_DELIVERY_MODE=smtp`
- **GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET** – For “Add to Google Calendar”

### 3. Database

With `DATABASE_URL` in `.env` (default SQLite):

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

This creates `prisma/dev.db` and seeds checklist/survey templates. It does **not** create an admin account unless you ask for one (see [Admin accounts](#admin-accounts)).

- `db push` – Pushes the schema to the DB (no migrations).
- `db:seed` – Inserts checklist and survey templates. Run it only on a fresh, empty database: it overwrites existing templates.

For migrations instead of push:

```bash
npx prisma migrate dev --name init
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register a new account, or create the local admin (see [Admin accounts](#admin-accounts)), then sign in to use the dashboard.

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
   - Railway will run `npm install`, `prisma generate`, `next build`, then on start `prisma migrate deploy` (via `prestart`) and `next start`. Migrations are applied automatically on each start.

6. **First-time setup of a new, empty database only**
   - Seed the checklist and survey templates once and create the first super admin. See [Admin accounts](#admin-accounts) for the exact steps.
   - **Never run `npm run db:seed` on an environment that already has data** (staging or production): it overwrites templates.

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
4. Deploy. After the first deploy, apply the schema with `npx prisma db push`. Seed templates and create the first admin only on a fresh database; see [Admin accounts](#admin-accounts).

## Admin accounts

The repository contains no usable admin password. Never commit one, and never put one in a README, chat or ticket.

**Local development.** Create the local admin (`admin@adimagendo.local`) explicitly:

```bash
SEED_DEV_ADMIN=1 SEED_DEV_ADMIN_PASSWORD='choose-a-local-password' npm run db:seed
```

Without `SEED_DEV_ADMIN=1` the seed never touches the admin account. If the account already exists the seed leaves it unchanged, so it can never reset a password. If you omit `SEED_DEV_ADMIN_PASSWORD`, a random password is generated and printed once.

**Staging / production.**
1. First super admin on a **new, empty** database: run the seed once with `SEED_DEV_ADMIN=1` and a strong `SEED_DEV_ADMIN_PASSWORD` (16+ characters from a password manager). Enter it with `read -rs` so it stays out of shell history, and do not store it as a permanent variable.
2. Create further staff from **People → Add person** (invite flow). Give each person a named account; do not share logins.
3. Keep at least two super admins so one forgotten password does not lock everyone out. A super admin can reset another's password from the People page.

**Changing or recovering the `admin@adimagendo.local` password** (works against an existing database, safe to repeat):

```bash
read -rs NEW_ADMIN_PASSWORD && export NEW_ADMIN_PASSWORD
npm run admin:set-password; unset NEW_ADMIN_PASSWORD
```

The password must be at least 16 characters and must not contain the old default. On Railway, run this inside `railway ssh`. The command only changes the password hash; it does not create accounts.

## Scripts

| Script        | Description              |
|---------------|--------------------------|
| `npm run dev` | Start dev server         |
| `npm run build` | Production build      |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB    |
| `npm run db:seed` | Seed checklist/survey templates (fresh database only) |
| `npm run admin:set-password` | Set the `admin@adimagendo.local` password from `NEW_ADMIN_PASSWORD` |

## Features (current)

- **Auth** – Register, login (credentials), sign out.
- **Dashboard** – Progress, upcoming appointments, quick actions, recent symptoms.
- **Checklist** – Study requirements with due dates and links (e.g. book scan).
- **Placeholder pages** – Symptoms, diary, surveys, documents, contact, news (structure only; to be implemented).

## Roadmap

- Symptom diary (calendar + daily log)
- Diary (absence / hospital admission tracking)
- QoL survey flow (3/6/9/12 months)
- Document upload (report cards) and referral inbox
- Notifications (email + in-app)
- Google Calendar “Add to calendar”
- Contact form and news CMS

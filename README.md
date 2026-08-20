<p align="center">
  <h1 align="center">Open Health</h1>
  <p align="center">
    Your Open-Source Health AI Agent — mobile-first, personal, and truly yours.
    <br />
    <a href="https://openhealth.blog">Live Demo</a> · <a href="https://openhealth.blog">Website</a> · <a href="#self-hosting">Self-Host Guide</a>
  </p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <a href="https://github.com/truenorth-lj/openhealth/stargazers"><img src="https://img.shields.io/github/stars/truenorth-lj/openhealth" alt="GitHub Stars" /></a>
</p>

The first open-source, mobile-first personal health AI agent. It understands your nutrition, sleep, fitness, and weight — and becomes the health companion that knows you best.

## Screenshots

<p align="center">
  <img src="apps/web/public/screenshots/en/01-hub.png" alt="Health Hub" width="180" />
  <img src="apps/web/public/screenshots/en/02-today.png" alt="Today View" width="180" />
  <img src="apps/web/public/screenshots/en/03-ai-chat.png" alt="AI Nutrition Chat" width="180" />
  <img src="apps/web/public/screenshots/en/04-food-search.png" alt="Food Search" width="180" />
</p>
<p align="center">
  <img src="apps/web/public/screenshots/en/06-food-detail.png" alt="Food Detail" width="180" />
  <img src="apps/web/public/screenshots/en/08-ai-estimate.png" alt="AI Meal Estimate" width="180" />
  <img src="apps/web/public/screenshots/en/09-progress.png" alt="Progress Charts" width="180" />
  <img src="apps/web/public/screenshots/en/10-water.png" alt="Water Tracking" width="180" />
</p>

## Features

### AI Agent
- **AI Nutrition Chat** — personalized nutrition advice based on your diary, the agent that knows you best
- **AI Meal Estimate** — describe a meal, AI estimates calories & macros
- **Nutrition Label Scanner** — take a photo, AI extracts nutrition data

### Comprehensive Tracking
- **Food Diary** — log meals with automatic calorie & macro calculation
- **Food Database** — search common foods, create custom foods, save favorites
- **Water Intake** — daily water tracking with goals and history
- **Weight Tracking** — daily weight log with trend analysis
- **Sleep Tracking** — bedtime, wake time, and sleep quality
- **Intermittent Fasting** — timer with fasting history
- **Exercise** — cardio & strength training log

### Platform
- **Progress Dashboard** — visualize calories, nutrients, and weight trends
- **Dark Mode** — light and dark theme support
- **PWA** — install to home screen with push notifications
- **English-only UI** — focused, consistent product language
- **Google / Apple OAuth** — social login support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router), TypeScript, React 19 |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| Database | Supabase PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/) |
| API | [tRPC v11](https://trpc.io/) (reads) + Server Actions (writes) |
| Auth | [Supabase Auth](https://supabase.com/auth) (email/password + OAuth) |
| AI | Google Gemini 3 Flash (OCR, chat, agent) |
| Payments | Stripe |
| Monorepo | [Turborepo](https://turbo.build/) + pnpm workspaces |

## Project Structure

```
openhealth/
├── apps/web/              # Next.js web app
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   ├── server/        # tRPC routers, Server Actions, DB
│   │   └── lib/           # Utilities, auth, tRPC client
│   └── public/            # Static assets
├── packages/
│   ├── shared/            # Shared types, Zod schemas, i18n, utils
│   └── db/                # Drizzle schema, migrations
├── Dockerfile
├── docker-compose.yml     # One-click self-hosting
└── turbo.json
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- Supabase project, or PostgreSQL 16+ for legacy local-only development

### Local Development

```bash
# Clone the repo
git clone https://github.com/truenorth-lj/openhealth.git
cd openhealth

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local with your Supabase URL, anon key, and DATABASE_URL

# Start the dev server
pnpm dev:web
# Open http://localhost:3001
```

### Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run [`supabase/migrations/0001_swastha_foundation.sql`](supabase/migrations/0001_swastha_foundation.sql).
3. In Supabase Auth, enable Email sign-in. Enable Google/Apple providers if needed.
4. Add OAuth redirect URLs:

```text
http://localhost:3001/auth/callback
https://your-production-domain.com/auth/callback
```

5. Set these values in `apps/web/.env.local`:

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3001
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in browser code.

### Self-Hosting

The fastest way to run Open Health is with Docker:

```bash
git clone https://github.com/truenorth-lj/openhealth.git
cd openhealth

# Start PostgreSQL + web app
docker compose up -d

# Open http://localhost:3000
```

That's it. The database migrations run automatically on startup.

#### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase browser anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase server service role key |
| `GOOGLE_AI_API_KEY` | No | Enables AI features (Gemini) |
| `STRIPE_SECRET_KEY` | No | Enables payment / Pro plan |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Enables push notifications |

See [`.env.example`](.env.example) for the full list.

## Roadmap

- [ ] Proactive health insights & weekly AI reports
- [ ] Barcode scanning for packaged foods
- [ ] Apple Health / Google Fit sync
- [ ] Region-specific food databases beyond Nepal

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Run tests
pnpm test

# Run linter
pnpm lint

# Build
pnpm build
```

## License

[MIT](LICENSE)

---

Open-source Health AI Agent, adapted for Supabase and Nepal-focused wellness workflows.

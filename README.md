# ElbrusWay AI

MVP foundation for **ElbrusWay AI** — a Russian-focused AI model aggregation platform integrated with RouterAI.

## Stack
- Next.js 14 + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Redis
- NextAuth
- Platega

## Project status
This repository currently contains the initial technical foundation:
1. Environment variable template
2. Prisma data model for users, chat, billing, plans, and admin model config
3. High-level API route map, Platega payment contract, and development phases
4. Docker Compose baseline for app + postgres + redis + nginx
5. Domain-ready nginx config for `elbrusway.ru`

## Quick start
1. Copy env file:
   ```bash
   cp .env.example .env
   ```
2. Start services:
   ```bash
   docker compose up -d
   ```
3. Run migrations after app scaffold is added:
   ```bash
   npx prisma migrate dev
   ```

## Core flows
- Registration gives FREE plan + starter tokens.
- `/api/chat` sends prompts to RouterAI and logs token usage.
- Token balance is debited by `prompt_tokens + completion_tokens`.
- Low balance warning threshold is enforced.
- Payments are created via Platega and confirmed through callback/webhook before granting plan/tokens.

## Next milestones
- Build Next.js App Router structure (`/`, `/chat`, `/rates`, `/profile`, `/auth`, `/admin`)
- Implement NextAuth (credentials + OAuth Yandex/VK)
- Add RouterAI streaming proxy and usage logging
- Add billing UI and Platega payment flow
- Add admin panel analytics + model controls

## Domain
- Primary production domain: `https://elbrusway.ru`
- Billing callback URL: `https://elbrusway.ru/api/payments/webhook`
- Detailed DNS and SSL steps: `docs/DEPLOYMENT.md`

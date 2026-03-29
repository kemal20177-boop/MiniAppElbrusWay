# ElbrusWay AI — Architecture v1.0

## System overview
- **Frontend (Next.js)**: landing, chat, rates, profile, auth, admin
- **Backend API**: auth, chat, billing, models, admin
- **Data stores**:
  - PostgreSQL for users/chats/messages/payments
  - Redis for rate limit/session cache/model cache
- **External providers**:
  - RouterAI (`https://routerai.ru/api/v1`)
  - YooKassa for payment processing

## Main request lifecycle
1. User sends message from `/chat`.
2. Backend middleware verifies auth, plan status, token balance, and rate limit.
3. Backend proxies request to RouterAI streaming endpoint.
4. Stream is passed to client via SSE.
5. Usage (`prompt_tokens`, `completion_tokens`) is persisted in `Message`.
6. User token balance is debited by total used tokens.
7. If balance is low, backend includes warning header.

## API groups
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`
- `GET /api/chats`, `POST /api/chats`, `POST /api/chat` (SSE)
- `GET /api/models`
- `POST /api/payments/create`, `POST /api/payments/webhook`
- `GET /api/admin/stats`, `PATCH /api/admin/models/:id`

## Security baselines
- RouterAI API key only on server `.env`
- Helmet + strict CORS + Redis rate limits
- Prisma for SQL safety + bcrypt password hashing
- httpOnly refresh tokens
- Webhook signature verification for YooKassa

## Deployment baseline
- Docker Compose with app, postgres, redis, nginx
- HTTPS termination at nginx with certbot certificates
- SSE-friendly nginx proxy config (`proxy_buffering off`)

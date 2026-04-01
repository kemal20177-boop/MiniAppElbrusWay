# ElbrusWay AI

ElbrusWay AI — AI workspace-платформа в бренде ElbrusWay: единый кабинет, единый токен-баланс, единый чат и рабочие модули вокруг RouterAI.

## Что реализовано сейчас

- auth + cookie sessions
- chat core 2.0 с SSE, project context, file attachments и tool events
- projects как контейнер для чатов, файлов, документов и canvas
- files/upload flow с локальным storage, извлечением текста, chunking и анализом
- web search с сохранением search sessions и источников
- working tool pages: `image`, `audio`, `video`, `vision`, `search`, `documents`
- provider layer in `lib/providers/*` for image/audio/video/vision jobs
- documents flow: генерация source, version history, canvas-open path и export в `pdf/docx/pptx/md/txt`
- canvas flow: создание, редактирование, version history и line diff
- billing и payment flow через Platega
- admin API для users, payments, models, plans, promo/referrals, files, projects, documents
- audit logs, rate limit, spending limits, zod validation, auth/role guards

## Основные маршруты

- UI: `/`, `/chat`, `/projects`, `/projects/[id]`, `/files`, `/documents`, `/canvas`, `/canvas/[id]`, `/tools/image`, `/tools/audio`, `/tools/video`, `/tools/search`, `/tools/vision`, `/tools/documents`, `/rates`, `/profile`, `/admin`
- Core API: `/api/chat`, `/api/chat/stream`, `/api/chats`, `/api/models`
- Workspace API: `/api/projects`, `/api/files`, `/api/search`, `/api/documents`, `/api/canvas`, `/api/tools/image`, `/api/tools/audio`, `/api/tools/video`, `/api/tools/vision`
- Tool Jobs API: `/api/tools/jobs/[id]`
- Billing API: `/api/payments/create`, `/api/payments/history`, `/api/payments/quote`, `/api/payments/webhook`
- Admin API: `/api/admin/stats`, `/api/admin/users`, `/api/admin/payments`, `/api/admin/models`, `/api/admin/files`, `/api/admin/projects`, `/api/admin/documents`, `/api/admin/search-sessions`, `/api/admin/jobs`, `/api/admin/audit`, `/api/admin/storage`

## Стек

- Next.js 14 App Router
- TypeScript
- Prisma + PostgreSQL
- Redis
- RouterAI
- Platega
- JSZip для `docx/pptx` exports

## Локальный запуск

1. Скопировать env:

```bash
cp .env.example .env
```

2. Установить зависимости:

```bash
npm install
```

3. Применить Prisma migrations и сгенерировать client:

```bash
npx prisma generate
npx prisma migrate deploy
```

4. Запустить dev:

```bash
npm run dev
```

5. Production build локально:

```bash
npm run build
npm start
```

## Важные env-переменные

- `DATABASE_URL`
- `REDIS_URL`
- `ROUTERAI_API_KEY`
- `ROUTERAI_PROVIDER_COUNTRY`
- `SPENDING_LIMIT_RUB_PER_REQUEST`
- `SPENDING_LIMIT_RUB_PER_USER_PER_DAY`
- `SPENDING_LIMIT_RUB_PER_DAY`
- `PLATEGA_MERCHANT_ID`
- `PLATEGA_SECRET_KEY`
- `PLATEGA_PAYMENT_METHOD`
- `UPLOAD_STORAGE_DIR`
- `MAX_UPLOAD_SIZE_MB`
- `IMAGE_PROVIDER_API_KEY`
- `IMAGE_PROVIDER_BASE_URL`
- `AUDIO_PROVIDER_API_KEY`
- `AUDIO_PROVIDER_BASE_URL`
- `VIDEO_PROVIDER_API_KEY`
- `VIDEO_PROVIDER_BASE_URL`
- `VISION_PROVIDER_API_KEY`
- `VISION_PROVIDER_BASE_URL`
- `TOOL_JOB_TIMEOUT_MS`
- `TOOL_JOB_MAX_ATTEMPTS`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Ручная проверка сценариев

1. Зарегистрировать нового пользователя и войти.
2. В `/files` загрузить `txt/md/pdf/png` файл, открыть карточку и нажать "Проанализировать".
3. В `/projects` создать проект, затем открыть его и проверить счётчики.
4. В `/chat` выбрать проект, отметить файлы, включить `project context` и `web search`, отправить сообщение и убедиться, что:
   - создаётся/обновляется chat,
   - идут SSE delta events,
   - появляются tool events,
   - сообщения и attachments сохраняются.
5. В `/tools/search` выполнить запрос и проверить сохранённые источники.
6. В `/tools/image`, `/tools/audio`, `/tools/video`, `/tools/vision` запустить jobs и убедиться, что появляются `ApiJob` и file artifacts.
7. В `/documents` или `/tools/documents` создать документ, затем нажать export в `PDF`, `DOCX`, `PPTX`, `MD`, `TXT`.
8. В `/canvas` создать canvas, открыть `/canvas/[id]`, сохранить новую версию, сделать rewrite/rollback и посмотреть diff.
9. В `/admin` проверить stats/users/payments/models и новые backend endpoints:
   - `/api/admin/files`
   - `/api/admin/projects`
   - `/api/admin/documents`

10. Прогнать smoke checks:

```bash
npm run test:unit
npm run test:smoke
```

## Beta-статус

Проект уже близок к production-ready workspace, но это всё ещё beta stage:

- production path для `image/audio/video/vision` теперь идёт через provider adapters из `lib/providers/*`, а текстовые/локальные артефакты остались только как безопасный dev fallback
- tool jobs поддерживают `queued/running/succeeded/failed/cancelled`, polling, retry и cancel поверх `ApiJob`
- admin UI покрывает workspace-сущности, но ещё можно усилить ручные moderation actions и глубину drill-down
- search уже делает page fetch + dedupe + citations, но не является полноценным crawler/indexer

## Release Checklist

- `cp .env.example .env`
- `npm install`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run build`
- проверить руками `/chat`, `/files`, `/documents`, `/tools/*`, `/admin`

## Миграции

Новых schema-изменений в этом инкременте не потребовалось: нужные Prisma-модели для `projects/files/documents/canvas/search/audit` уже были заведены в репозитории и покрываются существующими migrations, которые нужно применить через `npx prisma migrate deploy`.

## Деплой

Для сервера с `elbrusway.ru` подготовлены:

- `deploy/elbrusway.ru.conf`
- `deploy/miniappelbrusway.service`
- `deploy/deploy_elbrusway.sh`

Если SSL уже выпущен, деплой сводится к установке зависимостей, применению миграций, сборке и рестарту `systemd`-сервиса.

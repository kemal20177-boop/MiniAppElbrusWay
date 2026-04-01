# ElbrusWay AI

ElbrusWay AI — AI workspace-платформа в бренде ElbrusWay: единый кабинет, единый токен-баланс, единый чат и рабочие модули вокруг RouterAI как основного AI backend.

## Что реализовано сейчас

- auth + cookie sessions
- chat core с SSE, RouterAI streaming, project context, file attachments и tool events
- projects как контейнер для чатов, файлов, документов и canvas
- files/upload flow с локальным storage, извлечением текста, chunking и анализом
- web search с сохранением search sessions и источников
- рабочие страницы инструментов: `image`, `audio`, `video`, `vision`, `search`, `documents`
- RouterAI layer в `lib/routerai/*` для `client/chat/models/image/audio/files/plugins`
- живой каталог моделей RouterAI с возможностями, ценами и тематическими подборками
- documents flow: генерация source, version history, canvas-open path и export в `pdf/docx/pptx/md/txt`
- canvas flow: создание, редактирование, version history и line diff
- billing и payment flow через Platega
- admin API для users, payments, models, plans, promo/referrals, files, projects, documents, jobs, search sessions, storage
- audit logs, rate limit, spending limits, zod validation, auth/role guards

## Основные маршруты

- UI: `/`, `/chat`, `/projects`, `/projects/[id]`, `/files`, `/documents`, `/canvas`, `/canvas/[id]`, `/tools/image`, `/tools/audio`, `/tools/video`, `/tools/search`, `/tools/vision`, `/tools/documents`, `/rates`, `/profile`, `/admin`
- Core API: `/api/chat`, `/api/chat/stream`, `/api/chats`, `/api/models`
- Workspace API: `/api/projects`, `/api/files`, `/api/search`, `/api/documents`, `/api/canvas`, `/api/tools/image`, `/api/tools/audio`, `/api/tools/video`, `/api/tools/vision`
- API заданий инструментов: `/api/tools/jobs/[id]`
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
- `ROUTERAI_BASE_URL`
- `ROUTERAI_PROVIDER_COUNTRY`
- `ROUTERAI_MODELS_CACHE_TTL_SEC`
- `ROUTERAI_IMAGE_MODEL`
- `ROUTERAI_AUDIO_MODEL`
- `ROUTERAI_VISION_MODEL`
- `ROUTERAI_VIDEO_MODEL`
- `SPENDING_LIMIT_RUB_PER_REQUEST`
- `SPENDING_LIMIT_RUB_PER_USER_PER_DAY`
- `SPENDING_LIMIT_RUB_PER_DAY`
- `PLATEGA_MERCHANT_ID`
- `PLATEGA_SECRET_KEY`
- `PLATEGA_PAYMENT_METHOD`
- `UPLOAD_STORAGE_DIR`
- `MAX_UPLOAD_SIZE_MB`
- `TOOL_JOB_TIMEOUT_MS`
- `TOOL_JOB_MAX_ATTEMPTS`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Beta-статус

Проект уже близок к production-ready workspace, но это всё ещё beta-стадия:

- основной AI backend теперь RouterAI, включая живой каталог, стриминг чата и мультимодальные инструменты
- image/vision/audio используют реальные вызовы RouterAI; video остаётся зависимым от доступных возможностей модели и честно помечен как beta, если живой каталог не подтверждает генерацию на выходе
- tool jobs поддерживают `queued/running/succeeded/failed/cancelled`, polling, retry и cancel поверх `ApiJob`
- search уже делает page fetch + dedupe + citations, но не является полноценным crawler/indexer
- остаются frontend warnings по hook dependencies и `next/image`, которые не ломают runtime, но ещё можно добить post-release pass

## Release Checklist

- `cp .env.example .env`
- `npm install`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run build`
- `npm run lint`
- зарегистрировать пользователя, войти и проверить `/profile` -> `Выйти`
- в `/files` загрузить один и несколько файлов, затем прикрепить их к `/chat`
- в `/chat` отправить сообщение, перегенерировать ответ и открыть его в документе или канвасе
- в `/documents` создать документ и проверить экспорт в `PDF`, `DOCX`, `PPTX`, `MD`, `TXT`
- в `/canvas` проверить autosave, rewrite, rollback и diff
- в `/tools/search` выполнить поиск, открыть результат в канвасе и создать документ
- в `/tools/image`, `/tools/vision`, `/tools/audio`, `/tools/video` проверить честные статусы заданий и артефакты
- в `/admin` проверить разделы моделей, файлов, проектов, документов, поисковых сессий, заданий и хранилища

## Миграции

Новых schema-изменений в этом инкременте не потребовалось: нужные Prisma-модели для `projects/files/documents/canvas/search/audit` уже были заведены в репозитории и покрываются существующими migrations, которые нужно применить через `npx prisma migrate deploy`.

## Деплой

Для сервера с `elbrusway.ru` подготовлены:

- `deploy/elbrusway.ru.conf`
- `deploy/miniappelbrusway.service`
- `deploy/deploy_elbrusway.sh`

Если SSL уже выпущен, деплой сводится к установке зависимостей, применению миграций, сборке и рестарту `systemd`-сервиса.

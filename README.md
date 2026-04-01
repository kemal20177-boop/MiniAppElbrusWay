# ElbrusWay AI

ElbrusWay AI — AI workspace-платформа в бренде ElbrusWay: единый кабинет, единый токен-баланс, единый чат и рабочие модули вокруг RouterAI.

## Что реализовано сейчас

- auth + cookie sessions
- chat core 2.0 с SSE, project context, file attachments и tool events
- projects как контейнер для чатов, файлов, документов и canvas
- files/upload flow с локальным storage, извлечением текста, chunking и анализом
- web search с сохранением search sessions и источников
- working tool pages: `image`, `audio`, `video`, `vision`, `search`, `documents`
- documents flow: генерация source, version history, canvas-open path и export в `pdf/docx/pptx/md/txt`
- canvas flow: создание, редактирование, version history и line diff
- billing и payment flow через Platega
- admin API для users, payments, models, plans, promo/referrals, files, projects, documents
- audit logs, rate limit, spending limits, zod validation, auth/role guards

## Основные маршруты

- UI: `/`, `/chat`, `/projects`, `/projects/[id]`, `/files`, `/documents`, `/canvas`, `/canvas/[id]`, `/tools/image`, `/tools/audio`, `/tools/video`, `/tools/search`, `/tools/vision`, `/tools/documents`, `/rates`, `/profile`, `/admin`
- Core API: `/api/chat`, `/api/chat/stream`, `/api/chats`, `/api/models`
- Workspace API: `/api/projects`, `/api/files`, `/api/search`, `/api/documents`, `/api/canvas`, `/api/tools/image`, `/api/tools/audio`, `/api/tools/video`, `/api/tools/vision`
- Billing API: `/api/payments/create`, `/api/payments/history`, `/api/payments/quote`, `/api/payments/webhook`
- Admin API: `/api/admin/stats`, `/api/admin/users`, `/api/admin/payments`, `/api/admin/models`, `/api/admin/files`, `/api/admin/projects`, `/api/admin/documents`

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

## Beta-статус

Проект уже не выглядит как MVP-заготовка, но это всё ещё beta stage:

- tool pages `image/audio/video/vision` пока идут через встроенные job pipelines и локальные artifacts; для production quality нужен реальный provider layer
- chat UI, admin UI и split-view UX ещё можно заметно дополировать третьим прогоном
- search уже подтягивает page content и citations, но не претендует на полноценный crawler

## Миграции

Новых schema-изменений в этом инкременте не потребовалось: нужные Prisma-модели для `projects/files/documents/canvas/search/audit` уже были заведены в репозитории и покрываются существующими migrations, которые нужно применить через `npx prisma migrate deploy`.

## Деплой

Для сервера с `elbrusway.ru` подготовлены:

- `deploy/elbrusway.ru.conf`
- `deploy/miniappelbrusway.service`
- `deploy/deploy_elbrusway.sh`

Если SSL уже выпущен, деплой сводится к установке зависимостей, применению миграций, сборке и рестарту `systemd`-сервиса.

# ElbrusWay AI

MVP-каркас платформы агрегации AI-моделей для российских пользователей.

## Что уже есть

- Next.js 14 App Router приложение
- Дизайн-направление для `elbrusway.ru`
- Страницы: `/`, `/chat`, `/rates`, `/profile`, `/auth/login`, `/auth/register`, `/admin`
- API route handlers: `/api/healthz`, `/api/models`, `/api/chat`, `/api/auth/register`, `/api/auth/login`, `/api/payments/create`, `/api/payments/webhook`
- Prisma-схема под пользователей, чаты, платежи, тарифы и модели
- Docker / nginx / systemd-файлы для деплоя

## Стек

- Next.js 14 + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Redis
- RouterAI
- ЮKassa

## Быстрый старт

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Разработка:

```bash
npm install
npm run dev
```

Prisma:

```bash
npx prisma generate
npx prisma migrate dev
```

## Что сейчас реализовано как MVP

- UI и структура ключевых страниц
- Регистрация, логин, logout и cookie-сессии
- Персистентные чаты, сообщения, платежи и транзакции в PostgreSQL через Prisma
- Базовый чат-клиент, который ходит в `/api/chat`
- Proxy к RouterAI с fallback-ответом, если `ROUTERAI_API_KEY` не задан
- Живой каталог RouterAI через `/api/v1/models` с реальными ценами, контекстом и модальностями
- Расчет себестоимости сообщений по фактическому `pricing` выбранной модели RouterAI
- Backend policy-checks перед вызовом RouterAI: whitelist моделей по тарифу, `max_tokens` cap и spending limits через env
- Rate limiting на `/api/chat`: Redis при наличии `REDIS_URL`, fallback на in-memory window в dev
- Профиль пользователя, статистика и admin API

## Что ещё надо довести до production

- Добавить полный streaming chat flow через SSE
- Подключить реальную ЮKassa вместо локального success flow
- Redis rate limiting и кэш моделей
- OAuth, email verification, reset password
- Расширить admin CRUD и аналитику

## Admin bootstrap

- Админ создаётся из `ADMIN_EMAIL`
- Если база пустая, пароль берётся из `ADMIN_PASSWORD`
- По умолчанию в шаблоне: `admin@elbrusway.ru / Admin12345!`

## Деплой

Для сервера с `elbrusway.ru` подготовлены:

- `deploy/elbrusway.ru.conf`
- `deploy/miniappelbrusway.service`
- `deploy/deploy_elbrusway.sh`

Если SSL уже выпущен, деплой сводится к установке зависимостей, сборке и рестарту `systemd`-сервиса.

# Backend route contract

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/verify-email`

## Chats
- `GET /api/chats`
- `POST /api/chats`
- `DELETE /api/chats/:id`
- `GET /api/chats/:id/messages`
- `POST /api/chat`
- `POST /api/chat/stop`

## Models
- `GET /api/models`

## User
- `GET /api/user/profile`
- `PATCH /api/user/profile`
- `GET /api/user/stats`
- `GET /api/user/transactions`

## Payments
- `POST /api/payments/create`
- `POST /api/payments/webhook`
- `GET /api/payments/:id/status`
- `GET /api/payments/history`

## Admin
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET /api/admin/payments`
- `GET /api/admin/models`
- `PATCH /api/admin/models/:id`
- `GET /api/admin/logs`

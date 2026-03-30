# Platega integration notes

## Environment
- `PLATEGA_BASE_URL=https://app.platega.io`
- `PLATEGA_MERCHANT_ID=<merchant id>`
- `PLATEGA_SECRET_KEY=<api key>`
- `PLATEGA_PAYMENT_METHOD=2`
- `NEXT_PUBLIC_APP_URL=https://elbrusway.ru`

## Payment creation
- Route: `POST /api/payments/create`
- Provider API: `POST /transaction/process`
- Request headers:
  - `X-MerchantId`
  - `X-Secret`
- Current request payload:
  - `paymentMethod`
  - `paymentDetails.amount`
  - `paymentDetails.currency`
  - `description`
  - `return`
  - `failedUrl`
  - `payload`
- Response field used for redirect: `redirect`

## Status sync
- Local route: `GET /api/payments/:id/status`
- Provider API: `GET /transaction/{id}`
- Pending payments are synced against Platega before returning status to the user.

## Webhook handling
- Route: `POST /api/payments/webhook`
- Platega sends:
  - headers `X-MerchantId`, `X-Secret`
  - JSON body with `id`, `amount`, `currency`, `status`, `paymentMethod`
- Status mapping:
  - `CONFIRMED` -> `SUCCEEDED`
  - `CANCELED` -> `CANCELLED`
  - `CHARGEBACK` -> `REFUNDED`
- Successful webhook is idempotent: repeated `CONFIRMED` callbacks do not double-credit the user.

## Return pages
- `https://elbrusway.ru/payment/success?paymentId=<local id>`
- `https://elbrusway.ru/payment/fail?paymentId=<local id>`

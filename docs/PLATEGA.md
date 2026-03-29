# Platega integration contract

## Environment
- `PLATEGA_API_BASE_URL=https://app.platega.io`
- `PLATEGA_MERCHANT_ID=<merchant id>`
- `PLATEGA_SECRET_KEY=<api key>`
- `PLATEGA_CALLBACK_URL=https://elbrusway.ru/api/payments/webhook`
- `PLATEGA_SUCCESS_URL=https://elbrusway.ru/profile/billing/success`
- `PLATEGA_FAIL_URL=https://elbrusway.ru/profile/billing/fail`

## Payment creation
- Endpoint: `POST https://app.platega.io/transaction/process`
- Required headers:
  - `Content-Type: application/json`
  - `X-MerchantId: <merchant id>`
  - `X-Secret: <api key>`
- Minimal request shape:

```json
{
  "paymentMethod": 2,
  "id": "payment-uuid",
  "paymentDetails": {
    "amount": 970,
    "currency": "RUB"
  },
  "description": "ElbrusWay plan upgrade",
  "return": "https://elbrusway.ru/profile/billing/success",
  "failedUrl": "https://elbrusway.ru/profile/billing/fail",
  "payload": "internal-payment-id"
}
```

## Callback handling
- Callback URL is configured in the Platega merchant cabinet.
- Platega sends `POST` callbacks and retries up to 3 times if the endpoint does not answer with success.
- Callback statuses to handle:
  - `CONFIRMED`
  - `CANCELED`
- Webhook handler should:
  1. Verify merchant credentials and match `providerTransactionId`
  2. Persist the full callback body into `callbackPayload`
  3. Apply tokens and plan changes only for `CONFIRMED`
  4. Mark unsuccessful payments as `CANCELED` or `FAILED`

## Status polling
- Endpoint: `GET https://app.platega.io/transaction/{id}`
- Use as a reconciliation step if callback delivery is delayed.

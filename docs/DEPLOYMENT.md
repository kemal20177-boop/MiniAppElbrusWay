# Deployment notes for elbrusway.ru

## Domain
- Primary domain: `elbrusway.ru`
- Optional alias: `www.elbrusway.ru`

## DNS
- Create an `A` record for `elbrusway.ru` pointing to your production server IP.
- Create a `CNAME` record from `www.elbrusway.ru` to `elbrusway.ru`, or a second `A` record to the same IP.

## Nginx
- `nginx.conf` is prepared for:
  - HTTP to HTTPS redirect
  - `www` to apex redirect
  - TLS termination for `elbrusway.ru`
  - proxying the app container on port `3000`

## SSL
- Issue a certificate for `elbrusway.ru` and `www.elbrusway.ru` with certbot before enabling the 443 server block in production.
- Expected certificate paths:
  - `/etc/letsencrypt/live/elbrusway.ru/fullchain.pem`
  - `/etc/letsencrypt/live/elbrusway.ru/privkey.pem`

## Platega
- Set callback URL in Platega merchant cabinet to:
  - `https://elbrusway.ru/api/payments/webhook`
- Set return URLs to:
  - `https://elbrusway.ru/payment/success`
  - `https://elbrusway.ru/payment/fail`

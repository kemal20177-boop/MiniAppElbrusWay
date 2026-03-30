#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/MiniAppElbrusWay"
SERVICE_NAME="elbrusway.service"
NGINX_SITE="elbrusway.ru"

mkdir -p /var/www/certbot

cp "$APP_DIR/deploy/elbrusway.ru.conf" "/etc/nginx/sites-available/$NGINX_SITE"
ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"

cat > "/etc/systemd/system/$SERVICE_NAME" <<'EOF'
[Unit]
Description=ElbrusWay Next.js app
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/MiniAppElbrusWay
EnvironmentFile=/root/MiniAppElbrusWay/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

npm --prefix "$APP_DIR" install
npm --prefix "$APP_DIR" run build

nginx -t
systemctl daemon-reload
systemctl enable --now elbrusway.service
systemctl restart elbrusway.service
systemctl reload nginx

echo "Deployment complete"
echo "Health: curl -I http://127.0.0.1:3000/api/healthz"
echo "Site:   curl -I https://elbrusway.ru"

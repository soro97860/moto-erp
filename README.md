# 機車行 ERP

全端機車行管理系統，功能涵蓋結帳開單、工單管理、庫存倉儲、客戶資料、報表分析，以及系統設定。

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS + Zustand + TanStack Query |
| 後端 | Node.js + Express + TypeScript |
| 資料庫 | PostgreSQL 16 + Prisma v5 |
| 反向代理 | Nginx |
| 容器化 | Docker + Docker Compose |
| SSL | Let's Encrypt (Certbot) |

---

## 快速開始（本機開發）

### 環境需求

- Node.js 20+
- Docker Desktop

### 步驟

```bash
# 1. 複製設定檔
cp .env.example .env
# 填入 POSTGRES_PASSWORD 和 JWT_SECRET

# 2. 啟動資料庫
docker compose up postgres -d

# 3. 安裝依賴
npm install

# 4. 初始化資料庫
cd server
npx prisma migrate dev
npx prisma db seed
cd ..

# 5. 啟動開發伺服器
npm run dev
```

預設帳號：`admin` / `admin1234`（首次登入請立即修改密碼）

---

## 生產環境部署

### 環境需求

- Linux 伺服器（Ubuntu 22.04 推薦）
- 公開 IP 並已設定 DNS A 記錄指向此伺服器
- Docker + Docker Compose v2

### 步驟一：準備設定檔

```bash
cp .env.example .env
```

編輯 `.env`，必填欄位：

```env
POSTGRES_PASSWORD=<強密碼>
JWT_SECRET=<至少 64 字元的隨機字串>
DOMAIN=your-domain.com
CERTBOT_EMAIL=your-email@example.com
```

產生強隨機字串：

```bash
openssl rand -base64 48
```

### 步驟二：替換 nginx 設定中的網域

```bash
sed -i "s/DOMAIN/your-domain.com/g" nginx/nginx-prod.conf
```

### 步驟三：取得 SSL 憑證（首次）

先啟動 nginx（僅 HTTP）讓 Certbot 驗證網域：

```bash
# 暫時以開發版 compose 啟動 nginx（僅 80 port）
docker compose up nginx -d

# 取得憑證
docker compose -f docker-compose.prod.yml run --rm --profile init certbot-init
```

### 步驟四：啟動完整服務

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 步驟五：初始化資料庫

```bash
docker compose -f docker-compose.prod.yml exec server \
  npx prisma migrate deploy

docker compose -f docker-compose.prod.yml exec server \
  npx prisma db seed
```

### 步驟六：驗證

```bash
# 檢查服務狀態
docker compose -f docker-compose.prod.yml ps

# 查看 API 健康
curl https://your-domain.com/api/v1/health
```

---

## 資料庫備份

### 手動備份

```bash
docker exec moto-erp-db pg_dump \
  -U moto_user moto_erp \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 還原備份

```bash
gunzip -c backup_20240101_120000.sql.gz \
  | docker exec -i moto-erp-db psql -U moto_user moto_erp
```

### 自動每日備份（crontab）

```bash
# crontab -e
0 2 * * * docker exec moto-erp-db pg_dump -U moto_user moto_erp | gzip > /var/backups/moto-erp/backup_$(date +\%Y\%m\%d).sql.gz && find /var/backups/moto-erp -name "*.sql.gz" -mtime +30 -delete
```

---

## SSL 憑證更新

Certbot 容器每 12 小時自動嘗試更新（僅在到期前 30 天內才實際執行）。

手動觸發更新：

```bash
docker compose -f docker-compose.prod.yml exec certbot certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 常見問題

### 資料庫連線失敗

```bash
# 確認 postgres 容器健康狀態
docker compose -f docker-compose.prod.yml ps postgres

# 查看 postgres 日誌
docker compose -f docker-compose.prod.yml logs postgres --tail 50
```

### API 回傳 502

```bash
# 確認 server 容器是否正常
docker compose -f docker-compose.prod.yml logs server --tail 50
```

### SSL 憑證問題

```bash
# 確認憑證是否存在
docker run --rm -v moto-erp_certbot_conf:/etc/letsencrypt alpine ls /etc/letsencrypt/live/

# 重新申請憑證
docker compose -f docker-compose.prod.yml run --rm --profile init certbot-init
```

### 更新應用程式

```bash
# 拉取最新程式碼
git pull

# 重建並重啟服務
docker compose -f docker-compose.prod.yml up -d --build server client

# 如有資料庫 migration
docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy
```

---

## 目錄結構

```
moto-erp/
├── client/             # React 前端
├── server/             # Express 後端
│   ├── prisma/         # Schema、migrations、seed
│   └── src/
│       ├── routes/     # API routes
│       └── middleware/
├── shared/             # 共用型別
├── nginx/
│   ├── nginx.conf      # 開發用設定
│   └── nginx-prod.conf # 生產用設定（HTTPS）
├── docker-compose.yml      # 開發環境
├── docker-compose.prod.yml # 生產環境（含 Certbot）
└── .env.example
```

---

## 預設帳號

| 帳號 | 密碼 | 角色 |
|------|------|------|
| admin | admin1234 | 老闆/管理員 |

> **請在首次登入後立即至「系統設定 → 員工管理」修改密碼。**

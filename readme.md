```
# NovaPay — Rebuilt Transaction Backend

### 1. Clone & Install
```bash
git clone <repo>
cd novapay
npm install
```

### 2. Environment
```bash
cp .env.example .env
# Edit .env with your values (dev .env already included)
```

### 3. Start Postgres + Redis
```bash
docker-compose up postgres redis -d
```

### 4. Run Migrations + Seed
```bash
npm run prisma:migrate   # creates all tables
npm run seed             # seeds super-admin + test users
```

### 5. Start Dev Server
```bash
npm run dev
```

Server runs at: http://localhost:3000
Health check: http://localhost:3000/health

---

## Test Credentials (after seed)

| Role        | Email                        | Password         |
|-------------|------------------------------|------------------|
| SUPER_ADMIN | superadmin@novapay.com       | SuperAdmin@123!  |
| ADMIN       | admin@novapay.com            | Admin@123!       |
| CORPORATE   | corporate@acmecorp.com       | Corporate@123!   |
| CUSTOMER    | alice@example.com            | Customer@123!    |
| CUSTOMER    | bob@example.com              | Customer@123!    |
| EMPLOYEE    | emp1@acmecorp.com            | Employee@123!    |

---

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout

### Accounts
- GET  /api/accounts/me
- GET  /api/accounts/wallets
- POST /api/accounts/wallets
- GET  /api/accounts/wallets/:id/balance

### Health
- GET /health

---

## Architecture Notes

This is a **Modular Monolith** — one app, separate modules with clear boundaries.
Each module has its own: routes → controller → service → (shared) prisma client.

All money values use `Decimal` (20,6) — never float. Never.


```

```
npx prisma migrate dev --name init

```

```
npm install -D ts-node
npx tsx prisma/seed.ts

```

```

### docker:

docker-compose up --build
docker-compose up -d
npx prisma migrate dev --name init

then start again command:
docker-compose up -d

to stop everything:
docker-compose down

to check any error:
docker logs electromart_app

to check actually running:
docker ps


docker exec -it electromart_app sh
npx prisma migrate dev --name init


## 🧒 Daily Routine From Now On
```
```
1. Open Docker Desktop → leave it running
2. Open VS Code terminal
3. Type → docker-compose up
4. Code normally, changes reflect live with hot reload!
5. When done → Ctrl+C to stop logs, then docker-compose down


Run Prisma Studio:
npx prisma studio --port 5555 --browser none


### to kill/delete running port:
netstat -ano | findstr :5000
taskkill /PID 12345 /F
docker-compose down
```
```
jwt token generate:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

```
```
npx prisma db seed
```

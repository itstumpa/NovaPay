
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
npx tsx prisma/seed.ts
```
```

# 1. Unzip and install
npm install

# 2. Start DB and Redis
docker-compose up postgres redis -d

# 3. Create tables
npm run prisma:migrate

# 4. Seed data
npm run seed

# 5. Start server
npm run dev

```
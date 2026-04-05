#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Running seed..."
node dist/prisma/seed.js

echo "🚀 Starting NovaPay..."
exec node dist/app.js

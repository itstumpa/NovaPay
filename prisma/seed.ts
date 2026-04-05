import { PrismaClient, UserRole, UserStatus, Currency } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function main() {
  console.log('🌱 Starting seed...');

  // ─── System Accounts ───────────────────────────────────────────────
  // These are internal NovaPay ledger accounts (not user wallets)
  const systemAccounts = [
    { name: 'novapay_fee_account', currency: Currency.USD, description: 'NovaPay platform fee collection' },
    { name: 'suspense_account', currency: Currency.USD, description: 'Temporary holding for incomplete transfers' },
    { name: 'fx_settlement_account', currency: Currency.USD, description: 'FX conversion buffer' },
  ];

  for (const acc of systemAccounts) {
    await prisma.systemAccount.upsert({
      where: { name: acc.name },
      update: {},
      create: acc,
    });
  }
  console.log('✅ System accounts created');

  // ─── Super Admin ────────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@novapay.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123!';
  const superAdminName = process.env.SUPER_ADMIN_NAME ?? 'Nova Super Admin';

  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash,
      name: superAdminName,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✅ Super Admin bootstrapped: ${superAdminEmail}`);

  // ─── Seed Users ─────────────────────────────────────────────────────
  const seedUsers = [
    {
      email: 'admin@novapay.com',
      password: 'Admin@123!',
      name: 'Nova Admin',
      role: UserRole.ADMIN,
    },
    {
      email: 'corporate@acmecorp.com',
      password: 'Corporate@123!',
      name: 'ACME Corp HR',
      role: UserRole.CORPORATE,
    },
    {
      email: 'alice@example.com',
      password: 'Customer@123!',
      name: 'Alice Johnson',
      role: UserRole.CUSTOMER,
    },
    {
      email: 'bob@example.com',
      password: 'Customer@123!',
      name: 'Bob Smith',
      role: UserRole.CUSTOMER,
    },
    {
      email: 'charlie@example.com',
      password: 'Customer@123!',
      name: 'Charlie Brown',
      role: UserRole.CUSTOMER,
    },
    // Employees for payroll testing
    {
      email: 'emp1@acmecorp.com',
      password: 'Employee@123!',
      name: 'Employee One',
      role: UserRole.CUSTOMER,
    },
    {
      email: 'emp2@acmecorp.com',
      password: 'Employee@123!',
      name: 'Employee Two',
      role: UserRole.CUSTOMER,
    },
    {
      email: 'emp3@acmecorp.com',
      password: 'Employee@123!',
      name: 'Employee Three',
      role: UserRole.CUSTOMER,
    },
  ];

  const createdUsers: Record<string, string> = {};

  for (const u of seedUsers) {
    const hash = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: hash,
        name: u.name,
        role: u.role,
        status: UserStatus.ACTIVE,
      },
    });
    createdUsers[u.email] = user.id;
  }
  console.log(`✅ ${seedUsers.length} seed users created`);

  // ─── Wallets ────────────────────────────────────────────────────────
  // Corporate gets USD wallet with fat balance for payroll testing
  const corporateId = createdUsers['corporate@acmecorp.com'];
  await prisma.wallet.upsert({
    where: { userId_currency: { userId: corporateId, currency: Currency.USD } },
    update: { balance: 500000 }, // $500K for payroll testing
    create: { userId: corporateId, currency: Currency.USD, balance: 500000 },
  });

  // Customers get USD + EUR wallets
  const customerEmails = ['alice@example.com', 'bob@example.com', 'charlie@example.com'];
  for (const email of customerEmails) {
    const userId = createdUsers[email];
    await prisma.wallet.upsert({
      where: { userId_currency: { userId, currency: Currency.USD } },
      update: { balance: 1000 },
      create: { userId, currency: Currency.USD, balance: 1000 },
    });
    await prisma.wallet.upsert({
      where: { userId_currency: { userId, currency: Currency.EUR } },
      update: { balance: 500 },
      create: { userId, currency: Currency.EUR, balance: 500 },
    });
  }

  // Employees get USD wallets with $0 (they receive salary)
  const employeeEmails = ['emp1@acmecorp.com', 'emp2@acmecorp.com', 'emp3@acmecorp.com'];
  for (const email of employeeEmails) {
    const userId = createdUsers[email];
    await prisma.wallet.upsert({
      where: { userId_currency: { userId, currency: Currency.USD } },
      update: {},
      create: { userId, currency: Currency.USD, balance: 0 },
    });
  }

  console.log('✅ Wallets created with seed balances');

  // ─── Summary ────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('🎉 Seed complete! Test credentials:');
  console.log('========================================');
  console.log(`SUPER ADMIN  : ${superAdminEmail} / ${superAdminPassword}`);
  console.log('ADMIN        : admin@novapay.com / Admin@123!');
  console.log('CORPORATE    : corporate@acmecorp.com / Corporate@123!  (balance: $500,000)');
  console.log('CUSTOMER     : alice@example.com / Customer@123!  (balance: $1000 USD, €500 EUR)');
  console.log('CUSTOMER     : bob@example.com / Customer@123!');
  console.log('EMPLOYEE 1   : emp1@acmecorp.com / Employee@123!');
  console.log('EMPLOYEE 2   : emp2@acmecorp.com / Employee@123!');
  console.log('EMPLOYEE 3   : emp3@acmecorp.com / Employee@123!');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

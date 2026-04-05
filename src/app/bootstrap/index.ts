// import { ensureSuperAdmin } from "./ensureSuperAdmin";

import { prisma } from "../../lib/prisma";

export async function bootstrapApp() {
  await prisma.$connect();
  console.log("Database connected");

//   await ensureSuperAdmin();
}
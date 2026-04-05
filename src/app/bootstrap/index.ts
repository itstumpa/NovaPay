// import { ensureSuperAdmin } from "./ensureSuperAdmin";

import  prisma  from "../config/prisma";

export async function bootstrapApp() {
  await prisma.$connect();
  //   await ensureSuperAdmin();
}

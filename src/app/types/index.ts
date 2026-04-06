import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      isEmailVerified: boolean;
    }
      interface ProcessEnv {
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRES: string;
    JWT_REFRESH_EXPIRES: string;
  }

  interface jest {
    
  }
  
  }
}
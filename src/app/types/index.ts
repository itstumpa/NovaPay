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

    interface Request {
      userId?: string;
      userEmail?: string;
      userRole?: UserRole;
      requestId: string;
    }

    interface ProcessEnv {
      JWT_ACCESS_SECRET: string;
      JWT_REFRESH_SECRET: string;
      JWT_ACCESS_EXPIRES: string;
      JWT_REFRESH_EXPIRES: string;
    }

    interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

  }
}

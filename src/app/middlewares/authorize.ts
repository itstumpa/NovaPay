// src/middlewares/authorize.ts
import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import ApiError from "../../utils/apiErrors";

export const authorize = (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Unauthorized"));

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "Forbidden: you don't have access to this resource")
      );
    }
    next();
  };
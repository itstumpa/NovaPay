import { Request, Response } from "express";
import * as UserService from "./users.service";
import catchAsync from "../../../utils/catchAsync";
import { sendSuccess } from "../../../utils/response";

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.createUser(req.body);
  sendSuccess(res, user, 201);
});

export const getAllUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await UserService.getAllUsers();
  sendSuccess(res, users);
});

export const getUserById = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.getUserById(req.params.id as string);
  sendSuccess(res, user);
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.updateUser(req.params.id as string, req.body);
  sendSuccess(res, user);
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.deleteUser(req.params.id as string);
  sendSuccess(res, result);
});
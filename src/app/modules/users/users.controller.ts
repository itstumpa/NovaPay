import { Request, Response } from "express";
import * as UserService from "./users.service";

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await UserService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await UserService.getAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await UserService.getUserById(req.params.id as string);
    res.status(200).json({ success: true, data: user });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = await UserService.updateUser(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const result = await UserService.deleteUser(req.params.id as string);
    res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};
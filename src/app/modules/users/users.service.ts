import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma";

// CREATE
export const createUser = async (data: {
  name: string;
  email: string;
  password: string;
  role?: "CUSTOMER" | "VENDOR";
}) => {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new Error("Email already in use");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
    },
  });

  // never return password
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// GET ALL (admin use)
export const getAllUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      // password is excluded
    },
  });
};

// GET ONE
export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) throw new Error("User not found");
  return user;
};

// UPDATE
export const updateUser = async (
  id: string,
  data: { name?: string; email?: string }
) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
};

// DELETE
export const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");

  await prisma.user.delete({ where: { id } });
  return { message: "User deleted successfully" };
};
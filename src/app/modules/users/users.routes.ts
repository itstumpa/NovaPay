import { Router } from "express";
import * as UserController from "./users.controller";
import { validate } from "../../middlewares/validate";
import { createUserSchema, updateUserSchema } from "./users.validation";

const router = Router();

router.post("/", validate(createUserSchema), UserController.createUser);
router.get("/", UserController.getAllUsers);
router.get("/:id", UserController.getUserById);
router.patch("/:id", validate(updateUserSchema), UserController.updateUser);
router.delete("/:id", UserController.deleteUser);

export default router;
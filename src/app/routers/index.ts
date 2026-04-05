import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import UserRoutes from "../modules/users/users.routes";
import { accountRouter } from "../modules/account/account.routes";
//import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.use("/auth", authRouter);
router.use("/account", accountRouter);
// router.use(authenticate);

router.use("/users", UserRoutes);

export default router;

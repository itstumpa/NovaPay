import { Router } from "express";
import UserRoutes from "../modules/users/users.routes";
import { authRoute } from "../auth/auth.routes";
//import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.use("/auth", authRoute);
// router.use(authenticate);

router.use("/users", UserRoutes);

export default router;
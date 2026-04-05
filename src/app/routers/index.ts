import { Router } from "express";
import { authRouter } from "../auth/auth.routes";
import { accountRouter } from "../modules/account/account.routes";
import UserRoutes from "../modules/users/users.routes";
//import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.use("/auth", authRouter);
router.use("/account", accountRouter);

// app.use('/api/transactions', transactionRouter);
// app.use('/api/ledger', ledgerRouter);
// app.use('/api/fx', fxRouter);
// app.use('/api/payroll', payrollRouter);
// app.use('/api/admin', adminRouter);


// router.use(authenticate);

router.use("/users", UserRoutes);

export default router;

import { Router } from "express";
import { accountRouter } from "../modules/account/account.routes";
import { authRouter } from "../modules/auth/auth.routes";
import UserRoutes from "../modules/users/users.routes";
//import { authenticate, authorize } from "../middlewares/auth";
import { transactionRouter } from "../modules/transaction/transaction.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/account", accountRouter);
router.use("/users", UserRoutes);
router.use("/transactions", transactionRouter);
// router.use("/fx", fxRouter);
// router.use("/payroll", payrollRouter);

// app.use('/api/transactions', transactionRouter);
// app.use('/api/ledger', ledgerRouter);
// app.use('/api/fx', fxRouter);
// app.use('/api/payroll', payrollRouter);
// app.use('/api/admin', adminRouter);

// router.use(authenticate);

export default router;

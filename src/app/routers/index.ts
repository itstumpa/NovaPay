import { Router } from "express";
import { authRouter } from "../auth/auth.routes";
import { accountRouter } from "../modules/account/account.routes";
import UserRoutes from "../modules/users/users.routes";
//import { authenticate, authorize } from "../middlewares/auth";
import { fxRouter } from "../modules/fx/fx.routes";
import { transactionRouter } from "../modules/transaction/transaction.routes";
import { payrollRouter } from "../modules/payroll/payroll.routes";
import { adminRouter } from "../modules/admin/admin.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/account", accountRouter);
router.use("/users", UserRoutes);
router.use("/transactions", transactionRouter);
router.use("/fx", fxRouter);
router.use("/payroll", payrollRouter);
router.use("/admin", adminRouter);

// app.use('/api/transactions', transactionRouter);
// app.use('/api/ledger', ledgerRouter);
// app.use('/api/fx', fxRouter);
// app.use('/api/payroll', payrollRouter);
// app.use('/api/admin', adminRouter);

// router.use(authenticate);

export default router;

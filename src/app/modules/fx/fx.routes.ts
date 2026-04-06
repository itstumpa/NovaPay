import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { FxController } from './fx.controller';

const router = Router();
const ctrl = new FxController();

router.use(authenticate);

router.post('/quote', ctrl.createQuote);           // issue a 60s locked quote
router.get('/quote/:quoteId', ctrl.getQuote);      // check validity + time remaining
router.post('/transfer', ctrl.internationalTransfer); // execute (requires valid quoteId)

export { router as fxRouter };

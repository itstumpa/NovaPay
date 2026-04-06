import { Request, Response } from 'express';
import { FxService } from './fx.service';
import { sendSuccess } from '../../../utils/apiResponse';
import  catchAsync  from '../../../utils/catchAsync';
import { Currency } from '@prisma/client';
import { z } from 'zod';

const service = new FxService();

const quoteSchema = z.object({
  fromCurrency: z.nativeEnum(Currency),
  toCurrency: z.nativeEnum(Currency),
  sourceAmount: z.number().positive(),
});

const fxTransferSchema = z.object({
  quoteId: z.string().uuid(),
  receiverEmail: z.string().email(),
});

export class FxController {
  createQuote = catchAsync(async (req: Request, res: Response) => {
    const body = quoteSchema.parse(req.body);
    const quote = await service.createQuote({ userId: req.userId!, ...body });
    sendSuccess(res, quote, 201);
  });

  getQuote = catchAsync(async (req: Request, res: Response) => {
    const quote = await service.getQuote(req.params.quoteId as string, req.userId!);
    sendSuccess(res, quote);
  });

  internationalTransfer = catchAsync(async (req: Request, res: Response) => {
    const body = fxTransferSchema.parse(req.body);
    const result = await service.internationalTransfer({
      userId: req.userId!,
      requestId: req.requestId,
      ...body,
    });
    sendSuccess(res, result, 201);
  });
}

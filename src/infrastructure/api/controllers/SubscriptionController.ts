// infrastructure/api/controllers/SubscriptionController.ts
import { Request, Response } from 'express';
import { SubscriptionBillingService } from '../../../domain/services/SubscriptionBillingService';
import { PostgresSubscriptionRepository } from '../../adapters/PostgresSubscriptionRepository';
import { PostgresUserRepository } from '../../adapters/PostgresUserRepository';
import { MockPaymentGateway } from '../../adapters/MockPaymentGateway';
import { SystemTimeProvider } from '../../adapters/SystemTimeProvider';

export class SubscriptionController {
  constructor(
    private readonly serviceFactory?: () => SubscriptionBillingService
  ) {}

  private getService(): SubscriptionBillingService {
    if (this.serviceFactory) {
      return this.serviceFactory();
    }

    return new SubscriptionBillingService(
      new PostgresSubscriptionRepository(),
      new PostgresUserRepository(),
      new MockPaymentGateway(),
      new SystemTimeProvider()
    );
  }

  async renew(req: Request, res: Response): Promise<void> {
    const { userId } = req.body || {};

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }

    try {
      const billingService = this.getService();
      const result = await billingService.processRenewal(userId.trim());

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || 'Internal server error'
      });
    }
  }
}

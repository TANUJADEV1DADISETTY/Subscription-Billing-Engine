// domain/services/SubscriptionBillingService.ts
import { ISubscriptionRepository } from '../ports/ISubscriptionRepository';
import { IUserRepository } from '../ports/IUserRepository';
import { IPaymentGateway } from '../ports/IPaymentGateway';
import { ITimeProvider } from '../ports/ITimeProvider';

export interface RenewalResult {
  success: boolean;
  message: string;
}

export class SubscriptionBillingService {
  // Dependencies are injected via the constructor.
  // Notice the absence of direct instantiations (no "new Database()")
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly userRepo: IUserRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly timeProvider: ITimeProvider
  ) {}

  // Orchestrates the renewal process
  // Params: userId (string)
  // Returns: { success: boolean, message: string }
  async processRenewal(userId: string): Promise<RenewalResult> {
    // 1. Fetch user data using Repository
    const user = await this.userRepo.getUserById(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }

    // 2. Fetch subscription data using Repository
    const sub = await this.subscriptionRepo.getSubscriptionByUserId(userId);
    if (!sub) {
      return { success: false, message: "Subscription not found" };
    }

    // 3. Get current time deterministically from the injected ITimeProvider
    const now = this.timeProvider.getCurrentTime();

    // BUSINESS RULE 1: Cannot renew if not expired
    const expiresAt = sub.expires_at instanceof Date ? sub.expires_at : new Date(sub.expires_at);
    if (expiresAt > now) {
      return { success: false, message: "Subscription is not yet expired" };
    }

    let chargeAmount = Number(sub.base_price);

    // BUSINESS RULE 2: December Promotional Discount (10% off)
    if (now.getMonth() === 11) { // 11 is December in 0-indexed JS dates
      chargeAmount = chargeAmount * 0.9;
    }

    // 4. Charge customer using the injected IPaymentGateway
    try {
      const chargeSuccess = await this.paymentGateway.charge(user.stripe_customer_id, chargeAmount);

      if (chargeSuccess) {
        // BUSINESS RULE 3: Add exactly 1 year to current time for next expiry
        const newExpiry = new Date(now.getTime());
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);

        // 5. Update DB using the injected ISubscriptionRepository
        await this.subscriptionRepo.updateExpiration(sub.id, newExpiry);
        return { success: true, message: "Renewal successful" };
      } else {
        return { success: false, message: "Payment failed" };
      }
    } catch (error) {
      return { success: false, message: "Payment gateway error" };
    }
  }
}

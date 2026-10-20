import { SubscriptionBillingService } from '../../src/domain/services/SubscriptionBillingService';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';
import { Subscription } from '../../src/domain/models/Subscription';
import { User } from '../../src/domain/models/User';

describe('SubscriptionBillingService (Isolated Domain Unit Tests)', () => {
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: jest.Mocked<ITimeProvider>;
  let service: SubscriptionBillingService;

  const mockUser: User = {
    id: 'user-123',
    stripe_customer_id: 'cus_stripe_123'
  };

  const mockExpiredSub: Subscription = {
    id: 'sub-456',
    user_id: 'user-123',
    base_price: 100.0,
    expires_at: new Date('2023-01-01T00:00:00.000Z')
  };

  beforeEach(() => {
    mockSubRepo = {
      getSubscriptionByUserId: jest.fn(),
      updateExpiration: jest.fn()
    };

    mockUserRepo = {
      getUserById: jest.fn()
    };

    mockPaymentGateway = {
      charge: jest.fn()
    };

    mockTimeProvider = {
      getCurrentTime: jest.fn()
    };

    service = new SubscriptionBillingService(
      mockSubRepo,
      mockUserRepo,
      mockPaymentGateway,
      mockTimeProvider
    );
  });

  describe('Business Rule: December Promotional Discount (10% off)', () => {
    it('should apply a 10% discount if the renewal happens in December', async () => {
      // Current time: December 15th, 2023
      const decemberDate = new Date('2023-12-15T10:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(decemberDate);

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(mockExpiredSub);
      mockPaymentGateway.charge.mockResolvedValue(true);
      mockSubRepo.updateExpiration.mockResolvedValue();

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Renewal successful');
      // 100 * 0.9 = 90
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_stripe_123', 90);
    });

    it('should charge standard price in non-December months', async () => {
      // Current time: July 15th, 2023
      const julyDate = new Date('2023-07-15T10:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(julyDate);

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(mockExpiredSub);
      mockPaymentGateway.charge.mockResolvedValue(true);
      mockSubRepo.updateExpiration.mockResolvedValue();

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Renewal successful');
      // Standard price: 100
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_stripe_123', 100);
    });
  });

  describe('Business Rule: Expiration Validation', () => {
    it('should fail if the subscription is not yet expired', async () => {
      // Current time: June 1st, 2023
      const currentDate = new Date('2023-06-01T12:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(currentDate);

      // Subscription expires in the future: December 31st, 2023
      const activeSub: Subscription = {
        id: 'sub-active',
        user_id: 'user-123',
        base_price: 100.0,
        expires_at: new Date('2023-12-31T23:59:59.000Z')
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(activeSub);

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription is not yet expired');
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
      expect(mockSubRepo.updateExpiration).not.toHaveBeenCalled();
    });
  });

  describe('Business Rule: Payment and Expiry Updates', () => {
    it('should add exactly 1 year to current time for next expiry on successful payment', async () => {
      const fixedNow = new Date('2024-05-10T14:30:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(mockExpiredSub);
      mockPaymentGateway.charge.mockResolvedValue(true);
      mockSubRepo.updateExpiration.mockResolvedValue();

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Renewal successful');

      const expectedNewExpiry = new Date('2025-05-10T14:30:00.000Z');
      expect(mockSubRepo.updateExpiration).toHaveBeenCalledWith('sub-456', expectedNewExpiry);
    });

    it('should fail gracefully if the payment gateway returns false', async () => {
      const fixedNow = new Date('2024-01-10T10:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(mockExpiredSub);
      mockPaymentGateway.charge.mockResolvedValue(false);

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Payment failed');
      expect(mockSubRepo.updateExpiration).not.toHaveBeenCalled();
    });

    it('should fail gracefully if payment gateway throws an unexpected error', async () => {
      const fixedNow = new Date('2024-01-10T10:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(mockExpiredSub);
      mockPaymentGateway.charge.mockRejectedValue(new Error('Stripe API 500 Network Timeout'));

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Payment gateway error');
      expect(mockSubRepo.updateExpiration).not.toHaveBeenCalled();
    });
  });

  describe('Validation & Edge Cases', () => {
    it('should return error when user is not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(null);

      const result = await service.processRenewal('non-existent-user');

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
      expect(mockSubRepo.getSubscriptionByUserId).not.toHaveBeenCalled();
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });

    it('should return error when subscription is not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(null);

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found');
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });

    it('should correctly handle subscription when expires_at is an ISO string instead of Date instance', async () => {
      const fixedNow = new Date('2024-05-10T14:30:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(fixedNow);

      const subWithDateString = {
        id: 'sub-string-date',
        user_id: 'user-123',
        base_price: 100.0,
        expires_at: '2023-01-01T00:00:00.000Z' as any
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(subWithDateString);
      mockPaymentGateway.charge.mockResolvedValue(true);
      mockSubRepo.updateExpiration.mockResolvedValue();

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Renewal successful');
    });
  });
});

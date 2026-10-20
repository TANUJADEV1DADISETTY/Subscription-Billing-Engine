import request from 'supertest';
import { createApp } from '../../src/infrastructure/api/app';
import { SubscriptionController } from '../../src/infrastructure/api/controllers/SubscriptionController';
import { SubscriptionBillingService } from '../../src/domain/services/SubscriptionBillingService';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';

describe('API Integration Tests (POST /api/renew)', () => {
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: jest.Mocked<ITimeProvider>;
  let controller: SubscriptionController;
  let app: any;

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
      getCurrentTime: jest.fn().mockReturnValue(new Date('2024-06-01T12:00:00.000Z'))
    };

    const serviceFactory = () =>
      new SubscriptionBillingService(
        mockSubRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

    controller = new SubscriptionController(serviceFactory);
    app = createApp(controller);
  });

  it('should return 400 Bad Request if userId is not provided', async () => {
    const res = await request(app)
      .post('/api/renew')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'userId is required'
    });
  });

  it('should return 200 OK with success message when renewal succeeds', async () => {
    mockUserRepo.getUserById.mockResolvedValue({
      id: 'user-expired-001',
      stripe_customer_id: 'cus_stripe_expired_001'
    });
    mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
      id: 'sub-001',
      user_id: 'user-expired-001',
      base_price: 100.0,
      expires_at: new Date('2023-01-01T00:00:00.000Z')
    });
    mockPaymentGateway.charge.mockResolvedValue(true);
    mockSubRepo.updateExpiration.mockResolvedValue();

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-expired-001' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Renewal successful'
    });
  });

  it('should return 400 Bad Request when subscription is not yet expired', async () => {
    mockUserRepo.getUserById.mockResolvedValue({
      id: 'user-unexpired-002',
      stripe_customer_id: 'cus_stripe_unexpired_002'
    });
    mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
      id: 'sub-002',
      user_id: 'user-unexpired-002',
      base_price: 150.0,
      expires_at: new Date('2099-12-31T23:59:59.000Z')
    });

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-unexpired-002' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Subscription is not yet expired'
    });
  });

  it('should return 400 Bad Request when user does not exist', async () => {
    mockUserRepo.getUserById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-nonexistent-999' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'User not found'
    });
  });
});
